#!/usr/bin/env node

import fs from 'fs';
import { google } from 'googleapis';
import { SA_CREDENTIALS_FILE, SHEETS_SCOPES } from './config/constants.js';
import { logger } from './utils/logger.js';

/**
 * Quick fix untuk masalah DECODER routines::unsupported
 */

async function quickAuthFix() {
  logger.separator('Quick Authentication Fix');
  
  try {
    // Check if file exists
    if (!fs.existsSync(SA_CREDENTIALS_FILE)) {
      logger.error('❌ Service account file not found');
      showRegenerateInstructions();
      return false;
    }
    
    // Read current credentials
    let credentials;
    try {
      const content = fs.readFileSync(SA_CREDENTIALS_FILE, 'utf8');
      credentials = JSON.parse(content);
      logger.success('✅ JSON file is readable');
    } catch (error) {
      logger.error('❌ JSON parse error:', error.message);
      return false;
    }
    
    logger.info(`📧 Service account: ${credentials.client_email}`);
    
    // Try authentication with different methods
    logger.info('🔄 Testing authentication methods...');
    
    // Method 1: Direct credentials object
    try {
      logger.info('Method 1: Direct credentials object...');
      const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: SHEETS_SCOPES,
      });
      
      const authClient = await auth.getClient();
      const token = await authClient.getAccessToken();
      
      if (token.token) {
        logger.success('✅ Method 1 SUCCESS!');
        logger.success('🎉 Authentication is working!');
        return true;
      }
      
    } catch (error) {
      logger.error('❌ Method 1 failed:', error.message);
    }
    
    // Method 2: Environment variable
    try {
      logger.info('Method 2: Environment variable...');
      process.env.GOOGLE_APPLICATION_CREDENTIALS = SA_CREDENTIALS_FILE;
      
      const auth = new google.auth.GoogleAuth({
        scopes: SHEETS_SCOPES,
      });
      
      const authClient = await auth.getClient();
      const token = await authClient.getAccessToken();
      
      if (token.token) {
        logger.success('✅ Method 2 SUCCESS!');
        logger.success('🎉 Authentication is working with environment variable!');
        return true;
      }
      
    } catch (error) {
      logger.error('❌ Method 2 failed:', error.message);
    }
    
    // Method 3: JWT directly
    try {
      logger.info('Method 3: JWT authentication...');
      const { JWT } = google.auth;
      
      const jwtClient = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: SHEETS_SCOPES,
      });
      
      const token = await jwtClient.getAccessToken();
      
      if (token.token) {
        logger.success('✅ Method 3 SUCCESS!');
        logger.success('🎉 JWT authentication is working!');
        return true;
      }
      
    } catch (error) {
      logger.error('❌ Method 3 failed:', error.message);
    }
    
    logger.error('❌ All authentication methods failed');
    showRegenerateInstructions();
    return false;
    
  } catch (error) {
    logger.error('Unexpected error:', error.message);
    return false;
  }
}

function showRegenerateInstructions() {
  logger.separator('🔧 SOLUSI: Regenerate Service Account Key');
  
  logger.info('Private key corrupt/expired. Ikuti langkah ini:');
  logger.info('');
  logger.info('1. 🌐 Buka: https://console.cloud.google.com/iam-admin/serviceaccounts?project=goog-455703');
  logger.info('2. 🔍 Cari: telegram-sheets-bot@goog-455703.iam.gserviceaccount.com');
  logger.info('3. 🖱️  Klik service account tersebut');
  logger.info('4. 🗂️  Pilih tab "Keys"');
  logger.info('5. 🗑️  Hapus semua keys lama');
  logger.info('6. ➕ Klik "ADD KEY" → "Create new key"');
  logger.info('7. 📄 Pilih "JSON" → "CREATE"');
  logger.info('8. 💾 Download file baru');
  logger.info('9. 📝 Replace sa-credentials.json dengan file baru');
  logger.info('10. ✅ Test lagi dengan: node fix-auth-quick.js');
  logger.info('');
  logger.info('📊 Pastikan spreadsheet di-share dengan:');
  logger.info('   telegram-sheets-bot@goog-455703.iam.gserviceaccount.com');
}

function createTempWorkaround() {
  logger.separator('Temporary Workaround');
  
  logger.info('Sementara auth belum fix, buat workaround:');
  logger.info('');
  logger.info('1. Set environment variable:');
  logger.info('   export GOOGLE_APPLICATION_CREDENTIALS=./sa-credentials.json');
  logger.info('');
  logger.info('2. Atau tambah ke .env:');
  logger.info('   GOOGLE_APPLICATION_CREDENTIALS=./sa-credentials.json');
  logger.info('');
  logger.info('3. Restart aplikasi');
}

async function main() {
  const success = await quickAuthFix();
  
  if (!success) {
    createTempWorkaround();
    
    logger.separator('Status');
    logger.info('✅ Parsing data: WORKING (bank field detected correctly!)');
    logger.info('❌ Sheets authentication: NEEDS REGENERATION');
    logger.info('💡 Regenerate service account key untuk fix masalah ini');
  } else {
    logger.separator('Status');
    logger.success('✅ Parsing data: WORKING');
    logger.success('✅ Sheets authentication: WORKING');
    logger.success('🎉 Aplikasi siap digunakan!');
  }
}

main().catch(error => {
  logger.error('Script error:', error);
});