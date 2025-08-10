#!/usr/bin/env node

import { parseEmailWithEnhancedGemini, initializeEnhancedGemini } from './src/services/enhancedGeminiService.js';
import { logger } from './utils/logger.js';

/**
 * Test enhanced Gemini parsing capabilities
 */

async function testEnhancedGemini() {
  logger.separator('Testing Enhanced Gemini Email Parsing');
  
  try {
    // Initialize enhanced Gemini
    await initializeEnhancedGemini();
    
    // Test cases with various email formats
    const testEmails = [
      {
        title: 'Complex Transfer Email',
        body: `
Subject: Transfer Berhasil - Mandiri
From: mandiri@mandiri.co.id

Halo Wimboro,

Transfer Anda telah berhasil diproses pada 15 Januari 2024, 14:30 WIB.

Detail Transaksi:
- Jumlah: Rp 2.500.000
- Tujuan: John Doe (BCA 1234567890)  
- Dari: Mandiri Wimboro (****1234)
- Referensi: TRF240115001234
- Biaya Admin: Rp 6.500

Saldo tersisa: Rp 15.450.000

Terima kasih telah menggunakan layanan Mandiri.
        `
      },
      {
        title: 'QRIS Payment Notification',
        body: `
Fwd: Pembayaran QRIS Berhasil

Pembayaran QRIS Anda berhasil!

Merchant: Warung Bu Sari
Lokasi: Jl. Sudirman No.123, Jakarta
Tanggal: 10/01/2024 12:45
Jumlah: Rp 35.000
Dari: Jago Fara
ID Transaksi: QRIS240110789
        `
      },
      {
        title: 'Salary Notification',
        body: `
Gaji Bulan Desember 2023

Selamat! Gaji Anda telah ditransfer.

PT Teknologi Indonesia
Gaji Pokok: Rp 8.000.000
Tunjangan: Rp 1.500.000
Total: Rp 9.500.000

Ditransfer ke: Blu Wimboro
Tanggal: 2024-01-01
Ref: SAL202312001
        `
      },
      {
        title: 'Bill Payment',
        body: `
Tagihan PLN Dibayar

Pembayaran tagihan listrik Anda telah berhasil.

ID Pelanggan: 123456789012
Periode: Desember 2023
Tarif: R1/900VA
Tagihan: Rp 245.500
Admin: Rp 2.500
Total: Rp 248.000

Dari: Seabank Fara
Waktu: 2024-01-05 09:15
        `
      },
      {
        title: 'E-commerce Purchase',
        body: `
Pesanan Tokopedia Dibayar

Terima kasih telah berbelanja!

Toko: Elektronik Murah
Produk: Smartphone Samsung A54
Harga: Rp 4.299.000
Ongkir: Rp 15.000
Total: Rp 4.314.000

Dibayar dari: Neobank Wimboro
Tanggal: 2024-01-08
Order ID: TKP2024010812345
        `
      }
    ];
    
    for (const [index, testEmail] of testEmails.entries()) {
      logger.info(`\nTest ${index + 1}: ${testEmail.title}`);
      logger.info('=' .repeat(50));
      
      try {
        const result = await parseEmailWithEnhancedGemini(testEmail.body);
        
        if (result) {
          logger.success('✅ Parsing successful!');
          
          // Display main fields
          logger.info('📊 MAIN TRANSACTION DATA:');
          logger.info(`  💰 Amount: ${result.amount}`);
          logger.info(`  📊 Type: ${result.transaction_type}`);
          logger.info(`  🏦 Bank: ${result.bank || 'Not detected'}`);
          logger.info(`  🏷️  Category: ${result.category}`);
          logger.info(`  📝 Description: ${result.description}`);
          logger.info(`  📅 Date: ${result.date}`);
          logger.info(`  🎯 Confidence: ${result.confidence}%`);
          
          // Display additional info if available
          if (result.additional_info && Object.keys(result.additional_info).length > 0) {
            logger.info('📋 ADDITIONAL INFORMATION:');
            Object.entries(result.additional_info).forEach(([key, value]) => {
              if (value) {
                logger.info(`  ${key}: ${value}`);
              }
            });
          }
          
          // Validation checks
          const validations = [];
          if (result.amount !== null && !isNaN(result.amount)) validations.push('✅ Amount valid');
          if (result.bank && ['Mandiri Wimboro', 'Mandiri Fara', 'Seabank Fara', 'Jago Fara', 'Jago Wimboro', 'Blu Fara', 'Blu Wimboro', 'Neobank Fara', 'Neobank Wimboro'].includes(result.bank)) validations.push('✅ Bank recognized');
          if (result.transaction_type && ['income', 'expense'].includes(result.transaction_type)) validations.push('✅ Transaction type valid');
          if (result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date)) validations.push('✅ Date format valid');
          if (result.confidence && result.confidence >= 70) validations.push('✅ High confidence');
          
          logger.info('🔍 VALIDATIONS:');
          validations.forEach(v => logger.info(`  ${v}`));
          
        } else {
          logger.error('❌ Parsing failed - no result returned');
        }
        
      } catch (error) {
        logger.error(`❌ Error parsing test ${index + 1}:`, error.message);
      }
      
      logger.info(''); // Empty line for separation
    }
    
    logger.separator('Enhanced Gemini Testing Complete');
    
  } catch (error) {
    logger.error('Test initialization failed:', error.message);
    
    if (error.message.includes('GEMINI_API_KEY')) {
      logger.info('💡 Make sure GEMINI_API_KEY is set in your .env file');
    }
  }
}

// Comparison test with original parsing
async function compareWithOriginal() {
  logger.separator('Comparison Test: Enhanced vs Original');
  
  try {
    const { parseEmailWithGemini } = await import('./src/services/geminiService.js');
    
    const testEmail = `
Transfer Berhasil!
Jumlah: Rp 1.000.000
Ke: John Doe  
Dari: Mandiri Wimboro
Tanggal: 15/01/2024
Ref: TRF123456
    `;
    
    logger.info('📧 Test Email:');
    console.log(testEmail);
    
    logger.info('\n🔄 Original Parsing:');
    const originalResult = await parseEmailWithGemini(testEmail);
    console.log(JSON.stringify(originalResult, null, 2));
    
    logger.info('\n🚀 Enhanced Parsing:');
    const enhancedResult = await parseEmailWithEnhancedGemini(testEmail);
    console.log(JSON.stringify(enhancedResult, null, 2));
    
    logger.info('\n📊 Comparison:');
    logger.info(`Original confidence: N/A`);
    logger.info(`Enhanced confidence: ${enhancedResult?.confidence || 'N/A'}%`);
    logger.info(`Additional info: ${enhancedResult?.additional_info ? 'Yes' : 'No'}`);
    
  } catch (error) {
    logger.error('Comparison test failed:', error.message);
  }
}

async function main() {
  await testEnhancedGemini();
  await compareWithOriginal();
}

main().catch(error => {
  logger.error('Test script error:', error);
  process.exit(1);
});