import fs from 'fs';
import { google } from 'googleapis';
import { SHEETS_SCOPES, SA_CREDENTIALS_FILE } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

/**
 * Authenticate with Google Sheets using Service Account credentials
 * @returns {Promise<google.auth.GoogleAuth>} - Authenticated service account client
 */
export async function authenticateSheets() {
  try {
    // Check if service account credentials file exists
    if (!fs.existsSync(SA_CREDENTIALS_FILE)) {
      throw new Error(
        `Service account credentials file '${SA_CREDENTIALS_FILE}' not found.\n` +
        `Please follow the setup instructions to create this file.\n` +
        `You can use the 'sa-credentials.json.template' file as a reference.`
      );
    }
    
    // Verify the JSON structure
    let saData;
    try {
      saData = JSON.parse(fs.readFileSync(SA_CREDENTIALS_FILE, 'utf8'));
    } catch (error) {
      throw new Error(`Invalid JSON in service account file: ${error.message}`);
    }
    
    // Validate required fields
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !saData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Service account file is missing required fields: ${missingFields.join(', ')}`);
    }
    
    if (saData.type !== 'service_account') {
      throw new Error("This doesn't appear to be a service account credentials file");
    }
    
    logger.info(`Service account email: ${saData.client_email}`);
    logger.info('Remember to share your Google Spreadsheet with this email address!');
    
    // Create authentication client
    const auth = new google.auth.GoogleAuth({
      keyFile: SA_CREDENTIALS_FILE,
      scopes: SHEETS_SCOPES,
    });
    
    // Test the authentication
    const authClient = await auth.getClient();
    
    logger.success('Successfully authenticated with Google Sheets using service account');
    return auth;
    
  } catch (error) {
    logger.error('Error authenticating with Google Sheets:', error.message);
    logger.info('\nTroubleshooting tips:');
    logger.info(`1. Make sure ${SA_CREDENTIALS_FILE} exists in the current directory`);
    logger.info('2. Verify the file contains valid JSON');
    logger.info('3. Ensure the service account has the necessary permissions');
    logger.info('4. Share your Google Spreadsheet with the service account email');
    logger.info('5. Check that Google Sheets API is enabled in your Google Cloud project');
    throw error;
  }
}

/**
 * Get Sheets service instance
 * @param {google.auth.GoogleAuth} auth - Authenticated service account client
 * @returns {Promise<sheets_v4.Sheets>} - Sheets service instance
 */
export async function getSheetsService(auth) {
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
} 