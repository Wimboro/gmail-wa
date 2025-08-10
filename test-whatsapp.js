#!/usr/bin/env node

import { CONFIG } from './config/constants.js';
import { logger } from './utils/logger.js';
import { initializeWhatsApp, sendWhatsAppNotification } from './src/services/whatsappService.js';

async function testWhatsApp() {
  console.log('🧪 Testing WhatsApp notifications...');
  
  try {
    // Check configuration
    console.log('✅ WhatsApp notifications enabled:', CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS);
    console.log('✅ Phone numbers configured:', CONFIG.WHATSAPP_PHONE_NUMBERS);
    
    if (!CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS) {
      console.log('❌ WhatsApp notifications are disabled in .env');
      return;
    }
    
    if (!CONFIG.WHATSAPP_PHONE_NUMBERS || CONFIG.WHATSAPP_PHONE_NUMBERS.length === 0) {
      console.log('❌ No WhatsApp phone numbers configured');
      return;
    }
    
    // Initialize WhatsApp
    console.log('🔄 Initializing WhatsApp client...');
    await initializeWhatsApp();
    console.log('✅ WhatsApp client initialized');
    
    // Test transaction data
    const testTransaction = {
      amount: 150000,
      category: 'Test',
      description: 'Test notification from Gmail processor',
      transaction_type: 'expense',
      date: new Date().toISOString().split('T')[0]
    };
    
    console.log('🔄 Sending test notification...');
    await sendWhatsAppNotification(testTransaction, 'test-account');
    
    console.log('🎉 Test completed! Check your WhatsApp for the message.');
    
    // Keep process alive for a moment to allow message sending
    setTimeout(() => {
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('❌ WhatsApp test failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Test interrupted');
  process.exit(0);
});

// Run the test
testWhatsApp(); 