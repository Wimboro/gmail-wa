import { authenticateGmail, getGmailService } from '../auth/gmailAuth.js';
import { authenticateSheets, getSheetsService } from '../auth/sheetsAuth.js';
import { getEmails, extractEmailBody, markEmailProcessed, getEmailHeaders } from '../services/gmailService.js';
import { parseEmailWithGemini } from '../services/geminiService.js';
import { 
  appendToSheet, 
  getExistingData, 
  isDuplicate, 
  createDataRow, 
  getHeaderRow 
} from '../services/sheetsService.js';
import { sendWhatsAppNotification, sendBatchWhatsAppNotification } from '../services/whatsappService.js';
import { CONFIG } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

/**
 * Process a single Gmail account
 * @param {string} accountId - Identifier for the account
 */
export async function processGmailAccount(accountId) {
  logger.separator(`Processing Gmail Account: ${accountId}`);
  
  try {
    // Authenticate services
    logger.info('Authenticating with Google services...');
    const gmailAuth = await authenticateGmail(accountId);
    const sheetsAuth = await authenticateSheets();
    
    // Build service objects
    const gmailService = getGmailService(gmailAuth);
    const sheetsService = await getSheetsService(sheetsAuth);
    
    // Get emails
    logger.info('Retrieving emails...');
    const emails = await getEmails(gmailService, CONFIG.GMAIL_SEARCH_QUERY);
    
    if (emails.length === 0) {
      logger.info(`No emails found for account ${accountId}`);
      return {
        accountId,
        processed: 0,
        duplicates: 0,
        errors: 0
      };
    }
    
    // Retrieve existing data from sheet to check for duplicates
    logger.info('Checking for existing data in spreadsheet...');
    const sheetRangeAll = 'Sheet1!A:F';
    const existingData = await getExistingData(sheetsService, CONFIG.SPREADSHEET_ID, sheetRangeAll);
    
    // Process emails and extract data
    const allDataRows = [];
    let duplicateCount = 0;
    let errorCount = 0;
    const processedTransactions = [];
    
    // Add header row if sheet is empty
    if (existingData.length === 0) {
      allDataRows.push(getHeaderRow());
    }
    
    // Get user ID for the email processor
    const emailProcessorUserId = `${CONFIG.PROCESSOR_USER_ID}-${accountId}`;
    
    logger.info(`Processing ${emails.length} emails...`);
    
    for (const email of emails) {
      try {
        const messageId = email.id;
        const headers = getEmailHeaders(email);
        
        logger.debug(`Processing email: ${headers.subject || 'No Subject'}`);
        
        // Extract email body
        const emailBody = extractEmailBody(email.payload);
        
        if (!emailBody) {
          logger.warning(`Could not extract body from email ${messageId}`);
          errorCount++;
          continue;
        }
        
        // Parse email with Gemini
        const parsedData = await parseEmailWithGemini(emailBody);
        
        if (!parsedData) {
          logger.warning(`Could not parse email ${messageId} with Gemini`);
          errorCount++;
          // Still mark email as processed to avoid reprocessing
          await markEmailProcessed(gmailService, messageId, 'Processed-Financial', true);
          continue;
        }
        
        // Create entry for duplicate checking
        const entry = {
          date: parsedData.date || new Date().toISOString().split('T')[0],
          amount: parsedData.amount || 0,
          category: parsedData.category || 'Lainnya',
          description: parsedData.description || ''
        };
        
        // Check if this transaction is already in the sheet
        if (isDuplicate(entry, existingData)) {
          logger.info(`Skipping duplicate transaction: ${entry.description} on ${entry.date}`);
          duplicateCount++;
          
          // Still mark email as processed even if it's a duplicate
          await markEmailProcessed(gmailService, messageId, 'Processed-Financial', true);
          continue;
        }
        
        // Create data row for Google Sheets
        const dataRow = createDataRow(entry, emailProcessorUserId);
        allDataRows.push(dataRow);
        processedTransactions.push(entry);
        
        // Mark email as processed
        await markEmailProcessed(gmailService, messageId, 'Processed-Financial', true);
        
        logger.success(`Processed transaction: ${entry.description} (${entry.amount})`);
        
      } catch (error) {
        logger.error(`Error processing email ${email.id}:`, error.message);
        errorCount++;
      }
    }
    
    // Append data to Google Sheet if we have new data
    let transactionsCount = 0;
    if (allDataRows.length > (existingData.length === 0 ? 1 : 0)) {
      logger.info('Appending data to Google Sheets...');
      
      const shouldSkipHeader = existingData.length > 0;
      await appendToSheet(sheetsService, CONFIG.SPREADSHEET_ID, CONFIG.SHEET_RANGE, allDataRows, shouldSkipHeader);
      
      transactionsCount = allDataRows.length - (existingData.length === 0 ? 1 : 0);
      logger.success(`Added ${transactionsCount} new transactions to the sheet`);
      
      // Send WhatsApp notifications
      if (CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS && transactionsCount > 0) {
        logger.info('Sending WhatsApp notifications...');
        
        if (transactionsCount > CONFIG.BATCH_NOTIFICATION_THRESHOLD) {
          // Send batch notification for many transactions
          await sendBatchWhatsAppNotification(transactionsCount, accountId);
        } else {
          // Send individual notifications for few transactions
          for (const transaction of processedTransactions) {
            await sendWhatsAppNotification(transaction, accountId);
          }
        }
      }
      
    } else {
      logger.info('No new transaction data to add to the sheet');
    }
    
    // Summary
    const summary = {
      accountId,
      processed: transactionsCount,
      duplicates: duplicateCount,
      errors: errorCount
    };
    
    logger.info(`Account ${accountId} summary:`);
    logger.info(`- New transactions: ${summary.processed}`);
    logger.info(`- Duplicates skipped: ${summary.duplicates}`);
    logger.info(`- Errors: ${summary.errors}`);
    
    return summary;
    
  } catch (error) {
    logger.error(`Error processing account ${accountId}:`, error.message);
    return {
      accountId,
      processed: 0,
      duplicates: 0,
      errors: 1
    };
  }
}

/**
 * Process all configured Gmail accounts
 * @returns {Promise<Array>} - Array of processing summaries
 */
export async function processAllAccounts() {
  logger.separator('Gmail to Sheets Processor Started');
  
  const summaries = [];
  
  for (const accountId of CONFIG.GMAIL_ACCOUNTS) {
    if (accountId.trim()) {
      const summary = await processGmailAccount(accountId.trim());
      summaries.push(summary);
    }
  }
  
  // Overall summary
  logger.separator('Processing Complete');
  
  const totals = summaries.reduce((acc, summary) => ({
    processed: acc.processed + summary.processed,
    duplicates: acc.duplicates + summary.duplicates,
    errors: acc.errors + summary.errors
  }), { processed: 0, duplicates: 0, errors: 0 });
  
  logger.info('Overall Summary:');
  logger.info(`- Accounts processed: ${summaries.length}`);
  logger.info(`- Total new transactions: ${totals.processed}`);
  logger.info(`- Total duplicates skipped: ${totals.duplicates}`);
  logger.info(`- Total errors: ${totals.errors}`);
  
  return summaries;
} 