import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { CONFIG } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

let whatsappClient = null;
let isClientReady = false;
let isInitializing = false;

/**
 * Initialize WhatsApp client
 * @returns {Promise<Client>} - WhatsApp client instance
 */
export async function initializeWhatsApp() {
  try {
    if (whatsappClient && isClientReady) {
      logger.debug('WhatsApp client already ready');
      return whatsappClient;
    }
    
    if (isInitializing) {
      logger.debug('WhatsApp client already initializing, waiting...');
      // Wait for initialization to complete
      while (isInitializing && !isClientReady) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return whatsappClient;
    }
    
    isInitializing = true;
    logger.info('Initializing WhatsApp client...');
    
    whatsappClient = new Client({
      authStrategy: new LocalAuth({
        clientId: 'gmail-sheets-processor'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });
    
    // Event handlers
    whatsappClient.on('qr', (qr) => {
      logger.info('WhatsApp QR Code received. Scan it with your phone:');
      qrcode.generate(qr, { small: true });
      logger.info('After scanning, the client will be ready to send messages.');
    });
    
    whatsappClient.on('ready', () => {
      isClientReady = true;
      isInitializing = false;
      logger.success('WhatsApp client is ready!');
    });
    
    whatsappClient.on('authenticated', () => {
      logger.success('WhatsApp client authenticated');
    });
    
    whatsappClient.on('auth_failure', (msg) => {
      logger.error('WhatsApp authentication failed:', msg);
      isClientReady = false;
      isInitializing = false;
    });
    
    whatsappClient.on('disconnected', (reason) => {
      logger.warning('WhatsApp client disconnected:', reason);
      isClientReady = false;
      isInitializing = false;
    });
    
    // Initialize the client
    await whatsappClient.initialize();
    
    // Wait for client to be ready with timeout
    if (!isClientReady) {
      logger.info('Waiting for WhatsApp client to be ready...');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WhatsApp client initialization timeout (60 seconds)'));
        }, 60000); // 60 second timeout
        
        whatsappClient.on('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        whatsappClient.on('auth_failure', (msg) => {
          clearTimeout(timeout);
          reject(new Error(`WhatsApp authentication failed: ${msg}`));
        });
      });
    }
    
    isInitializing = false;
    return whatsappClient;
    
  } catch (error) {
    isInitializing = false;
    logger.error('Error initializing WhatsApp client:', error.message);
    throw error;
  }
}

/**
 * Send a WhatsApp notification for a single transaction
 * @param {Object} transaction - Transaction data
 * @param {string} accountId - Gmail account identifier
 */
