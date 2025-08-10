import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { GMAIL_SCOPES, CREDENTIALS_FILE, TOKEN_FILE_TEMPLATE } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

/**
 * Authenticate with Gmail using OAuth 2.0 for a specific account
 * @param {string} accountId - Identifier for the account (used in token filename)
 * @returns {Promise<google.auth.OAuth2>} - Authenticated OAuth2 client
 */
export async function authenticateGmail(accountId = 'default') {
  try {
    const tokenFile = TOKEN_FILE_TEMPLATE.replace('{}', accountId);
    
    // Load client credentials
    if (!fs.existsSync(CREDENTIALS_FILE)) {
      throw new Error(`Credentials file '${CREDENTIALS_FILE}' not found. Please download it from Google Cloud Console.`);
    }
    
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    
    // Check if we have previously stored a token
    if (fs.existsSync(tokenFile)) {
      const token = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      oAuth2Client.setCredentials(token);
      
      // Check if token is still valid
      try {
        await oAuth2Client.getAccessToken();
        logger.success(`Gmail authenticated successfully for account: ${accountId}`);
        return oAuth2Client;
      } catch (error) {
        logger.warning(`Stored token is invalid for account ${accountId}, re-authenticating...`);
      }
    }
    
    // Get new token
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GMAIL_SCOPES,
    });
    
    logger.info(`Authorize this app by visiting this URL for account ${accountId}:`);
    console.log(authUrl);
    
    // In a real application, you'd want to handle this more gracefully
    // For now, we'll throw an error to indicate manual intervention is needed
    throw new Error(`Manual authorization required for account ${accountId}. Please visit the URL above and follow the setup instructions.`);
    
  } catch (error) {
    logger.error(`Error authenticating Gmail for account ${accountId}:`, error.message);
    throw error;
  }
}

/**
 * Save OAuth2 token to file
 * @param {string} accountId - Account identifier
 * @param {Object} token - OAuth2 token object
 */
export function saveToken(accountId, token) {
  const tokenFile = TOKEN_FILE_TEMPLATE.replace('{}', accountId);
  
  // Add account information to token
  const tokenWithAccount = {
    ...token,
    account_id: accountId
  };
  
  fs.writeFileSync(tokenFile, JSON.stringify(tokenWithAccount, null, 2));
  logger.success(`Token saved for account: ${accountId}`);
}

/**
 * Get Gmail service instance
 * @param {google.auth.OAuth2} auth - Authenticated OAuth2 client
 * @returns {gmail_v1.Gmail} - Gmail service instance
 */
export function getGmailService(auth) {
  return google.gmail({ version: 'v1', auth });
} 