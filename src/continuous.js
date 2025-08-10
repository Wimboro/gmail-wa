#!/usr/bin/env node

import { CONFIG, validateConfig } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import { initializeGemini, testGeminiConnection } from './services/geminiService.js';
import { initializeWhatsApp, testWhatsAppConnection, closeWhatsApp } from './services/whatsappService.js';
import { processAllAccounts } from './processors/emailProcessor.js';

let isProcessing = false;
let emailCheckInterval = null;
let whatsappReady = false;

/**
 * Process emails once
 */
async function processEmailsOnce() {
  if (isProcessing) {
    logger.warning('Email processing already in progress, skipping this cycle');
    return;
  }
  
  isProcessing = true;
  
  try {
    logger.separator('Email Processing Cycle Started');
    logger.info(`Starting email check at ${new Date().toLocaleString('id-ID')}`);
    
    // Process all Gmail accounts
    const summaries = await processAllAccounts();
    
    // Summary
    const totalProcessed = summaries.reduce((sum, s) => sum + s.processed, 0);
    const totalErrors = summaries.reduce((sum, s) => sum + s.errors, 0);
    const totalDuplicates = summaries.reduce((sum, s) => sum + s.duplicates, 0);
    
    if (totalProcessed > 0) {
      logger.success(`✅ Processed ${totalProcessed} new transactions!`);
      
      if (CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS && whatsappReady) {
        logger.success('📱 WhatsApp notifications sent for new transactions');
      }
    } else {
      logger.info('📧 No new emails found');
    }
    
    if (totalDuplicates > 0) {
      logger.info(`⏭️  Skipped ${totalDuplicates} duplicate transactions`);
    }
    
    if (totalErrors > 0) {
      logger.warning(`⚠️  ${totalErrors} errors occurred during processing`);
    }
    
    logger.info(`⏰ Next check in 5 minutes at ${new Date(Date.now() + 1 * 60 * 1000).toLocaleString('id-ID')}`);
    
  } catch (error) {
    logger.error('Error during email processing cycle:', error.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start continuous email monitoring
 */
async function startEmailMonitoring() {
  logger.success('🔄 Starting continuous email monitoring (every 1 minutes)');
  
  // Process emails immediately on start
  await processEmailsOnce();
  
  // Set up interval for every 5 minutes (300,000 milliseconds)
  emailCheckInterval = setInterval(async () => {
    await processEmailsOnce();
  }, 1 * 60 * 1000);
  
  logger.success('📅 Email monitoring scheduled every 1 minutes');
}

/**
 * Stop email monitoring
 */
function stopEmailMonitoring() {
  if (emailCheckInterval) {
    clearInterval(emailCheckInterval);
    emailCheckInterval = null;
    logger.info('⏹️  Email monitoring stopped');
  }
}

/**
 * Main application entry point - runs continuously
 */
async function main() {
  try {
    logger.separator('Gmail to Sheets WhatsApp Processor - Continuous Mode');
    logger.info('🚀 Starting continuous application...');
    
    // Validate configuration
    logger.info('Validating configuration...');
    validateConfig();
    
    // Initialize services
    logger.info('Initializing services...');
    
    // Initialize Gemini AI
    initializeGemini();
    const geminiReady = await testGeminiConnection();
    if (!geminiReady) {
      throw new Error('Gemini AI connection failed');
    }
    
    // Initialize WhatsApp (if enabled) and keep it running
    if (CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS) {
      logger.info('Initializing WhatsApp client for continuous operation...');
      logger.warning('⚠️  Please scan the QR code when it appears to enable WhatsApp notifications');
      
      await initializeWhatsApp();
      
      whatsappReady = await testWhatsAppConnection();
      if (!whatsappReady) {
        logger.warning('WhatsApp connection failed, notifications will be disabled');
        logger.warning('You can restart the application to try WhatsApp setup again');
      } else {
        logger.success('📱 WhatsApp is ready and will remain connected!');
      }
    } else {
      logger.info('WhatsApp notifications are disabled');
    }
    
    // Start continuous email monitoring
    await startEmailMonitoring();
    
    // Keep the application running
    logger.success('🎯 Application is now running continuously');
    logger.info('📧 Checking emails every 1 minutes');
    logger.info('📱 WhatsApp service remains active');
    logger.info('💡 Press Ctrl+C to stop gracefully');
    
    // Keep process alive
    return new Promise(() => {
      // This promise never resolves, keeping the app running
      // Graceful shutdown is handled by signal handlers
    });
    
  } catch (error) {
    logger.error('Application startup error:', error.message);
    
    if (error.message.includes('GEMINI_API_KEY')) {
      logger.error('Please set your GEMINI_API_KEY in the .env file');
    }
    
    if (error.message.includes('SPREADSHEET_ID')) {
      logger.error('Please set your SPREADSHEET_ID in the .env file');
    }
    
    if (error.message.includes('credentials.json')) {
      logger.error('Please download credentials.json from Google Cloud Console');
    }
    
    if (error.message.includes('sa-credentials.json')) {
      logger.error('Please create sa-credentials.json for service account access');
    }
    
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  logger.info(`📥 Received ${signal}, initiating graceful shutdown...`);
  
  // Stop email monitoring
  stopEmailMonitoring();
  
  // Wait for current processing to complete
  if (isProcessing) {
    logger.info('⏳ Waiting for current email processing to complete...');
    while (isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Cleanup WhatsApp
  if (CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS) {
    logger.info('📱 Closing WhatsApp client...');
    await closeWhatsApp();
  }
  
  logger.success('✅ Graceful shutdown completed');
  process.exit(0);
}

/**
 * Handle graceful shutdown
 */
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in continuous mode, just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // In continuous mode, try to recover rather than exit
  logger.warning('Attempting to continue operation...');
});

// Run the application
main().catch(error => {
  logger.error('Fatal application error:', error);
  process.exit(1);
}); 