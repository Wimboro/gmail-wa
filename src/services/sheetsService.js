import { CONFIG } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

/**
 * Append data rows to a Google Sheet
 * @param {sheets_v4.Sheets} sheetsService - Authenticated Sheets service
 * @param {string} spreadsheetId - ID of the target spreadsheet
 * @param {string} sheetRange - Range where data should be appended
 * @param {Array<Array>} dataRows - List of rows to append
 * @param {boolean} skipHeader - Whether to skip the first row (header) when appending
 */
export async function appendToSheet(sheetsService, spreadsheetId, sheetRange, dataRows, skipHeader = false) {
  try {
    // Skip header row if requested
    const rowsToAppend = skipHeader && dataRows.length > 1 ? dataRows.slice(1) : dataRows;
    
    if (rowsToAppend.length === 0) {
      logger.warning('No rows to append after skipping header');
      return;
    }
    
    const request = {
      spreadsheetId,
      range: sheetRange,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: rowsToAppend
      }
    };
    
    const result = await sheetsService.spreadsheets.values.append(request);
    
    const updatedRows = result.data.updates?.updatedRows || 0;
    logger.success(`Appended ${updatedRows} rows to the sheet`);
    
    return result.data;
    
  } catch (error) {
    logger.error('Error appending to sheet:', error.message);
    throw error;
  }
}

/**
 * Retrieve existing data from Google Sheet to check for duplicates
 * @param {sheets_v4.Sheets} sheetsService - Authenticated Sheets service
 * @param {string} spreadsheetId - ID of the target spreadsheet
 * @param {string} sheetRange - Range to retrieve data from (e.g., 'Sheet1!A:F')
 * @returns {Promise<Array>} - List of existing rows as dictionaries
 */
export async function getExistingData(sheetsService, spreadsheetId, sheetRange) {
  try {
    const response = await sheetsService.spreadsheets.values.get({
      spreadsheetId,
      range: sheetRange
    });
    
    const values = response.data.values || [];
    
    if (values.length <= 1) {
      logger.info('Sheet is empty or contains only header row');
      return [];
    }
    
    // Match the column structure
    const headers = ['date', 'amount', 'category', 'description', 'user_id', 'timestamp'];
    const existingData = [];
    
    // Skip header row
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      // Handle case where row might be shorter than headers
      const paddedRow = [...row];
      while (paddedRow.length < headers.length) {
        paddedRow.push('');
      }
      
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = paddedRow[index] || '';
      });
      
      existingData.push(entry);
    }
    
    logger.success(`Retrieved ${existingData.length} existing entries from the sheet`);
    return existingData;
    
  } catch (error) {
    logger.error('Error retrieving existing data from sheet:', error.message);
    return [];
  }
}

/**
 * Check if a new entry already exists in the sheet
 * @param {Object} newEntry - Dictionary containing the new transaction data
 * @param {Array} existingEntries - List of dictionaries containing existing data
 * @returns {boolean} - Boolean indicating whether the entry is a duplicate
 */
export function isDuplicate(newEntry, existingEntries) {
  // Define fields that uniquely identify a transaction
  const keyFields = ['date', 'amount', 'category', 'description'];
  
  for (const existing of existingEntries) {
    // Check if all key fields match (case insensitive)
    let match = true;
    
    for (const field of keyFields) {
      const newVal = String(newEntry[field] || '').toLowerCase().trim();
      const existingVal = String(existing[field] || '').toLowerCase().trim();
      
      if (newVal !== existingVal) {
        match = false;
        break;
      }
    }
    
    if (match) {
      return true;
    }
  }
  
  return false;
}

/**
 * Create a formatted data row for Google Sheets
 * @param {Object} transactionData - Parsed transaction data
 * @param {string} userId - User ID for the processor
 * @returns {Array} - Formatted row for Google Sheets
 */
export function createDataRow(transactionData, userId) {
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
  
  return [
    transactionData.date || now.toISOString().split('T')[0],
    transactionData.amount || 0,
    transactionData.category || 'Lainnya',
    transactionData.description || '',
    userId,
    timestamp
  ];
}

/**
 * Get the header row for the spreadsheet
 * @returns {Array} - Header row
 */
export function getHeaderRow() {
  return ['Date', 'Amount', 'Category', 'Description', 'User ID', 'Timestamp'];
}

/**
 * Test Sheets connection
 * @param {sheets_v4.Sheets} sheetsService - Authenticated Sheets service
 * @param {string} spreadsheetId - ID of the target spreadsheet
 * @returns {Promise<boolean>} - True if connection is successful
 */
export async function testSheetsConnection(sheetsService, spreadsheetId) {
  try {
    const response = await sheetsService.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title'
    });
    
    const title = response.data.properties?.title;
    logger.success(`Successfully connected to spreadsheet: "${title}"`);
    return true;
    
  } catch (error) {
    logger.error('Sheets connection test failed:', error.message);
    
    if (error.code === 404) {
      logger.error('Spreadsheet not found. Please check the SPREADSHEET_ID in your .env file');
    } else if (error.code === 403) {
      logger.error('Permission denied. Make sure the service account has access to the spreadsheet');
    }
    
    return false;
  }
} 