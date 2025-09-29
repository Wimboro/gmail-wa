import axios from 'axios';
import { CONFIG } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

let wahaClient = null;
let sessionCache = null;
let initializationPromise = null;

function ensureWAHAClient() {
  if (wahaClient) {
    return wahaClient;
  }

  const baseUrl = (CONFIG.WAHA_BASE_URL || '').trim();
  if (!baseUrl) {
    throw new Error('WAHA_BASE_URL is not configured');
  }

  if (!CONFIG.WAHA_API_KEY) {
    throw new Error('WAHA_API_KEY is not configured');
  }

  wahaClient = axios.create({
    baseURL: baseUrl.replace(/\/+$/, ''),
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': CONFIG.WAHA_API_KEY
    },
    timeout: 20000
  });

  return wahaClient;
}

function describeAxiosError(error) {
  if (error.response) {
    const { status, data } = error.response;
    const details = typeof data === 'string' ? data : JSON.stringify(data);
    return `${status} ${details}`;
  }

  if (error.request) {
    return 'No response received from WAHA server';
  }

  return error.message;
}

async function ensureSessionStarted(client) {
  const sessionName = CONFIG.WAHA_SESSION_NAME;

  try {
    const { data } = await client.post('/api/sessions/start', {
      name: sessionName,
      config: {
        noweb: {
          store: {
            enabled: true,
            fullSync: false
          }
        }
      }
    });

    logger.success(`WAHA session '${sessionName}' started`);
    sessionCache = data;
    return data;
  } catch (error) {
    const message = error.response?.data?.message || '';
    const alreadyStarted = error.response?.status === 422 && typeof message === 'string' && message.includes('already started');

    if (alreadyStarted) {
      logger.debug(`WAHA session '${sessionName}' already active`);
      return null;
    }

    logger.error(`Failed to start WAHA session '${sessionName}': ${describeAxiosError(error)}`);
    throw error;
  }
}

async function fetchSessionStatus(client) {
  const sessionName = CONFIG.WAHA_SESSION_NAME;

  try {
    const { data } = await client.get(`/api/sessions/${encodeURIComponent(sessionName)}`);
    sessionCache = data;
    logger.debug(`WAHA session status: ${data.status}`);
    return data;
  } catch (error) {
    logger.error(`Failed to fetch WAHA session status: ${describeAxiosError(error)}`);
    throw error;
  }
}

async function sendWAHAMessage(chatId, text) {
  const client = ensureWAHAClient();

  try {
    const { data } = await client.post('/api/sendText', {
      session: CONFIG.WAHA_SESSION_NAME,
      chatId,
      text
    });

    return data;
  } catch (error) {
    const detail = describeAxiosError(error);
    const wrappedError = new Error(`WAHA sendText failed for ${chatId}: ${detail}`);
    wrappedError.cause = error;
    throw wrappedError;
  }
}

function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    return null;
  }

  let formatted = phoneNumber.toString().trim();
  if (!formatted) {
    return null;
  }

  if (formatted.startsWith('+')) {
    formatted = formatted.substring(1);
  } else if (!formatted.startsWith('62') && !formatted.startsWith('1')) {
    formatted = '62' + formatted.replace(/^0/, '');
  }

  return formatted;
}

function buildNotificationTargets() {
  const targets = [];
  const configuredNumbers = Array.isArray(CONFIG.WHATSAPP_PHONE_NUMBERS)
    ? CONFIG.WHATSAPP_PHONE_NUMBERS
    : CONFIG.WHATSAPP_PHONE_NUMBERS
      ? [CONFIG.WHATSAPP_PHONE_NUMBERS]
      : [];

  for (const phoneNumber of configuredNumbers) {
    const formatted = formatPhoneNumber(phoneNumber);

    if (!formatted) {
      logger.warning('Invalid phone number configured for WhatsApp notifications, skipping');
      continue;
    }

    targets.push({
      chatId: `${formatted}@c.us`,
      displayName: phoneNumber,
      type: 'contact'
    });
  }

  if (CONFIG.WHATSAPP_GROUP_ID && CONFIG.WHATSAPP_GROUP_ID.trim() !== '') {
    let groupId = CONFIG.WHATSAPP_GROUP_ID.trim();
    if (!groupId.endsWith('@g.us')) {
      groupId = `${groupId}@g.us`;
    }

    targets.push({
      chatId: groupId,
      displayName: 'Group',
      type: 'group'
    });
  }

  return targets;
}

