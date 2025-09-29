#!/usr/bin/env node

import { CONFIG } from './config/constants.js';
import { initializeWhatsApp, sendWhatsAppNotification, testWhatsAppConnection } from './src/services/whatsappService.js';

async function testWhatsApp() {
  console.log('🧪 Testing WhatsApp notifications via WAHA...');

  try {
    console.log('✅ WhatsApp notifications enabled:', CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS);
    console.log('✅ Phone numbers configured:', CONFIG.WHATSAPP_PHONE_NUMBERS);
    console.log('✅ WAHA base URL:', CONFIG.WAHA_BASE_URL);
    console.log('✅ WAHA session name:', CONFIG.WAHA_SESSION_NAME);

    if (!CONFIG.ENABLE_WHATSAPP_NOTIFICATIONS) {
      console.log('❌ WhatsApp notifications are disabled in .env');
      return;
    }

    if ((!CONFIG.WHATSAPP_PHONE_NUMBERS || CONFIG.WHATSAPP_PHONE_NUMBERS.length === 0) && !CONFIG.WHATSAPP_GROUP_ID) {
      console.log('❌ No WhatsApp phone numbers or group ID configured');
      return;
    }

    console.log('🔄 Ensuring WAHA session is ready...');
    await initializeWhatsApp();

    const connected = await testWhatsAppConnection();
    if (connected) {
      console.log('✅ WAHA session connected');
    } else {
      console.log('⚠️  WAHA session not connected yet. Authenticate via the WAHA dashboard if required.');
    }

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
