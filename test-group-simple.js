#!/usr/bin/env node

import { CONFIG } from './config/constants.js';
import { initializeWhatsApp, sendWhatsAppNotification, testWhatsAppConnection } from './src/services/whatsappService.js';

console.log('Testing WAHA group notification for:', CONFIG.WHATSAPP_GROUP_ID || '<<not configured>>');

await initializeWhatsApp();
await testWhatsAppConnection();

await sendWhatsAppNotification({
  amount: 100000,
  category: 'Test',
  description: 'Group test',
  date: '2024-12-20'
}, 'test');
