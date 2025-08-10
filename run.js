#!/usr/bin/env node

import { CONFIG } from './config/constants.js';
import { logger } from './utils/logger.js';
import { initializeWhatsApp, testWhatsAppConnection } from './src/services/whatsappService.js';

async function runWithWhatsApp() {
  console.log('🚀 Gmail to Sheets WhatsApp Processor Runner');
  console.log('');
  
  if (CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS) {
    console.log('📱 WhatsApp notifications are enabled');
    console.log('🔄 Setting up WhatsApp connection first...');
    console.log('');
    
    try {
      // Initialize WhatsApp and wait for it to be ready
      await initializeWhatsApp();
      
      const isReady = await testWhatsAppConnection();
      if (isReady) {
        console.log('✅ WhatsApp is ready!');
        console.log('🔄 Now starting email processing...');
        console.log('');
        
        // Import and run the main application
        const { main } = await import('./src/index.js');
        await main();
        
      } else {
        console.log('❌ WhatsApp failed to connect');
        console.log('❓ Would you like to continue without WhatsApp notifications? (y/N)');
        
        // For now, continue anyway
        console.log('⚠️  Continuing without WhatsApp notifications...');
        
        // Import and run the main application
        const { main } = await import('./src/index.js');
        await main();
      }
      
    } catch (error) {
      console.error('❌ Error setting up WhatsApp:', error.message);
      console.log('⚠️  Continuing without WhatsApp notifications...');
      
      // Import and run the main application
      const { main } = await import('./src/index.js');
      await main();
    }
    
  } else {
    console.log('📱 WhatsApp notifications are disabled');
    console.log('🔄 Starting email processing...');
    console.log('');
    
    // Import and run the main application
    const { main } = await import('./src/index.js');
    await main();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Application interrupted');
  process.exit(0);
});

// Run the application
runWithWhatsApp().catch(error => {
  console.error('❌ Runner failed:', error.message);
  process.exit(1);
}); 