import type { Env } from "./types";
import { validateConfig, getConfig } from "./config";
import { logger } from "./utils/logger";
import { testD1Connection, getBalanceSummary } from "./services/d1";
import { testGeminiConnection } from "./services/gemini";
import { testWhatsAppConnection } from "./services/whatsapp";
import { processAllAccounts } from "./processors/email";

export default {
  /**
   * HTTP Request Handler
   * Provides health check and manual trigger endpoints
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "gmail-wa-processor",
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Status endpoint - check all services
    if (url.pathname === "/status") {
      const [d1Ok, geminiOk, wahaOk] = await Promise.all([
        testD1Connection(env),
        testGeminiConnection(env),
        testWhatsAppConnection(env),
      ]);

      const config = getConfig(env);
      const validation = validateConfig(env);

      return new Response(
        JSON.stringify({
          status: d1Ok && geminiOk ? "ok" : "degraded",
          timestamp: new Date().toISOString(),
          services: {
            d1: d1Ok ? "connected" : "error",
            gemini: geminiOk ? "connected" : "error",
            whatsapp: wahaOk
              ? "connected"
              : config.ENABLE_WHATSAPP_NOTIFICATIONS
                ? "error"
                : "disabled",
          },
          config: {
            valid: validation.valid,
            errors: validation.errors,
            accounts: config.GMAIL_ACCOUNTS.length,
            whatsappEnabled: config.ENABLE_WHATSAPP_NOTIFICATIONS,
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Balance summary endpoint
    if (url.pathname === "/balance") {
      try {
        const balance = await getBalanceSummary(env);
        return new Response(
          JSON.stringify({
            success: true,
            data: balance,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return new Response(
          JSON.stringify({
            success: false,
            error: message,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Manual trigger endpoint (POST only)
    if (url.pathname === "/trigger") {
      if (request.method !== "POST") {
        return new Response("Method not allowed. Use POST.", { status: 405 });
      }

      // Start processing in background
      ctx.waitUntil(processAllAccounts(env));

      return new Response(
        JSON.stringify({
          status: "started",
          message: "Email processing started in background",
          timestamp: new Date().toISOString(),
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({
        error: "Not found",
        availableEndpoints: [
          "GET /health - Health check",
          "GET /status - Service status",
          "GET /balance - Balance summary",
          "POST /trigger - Manual processing trigger",
        ],
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  },

  /**
   * Scheduled (Cron) Handler
   * Runs every 5 minutes to process emails
   */
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const startTime = Date.now();
    logger.separator("Scheduled Email Processing");
    logger.info(`Cron triggered: ${controller.cron}`);
    logger.info(`Scheduled time: ${new Date(controller.scheduledTime).toISOString()}`);

    try {
      // Validate configuration
      const validation = validateConfig(env);
      if (!validation.valid) {
        logger.error("Configuration validation failed:");
        validation.errors.forEach((err) => logger.error(`- ${err}`));
        return;
      }

      // Process all accounts
      const summaries = await processAllAccounts(env);

      // Calculate totals
      const totals = summaries.reduce(
        (acc, s) => ({
          processed: acc.processed + s.processed,
          duplicates: acc.duplicates + s.duplicates,
          errors: acc.errors + s.errors,
        }),
        { processed: 0, duplicates: 0, errors: 0 }
      );

      const duration = Date.now() - startTime;
      logger.success(
        `Cron completed in ${duration}ms: ${totals.processed} new, ${totals.duplicates} duplicates, ${totals.errors} errors`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Scheduled processing failed:", message);
    }
  },
};