function buildBatchTargets() {
  const targets = [];

  if (CONFIG.WHATSAPP_GROUP_ID && CONFIG.WHATSAPP_GROUP_ID.trim() !== '') {
    let groupId = CONFIG.WHATSAPP_GROUP_ID.trim();
    if (!groupId.endsWith('@g.us')) {
      groupId = `${groupId}@g.us`;
    }

    targets.push({ chatId: groupId, type: 'group', displayName: groupId });
    return targets;
  }

  const configuredNumbers = Array.isArray(CONFIG.WHATSAPP_PHONE_NUMBERS)
    ? CONFIG.WHATSAPP_PHONE_NUMBERS
    : CONFIG.WHATSAPP_PHONE_NUMBERS
      ? [CONFIG.WHATSAPP_PHONE_NUMBERS]
      : [];

  for (const phoneNumber of configuredNumbers) {
    const formatted = formatPhoneNumber(phoneNumber);

    if (!formatted) {
      continue;
    }

    targets.push({ chatId: `${formatted}@c.us`, type: 'contact', displayName: phoneNumber });
  }

  return targets;
}

/**
 * Initialize WAHA WhatsApp session
 * @returns {Promise<object|null>} - WAHA session status information
 */
export async function initializeWhatsApp() {
  if (!CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS) {
    logger.debug('WhatsApp notifications are disabled; skipping WAHA initialization');
    return null;
  }

  if (initializationPromise) {
    logger.debug('WAHA initialization already in progress, awaiting existing operation');
    return initializationPromise;
  }

  const client = ensureWAHAClient();

  initializationPromise = (async () => {
    await ensureSessionStarted(client);
    const status = await fetchSessionStatus(client);

    if (status?.status === 'SCAN_QR_CODE') {
      logger.warning('WAHA session waiting for QR scan. Please open the WAHA dashboard and authenticate the session.');
    } else if (status?.status === 'CONNECTED') {
      logger.success('WAHA session connected and ready to send messages');
    } else {
      logger.info(`WAHA session status: ${status?.status || 'UNKNOWN'}`);
    }

    return status;
  })();

  try {
    return await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}

/**
 * Send a WhatsApp notification for a single transaction
 * @param {Object} transaction - Transaction data
 * @param {string} accountId - Gmail account identifier
 */
export async function sendWhatsAppNotification(transaction, accountId) {
  logger.debug(`Attempting to send WAHA notification for transaction: ${transaction.description}`);

  if (!CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS) {
    logger.debug('WhatsApp notifications are disabled');
    return;
  }

  const hasTargets = (CONFIG.WHATSAPP_PHONE_NUMBERS && CONFIG.WHATSAPP_PHONE_NUMBERS.length > 0) ||
    (CONFIG.WHATSAPP_GROUP_ID && CONFIG.WHATSAPP_GROUP_ID.trim() !== '');

  if (!hasTargets) {
    logger.warning('No WhatsApp recipients configured');
    return;
  }

  try {
    await initializeWhatsApp();

    const message = formatTransactionMessage(transaction, accountId);
    logger.debug(`Formatted message: ${message.substring(0, 100)}...`);

    const targets = buildNotificationTargets();
    if (targets.length === 0) {
      logger.warning('No valid WhatsApp targets to send message to');
      return;
    }

    for (const target of targets) {
      try {
        logger.debug(`Sending WAHA message to ${target.type}: ${target.chatId}`);
        await sendWAHAMessage(target.chatId, message);
        logger.success(`WhatsApp notification sent to ${target.displayName} (${target.chatId})`);
      } catch (error) {
        logger.error(`Failed to send WhatsApp message to ${target.displayName}: ${error.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error sending WhatsApp notification: ${error.message}`);
  }
}

/**
 * Send a batch WhatsApp notification for multiple transactions
 * @param {number} transactionCount - Number of transactions processed
 * @param {string} accountId - Gmail account identifier
 */
export async function sendBatchWhatsAppNotification(transactionCount, accountId) {
  if (!CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS) {
    logger.debug('WhatsApp notifications are disabled');
    return;
  }

  if (!CONFIG.WHATSAPP_GROUP_ID && (!CONFIG.WHATSAPP_PHONE_NUMBERS || CONFIG.WHATSAPP_PHONE_NUMBERS.length === 0)) {
    logger.warning('No WhatsApp group or phone numbers configured for batch notifications');
    return;
  }

  try {
    await initializeWhatsApp();

    const message = formatBatchMessage(transactionCount, accountId);
    const targets = buildBatchTargets();

    if (targets.length === 0) {
      logger.warning('No valid recipients for batch notification');
      return;
    }

    for (const target of targets) {
      try {
        await sendWAHAMessage(target.chatId, message);
        logger.success(`Batch WhatsApp notification sent to ${target.type} (${target.chatId})`);
      } catch (error) {
        logger.error(`Failed to send batch WhatsApp message to ${target.displayName}: ${error.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error sending batch WhatsApp notification: ${error.message}`);
  }
}

/**
 * Format a single transaction message
 * @param {Object} transaction - Transaction data
 * @param {string} accountId - Gmail account identifier
 * @returns {string} - Formatted message
 */
function formatTransactionMessage(transaction, accountId) {
  const emoji = transaction.amount >= 0 ? '💰' : '💸';
  const type = transaction.amount >= 0 ? 'PEMASUKAN' : 'PENGELUARAN';
  const amount = Math.abs(transaction.amount).toLocaleString('id-ID');

  return `${emoji} *TRANSAKSI BARU*\n\n📧 *Akun:* ${accountId}\n🏦 *Bank:* ${transaction.bank || 'Tidak diketahui'}\n📊 *Jenis:* ${type}\n💵 *Jumlah:* Rp ${amount}\n🏷️ *Kategori:* ${transaction.category}\n📝 *Deskripsi:* ${transaction.description}\n📅 *Tanggal:* ${transaction.date}\n\n_Diproses otomatis dari email_`;
}

/**
 * Format a batch notification message
 * @param {number} count - Number of transactions
 * @param {string} accountId - Gmail account identifier
 * @returns {string} - Formatted message
 */
function formatBatchMessage(count, accountId) {
  return `📊 *LAPORAN TRANSAKSI*\n\n📧 *Akun:* ${accountId}\n🔢 *Jumlah Transaksi:* ${count}\n⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n${count} transaksi baru telah diproses dan ditambahkan ke spreadsheet.\n\n_Diproses otomatis dari email_`;
}

/**
 * Test WhatsApp connection
 * @returns {Promise<boolean>} - True if connection is successful
 */
export async function testWhatsAppConnection() {
  if (!CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS) {
    logger.debug('WhatsApp notifications are disabled; skipping connection test');
    return false;
  }

  try {
    await initializeWhatsApp();
    const status = await fetchSessionStatus(ensureWAHAClient());
    const connected = status?.status === 'CONNECTED';

    if (connected) {
      logger.success(`WhatsApp (WAHA) session connected: ${status.status}`);
    } else {
      logger.warning(`WhatsApp (WAHA) session status: ${status?.status || 'UNKNOWN'}`);
    }

    return connected;
  } catch (error) {
    logger.error(`WhatsApp connection test failed: ${error.message}`);
    return false;
  }
}

/**
 * Gracefully close WhatsApp client
 */
export async function closeWhatsApp() {
  wahaClient = null;
  sessionCache = null;
  logger.info('Cleared WAHA client references. The remote WAHA session remains managed on the server.');
}