export async function sendWhatsAppNotification(transaction, accountId) {
  logger.debug(`Attempting to send WhatsApp notification for transaction: ${transaction.description}`);
  
  if (!CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS) {
    logger.debug('WhatsApp notifications are disabled');
    return;
  }
  
  if (!CONFIG.WHATSAPP_PHONE_NUMBERS || CONFIG.WHATSAPP_PHONE_NUMBERS.length === 0) {
    logger.warning('No WhatsApp phone numbers configured');
    return;
  }
  
  try {
    if (!whatsappClient || !isClientReady) {
      logger.info('WhatsApp client not ready, initializing...');
      await initializeWhatsApp();
    }
    
    if (!isClientReady) {
      logger.error('WhatsApp client is not ready after initialization');
      return;
    }
    
    const message = formatTransactionMessage(transaction, accountId);
    logger.debug(`Formatted message: ${message.substring(0, 100)}...`);
    
    // Determine targets: group or individual phone numbers
    const targets = [];
    
    // Send to both individual numbers and group if both are configured
    if (CONFIG.WHATSAPP_PHONE_NUMBERS && CONFIG.WHATSAPP_PHONE_NUMBERS.length > 0) {
      // Send to individual phone numbers
      const phoneNumbers = Array.isArray(CONFIG.WHATSAPP_PHONE_NUMBERS) 
        ? CONFIG.WHATSAPP_PHONE_NUMBERS 
        : [CONFIG.WHATSAPP_PHONE_NUMBERS];
      
      logger.debug(`Sending to phone numbers: ${phoneNumbers.join(', ')}`);
      
      for (const phoneNumber of phoneNumbers) {
        if (!phoneNumber || phoneNumber.trim() === '') {
          logger.warning('Empty phone number found, skipping');
          continue;
        }
        
        // Format phone number - ensure it starts with country code
        let formattedNumber = phoneNumber.toString().trim();
        if (!formattedNumber.startsWith('+')) {
          // If number doesn't start with +, assume it already has country code
          if (!formattedNumber.startsWith('62') && !formattedNumber.startsWith('1')) {
            // Add Indonesia country code if no country code detected
            formattedNumber = '62' + formattedNumber.replace(/^0/, '');
          }
        } else {
          // Remove + from the beginning
          formattedNumber = formattedNumber.substring(1);
        }
        
        targets.push({
          chatId: `${formattedNumber}@c.us`,
          displayName: phoneNumber,
          type: 'contact'
        });
      }
    }
    
    // Also send to group if configured (in addition to individual numbers)
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
      
      logger.debug(`Sending to group: ${groupId}`);
    }
    
    // Send to all targets
    for (const target of targets) {
      try {
        logger.debug(`Sending message to ${target.type}: ${target.chatId}`);
        
        const result = await whatsappClient.sendMessage(target.chatId, message);
        logger.success(`WhatsApp notification sent to ${target.displayName} (${target.chatId})`);
        logger.debug(`Message result: ${JSON.stringify(result, null, 2)}`);
        
      } catch (error) {
        logger.error(`Failed to send WhatsApp message to ${target.displayName}:`, error.message);
        
        // Try to get more specific error information
        if (error.message.includes('not found')) {
          if (target.type === 'group') {
            logger.error(`Group ${target.displayName} not found. Make sure the bot is added to the group.`);
          } else {
            logger.error(`Phone number ${target.displayName} not found on WhatsApp`);
          }
        } else if (error.message.includes('invalid')) {
          logger.error(`${target.type === 'group' ? 'Group ID' : 'Phone number'} ${target.displayName} appears to be invalid`);
        }
      }
    }
    
  } catch (error) {
    logger.error('Error sending WhatsApp notification:', error.message);
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
  
  if (!CONFIG.WHATSAPP_PHONE_NUMBERS || CONFIG.WHATSAPP_PHONE_NUMBERS.length === 0) {
    if (!CONFIG.WHATSAPP_GROUP_ID) {
      logger.warning('No WhatsApp phone numbers or group ID configured');
      return;
    }
  }
  
  try {
    if (!whatsappClient || !isClientReady) {
      await initializeWhatsApp();
    }
    
    if (!isClientReady) {
      logger.error('WhatsApp client is not ready after initialization');
      return;
    }
    
    const message = formatBatchMessage(transactionCount, accountId);
    
    // Send to group if configured, otherwise to individual numbers
    const targets = [];
    
    if (CONFIG.WHATSAPP_GROUP_ID && CONFIG.WHATSAPP_GROUP_ID.trim() !== '') {
      // Format group ID properly
      let groupId = CONFIG.WHATSAPP_GROUP_ID.trim();
      if (!groupId.endsWith('@g.us')) {
        groupId = `${groupId}@g.us`;
      }
      targets.push(groupId);
      logger.debug(`Sending batch notification to group: ${groupId}`);
    } else {
      // Send to individual phone numbers
      const phoneNumbers = Array.isArray(CONFIG.WHATSAPP_PHONE_NUMBERS) 
        ? CONFIG.WHATSAPP_PHONE_NUMBERS 
        : [CONFIG.WHATSAPP_PHONE_NUMBERS];
      
      for (const phoneNumber of phoneNumbers) {
        if (phoneNumber && phoneNumber.trim() !== '') {
          let formattedNumber = phoneNumber.toString().trim();
          if (!formattedNumber.startsWith('+')) {
            if (!formattedNumber.startsWith('62') && !formattedNumber.startsWith('1')) {
              formattedNumber = '62' + formattedNumber.replace(/^0/, '');
            }
          } else {
            formattedNumber = formattedNumber.substring(1);
          }
          targets.push(`${formattedNumber}@c.us`);
        }
      }
    }
    
    for (const target of targets) {
      try {
        const result = await whatsappClient.sendMessage(target, message);
        const targetType = target.includes('@g.us') ? 'group' : 'contact';
        logger.success(`Batch WhatsApp notification sent to ${targetType} (${target})`);
        logger.debug(`Batch message result: ${JSON.stringify(result, null, 2)}`);
      } catch (error) {
        logger.error(`Failed to send batch WhatsApp message to ${target}:`, error.message);
        
        if (error.message.includes('not found')) {
          if (target.includes('@g.us')) {
            logger.error(`Group ${target} not found. Make sure the bot is added to the group.`);
          } else {
            logger.error(`Contact ${target} not found on WhatsApp`);
          }
        }
      }
    }
    
  } catch (error) {
    logger.error('Error sending batch WhatsApp notification:', error.message);
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
  
  return `${emoji} *TRANSAKSI BARU*

📧 *Akun:* ${accountId}
📊 *Jenis:* ${type}
💵 *Jumlah:* Rp ${amount}
🏷️ *Kategori:* ${transaction.category}
📝 *Deskripsi:* ${transaction.description}
📅 *Tanggal:* ${transaction.date}

_Diproses otomatis dari email_`;
}

/**
 * Format a batch notification message
 * @param {number} count - Number of transactions
 * @param {string} accountId - Gmail account identifier
 * @returns {string} - Formatted message
 */
function formatBatchMessage(count, accountId) {
  return `📊 *LAPORAN TRANSAKSI*

📧 *Akun:* ${accountId}
🔢 *Jumlah Transaksi:* ${count}
⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}

${count} transaksi baru telah diproses dan ditambahkan ke spreadsheet.

_Diproses otomatis dari email_`;
}

/**
 * Test WhatsApp connection
 * @returns {Promise<boolean>} - True if connection is successful
 */
export async function testWhatsAppConnection() {
  try {
    if (!whatsappClient || !isClientReady) {
      logger.info('WhatsApp client not ready, initializing...');
      await initializeWhatsApp();
    }
    
    const info = await whatsappClient.getState();
    logger.success(`WhatsApp client state: ${info}`);
    return info === 'CONNECTED';
    
  } catch (error) {
    logger.error('WhatsApp connection test failed:', error.message);
    return false;
  }
}

/**
 * Gracefully close WhatsApp client
 */
export async function closeWhatsApp() {
  if (whatsappClient) {
    try {
      await whatsappClient.destroy();
      logger.info('WhatsApp client closed');
    } catch (error) {
      logger.error('Error closing WhatsApp client:', error.message);
    }
  }
} 