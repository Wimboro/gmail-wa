import type { Env, WAHASendResponse, TransactionInput } from "../types";
import { getConfig } from "../config";
import { logger } from "../utils/logger";

/**
 * Initialize WAHA WhatsApp session
 */
export async function initializeWhatsApp(env: Env): Promise<boolean> {
  const config = getConfig(env);

  if (!config.ENABLE_WHATSAPP_NOTIFICATIONS) {
    logger.debug("WhatsApp notifications are disabled");
    return false;
  }

  if (!config.WAHA_BASE_URL || !config.WAHA_API_KEY) {
    logger.warning("WAHA configuration is incomplete");
    return false;
  }

  try {
    // Start session if not already running
    const startResponse = await fetch(
      `${config.WAHA_BASE_URL}/api/sessions/start`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": config.WAHA_API_KEY,
        },
        body: JSON.stringify({
          name: config.WAHA_SESSION_NAME,
          config: {
            noweb: {
              store: {
                enabled: true,
                fullSync: false,
              },
            },
          },
        }),
      }
    );

    if (startResponse.ok) {
      logger.success(`WAHA session '${config.WAHA_SESSION_NAME}' started`);
      return true;
    }

    // Check if session already exists (422 error)
    if (startResponse.status === 422) {
      const errorData = await startResponse.json().catch(() => ({})) as { message?: string };
      if (errorData.message?.includes("already started")) {
        logger.debug(`WAHA session '${config.WAHA_SESSION_NAME}' already active`);
        return true;
      }
    }

    logger.warning(`WAHA session start returned: ${startResponse.status}`);
    return false;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to initialize WAHA:", message);
    return false;
  }
}

/**
 * Test WhatsApp connection
 */
export async function testWhatsAppConnection(env: Env): Promise<boolean> {
  const config = getConfig(env);

  if (!config.ENABLE_WHATSAPP_NOTIFICATIONS) {
    return false;
  }

  if (!config.WAHA_BASE_URL || !config.WAHA_API_KEY) {
    return false;
  }

  try {
    const response = await fetch(
      `${config.WAHA_BASE_URL}/api/sessions/${encodeURIComponent(config.WAHA_SESSION_NAME)}`,
      {
        headers: { "X-Api-Key": config.WAHA_API_KEY },
      }
    );

    if (!response.ok) {
      logger.error(`WAHA status check failed: ${response.status}`);
      return false;
    }

    const data = (await response.json()) as { status?: string };
    const connected = data.status === "CONNECTED";

    if (connected) {
      logger.success("WAHA session connected");
    } else {
      logger.warning(`WAHA session status: ${data.status || "UNKNOWN"}`);
    }

    return connected;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("WAHA connection test failed:", message);
    return false;
  }
}

/**
 * Send a WhatsApp message
 */
async function sendWAHAMessage(
  env: Env,
  chatId: string,
  text: string
): Promise<boolean> {
  const config = getConfig(env);

  try {
    const response = await fetch(`${config.WAHA_BASE_URL}/api/sendText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.WAHA_API_KEY,
      },
      body: JSON.stringify({
        session: config.WAHA_SESSION_NAME,
        chatId,
        text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`WAHA send failed: ${response.status} ${errorText}`);
      return false;
    }

    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`WAHA send error: ${message}`);
    return false;
  }
}

/**
 * Format phone number for WhatsApp
 */
function formatPhoneNumber(phoneNumber: string): string | null {
  if (!phoneNumber) return null;

  let formatted = phoneNumber.toString().trim();
  if (!formatted) return null;

  if (formatted.startsWith("+")) {
    formatted = formatted.substring(1);
  } else if (!formatted.startsWith("62") && !formatted.startsWith("1")) {
    formatted = "62" + formatted.replace(/^0/, "");
  }

  return formatted;
}

/**
 * Build notification targets from config
 */
function buildNotificationTargets(env: Env): Array<{
  chatId: string;
  displayName: string;
  type: "contact" | "group";
}> {
  const config = getConfig(env);
  const targets: Array<{
    chatId: string;
    displayName: string;
    type: "contact" | "group";
  }> = [];

  // Add phone numbers
  for (const phoneNumber of config.WHATSAPP_PHONE_NUMBERS) {
    const formatted = formatPhoneNumber(phoneNumber);
    if (formatted) {
      targets.push({
        chatId: `${formatted}@c.us`,
        displayName: phoneNumber,
        type: "contact",
      });
    }
  }

  // Add group if configured
  if (config.WHATSAPP_GROUP_ID) {
    let groupId = config.WHATSAPP_GROUP_ID.trim();
    if (!groupId.endsWith("@g.us")) {
      groupId = `${groupId}@g.us`;
    }
    targets.push({
      chatId: groupId,
      displayName: "Group",
      type: "group",
    });
  }

  return targets;
}

/**
 * Send a WhatsApp notification for a single transaction
 */
export async function sendWhatsAppNotification(
  env: Env,
  transaction: TransactionInput,
  accountId: string
): Promise<void> {
  const config = getConfig(env);

  if (!config.ENABLE_WHATSAPP_NOTIFICATIONS) {
    return;
  }

  const targets = buildNotificationTargets(env);
  if (targets.length === 0) {
    logger.warning("No WhatsApp recipients configured");
    return;
  }

  const message = formatTransactionMessage(transaction, accountId);

  for (const target of targets) {
    const success = await sendWAHAMessage(env, target.chatId, message);
    if (success) {
      logger.success(`WhatsApp notification sent to ${target.displayName}`);
    } else {
      logger.error(`Failed to send to ${target.displayName}`);
    }
  }
}

/**
 * Send a batch WhatsApp notification for multiple transactions
 */
export async function sendBatchWhatsAppNotification(
  env: Env,
  transactionCount: number,
  accountId: string
): Promise<void> {
  const config = getConfig(env);

  if (!config.ENABLE_WHATSAPP_NOTIFICATIONS) {
    return;
  }

  const targets = buildNotificationTargets(env);
  if (targets.length === 0) {
    return;
  }

  const message = formatBatchMessage(transactionCount, accountId);

  // Prefer group for batch notifications
  const target = targets.find((t) => t.type === "group") || targets[0];

  const success = await sendWAHAMessage(env, target.chatId, message);
  if (success) {
    logger.success(`Batch notification sent to ${target.displayName}`);
  }
}

/**
 * Format a single transaction message
 */
function formatTransactionMessage(
  transaction: TransactionInput,
  accountId: string
): string {
  const emoji = transaction.amount >= 0 ? "💰" : "💸";
  const type = transaction.amount >= 0 ? "PEMASUKAN" : "PENGELUARAN";
  const amount = Math.abs(transaction.amount).toLocaleString("id-ID");

  return `${emoji} *TRANSAKSI BARU*

📧 *Akun:* ${accountId}
🏦 *Bank:* ${transaction.bank || "Tidak diketahui"}
📊 *Jenis:* ${type}
💵 *Jumlah:* Rp ${amount}
🏷️ *Kategori:* ${transaction.category}
📝 *Deskripsi:* ${transaction.description}
📅 *Tanggal:* ${transaction.date}

_Diproses otomatis dari email_`;
}

/**
 * Format a batch notification message
 */
function formatBatchMessage(count: number, accountId: string): string {
  return `📊 *LAPORAN TRANSAKSI*

📧 *Akun:* ${accountId}
🔢 *Jumlah Transaksi:* ${count}
⏰ *Waktu:* ${new Date().toLocaleString("id-ID")}

${count} transaksi baru telah diproses dan ditambahkan ke database.

_Diproses otomatis dari email_`;
}
