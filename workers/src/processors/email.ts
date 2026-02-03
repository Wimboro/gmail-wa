import type { Env, TransactionInput, ProcessingSummary } from "../types";
import { getConfig } from "../config";
import { logger } from "../utils/logger";
import { hasOAuthToken } from "../auth/gmail";
import {
  getEmails,
  extractEmailBody,
  markEmailProcessed,
  getEmailHeaders,
} from "../services/gmail";
import { parseEmailWithGemini } from "../services/gemini";
import { insertTransaction } from "../services/d1";
import {
  sendWhatsAppNotification,
  sendBatchWhatsAppNotification,
  initializeWhatsApp,
} from "../services/whatsapp";

/**
 * Process a single Gmail account
 */
export async function processGmailAccount(
  env: Env,
  accountId: string
): Promise<ProcessingSummary> {
  logger.separator(`Processing Gmail Account: ${accountId}`);

  const summary: ProcessingSummary = {
    accountId,
    processed: 0,
    duplicates: 0,
    errors: 0,
  };

  try {
    const config = getConfig(env);

    // Check if we have OAuth token for this account
    const hasToken = await hasOAuthToken(env, accountId);
    if (!hasToken) {
      logger.error(`No OAuth token found for account: ${accountId}`);
      summary.errors = 1;
      return summary;
    }

    // Get emails
    logger.info("Retrieving emails...");
    const emails = await getEmails(env, accountId, config.GMAIL_SEARCH_QUERY);

    if (emails.length === 0) {
      logger.info(`No emails found for account ${accountId}`);
      return summary;
    }

    logger.info(`Processing ${emails.length} emails...`);

    const processedTransactions: TransactionInput[] = [];

    for (const email of emails) {
      try {
        const messageId = email.id;
        const headers = getEmailHeaders(email);

        logger.debug(`Processing email: ${headers.subject || "No Subject"}`);

        // Extract email body
        const emailBody = extractEmailBody(email.payload);

        if (!emailBody) {
          logger.warning(`Could not extract body from email ${messageId}`);
          summary.errors++;
          await markEmailProcessed(env, accountId, messageId);
          continue;
        }

        // Parse email with Gemini
        const parsedData = await parseEmailWithGemini(env, emailBody);

        if (!parsedData) {
          logger.warning(`Could not parse email ${messageId} with Gemini`);
          summary.errors++;
          await markEmailProcessed(env, accountId, messageId);
          continue;
        }

        // Create transaction entry
        const transaction: TransactionInput = {
          date: parsedData.date || new Date().toISOString().split("T")[0],
          amount: parsedData.amount || 0,
          category: parsedData.category || "Lainnya",
          description: parsedData.description || "",
          bank: parsedData.bank || "Tidak Diketahui",
          type: parsedData.transaction_type,
          email_id: messageId,
          account_id: accountId,
        };

        // Insert into D1 (with duplicate check)
        const result = await insertTransaction(env, transaction);

        if (result.isDuplicate) {
          logger.info(
            `Skipping duplicate: ${transaction.description} on ${transaction.date}`
          );
          summary.duplicates++;
        } else {
          logger.success(
            `Processed transaction: ${transaction.description} (${transaction.amount})`
          );
          summary.processed++;
          processedTransactions.push(transaction);
        }

        // Mark email as processed
        await markEmailProcessed(env, accountId, messageId);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Error processing email ${email.id}:`, message);
        summary.errors++;
      }
    }

    // Send WhatsApp notifications
    if (summary.processed > 0) {
      const config = getConfig(env);

      if (config.ENABLE_WHATSAPP_NOTIFICATIONS) {
        await initializeWhatsApp(env);

        if (summary.processed > config.BATCH_NOTIFICATION_THRESHOLD) {
          // Send batch notification
          await sendBatchWhatsAppNotification(
            env,
            summary.processed,
            accountId
          );
        } else {
          // Send individual notifications
          for (const transaction of processedTransactions) {
            await sendWhatsAppNotification(env, transaction, accountId);
          }
        }
      }
    }

    // Log summary
    logger.info(`Account ${accountId} summary:`);
    logger.info(`- New transactions: ${summary.processed}`);
    logger.info(`- Duplicates skipped: ${summary.duplicates}`);
    logger.info(`- Errors: ${summary.errors}`);

    return summary;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error processing account ${accountId}:`, message);
    summary.errors = 1;
    return summary;
  }
}

/**
 * Process all configured Gmail accounts
 */
export async function processAllAccounts(env: Env): Promise<ProcessingSummary[]> {
  logger.separator("Gmail to D1 Processor Started");

  const config = getConfig(env);
  const summaries: ProcessingSummary[] = [];

  for (const accountId of config.GMAIL_ACCOUNTS) {
    if (accountId.trim()) {
      const summary = await processGmailAccount(env, accountId.trim());
      summaries.push(summary);
    }
  }

  // Overall summary
  logger.separator("Processing Complete");

  const totals = summaries.reduce(
    (acc, summary) => ({
      processed: acc.processed + summary.processed,
      duplicates: acc.duplicates + summary.duplicates,
      errors: acc.errors + summary.errors,
    }),
    { processed: 0, duplicates: 0, errors: 0 }
  );

  logger.info("Overall Summary:");
  logger.info(`- Accounts processed: ${summaries.length}`);
  logger.info(`- Total new transactions: ${totals.processed}`);
  logger.info(`- Total duplicates skipped: ${totals.duplicates}`);
  logger.info(`- Total errors: ${totals.errors}`);

  return summaries;
}
