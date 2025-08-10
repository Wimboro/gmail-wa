#!/usr/bin/env node

import { parseEmailWithEnhancedGemini, initializeEnhancedGemini } from './src/services/enhancedGeminiService.js';
import { logger } from './utils/logger.js';

/**
 * Test enhanced categories for income and expense
 */

async function testEnhancedCategories() {
  logger.separator('Testing Enhanced Categories');
  
  try {
    await initializeEnhancedGemini();
    
    // Test cases for PENDAPATAN (Income) categories
    const incomeTests = [
      {
        category: 'Gaji',
        email: 'Gaji bulan Januari 2024 sebesar Rp 8.500.000 telah ditransfer ke rekening Mandiri Wimboro'
      },
      {
        category: 'Bonus', 
        email: 'Bonus kinerja Q4 2023 Rp 2.000.000 telah diterima di Jago Fara tanggal 15 Januari 2024'
      },
      {
        category: 'Komisi',
        email: 'Komisi penjualan bulan Desember Rp 1.500.000 masuk ke Blu Wimboro'
      },
      {
        category: 'Dividen',
        email: 'Dividen saham BBCA Rp 500.000 diterima di rekening Seabank Fara'
      },
      {
        category: 'Bunga',
        email: 'Bunga deposito 6 bulan Rp 750.000 masuk ke Neobank Wimboro'
      },
      {
        category: 'Hadiah',
        email: 'Hadiah ulang tahun dari Papa Rp 1.000.000 transfer ke Mandiri Fara'
      },
      {
        category: 'Penjualan',
        email: 'Penjualan laptop bekas Rp 6.500.000 via transfer ke Jago Wimboro'
      },
      {
        category: 'Refund',
        email: 'Refund pembelian Tokopedia Rp 299.000 kembali ke Blu Fara'
      },
      {
        category: 'Cashback',
        email: 'Cashback OVO Rp 50.000 masuk ke Seabank Wimboro'
      }
    ];
    
    // Test cases for PENGELUARAN (Expense) categories  
    const expenseTests = [
      {
        category: 'Makanan',
        email: 'Pembayaran QRIS Warung Bu Sari Rp 35.000 dari Jago Fara'
      },
      {
        category: 'Transportasi', 
        email: 'Isi bensin Shell Rp 200.000 bayar dari Mandiri Wimboro'
      },
      {
        category: 'Reimburse',
        email: 'Bayar makan klien Rp 150.000 untuk reimburse kantor dari Blu Fara'
      },
      {
        category: 'Sedekah',
        email: 'Zakat fitrah Rp 35.000 transfer ke masjid dari Seabank Wimboro'
      },
      {
        category: 'Hiburan',
        email: 'Tiket bioskop CGV Rp 85.000 bayar dari Neobank Fara'
      },
      {
        category: 'Pengembangan Keluarga',
        email: 'Les bahasa Inggris anak Rp 500.000 transfer dari Mandiri Wimboro'
      },
      {
        category: 'Rumah Tangga',
        email: 'Belanja bulanan Indomaret Rp 750.000 dari Jago Fara'
      },
      {
        category: 'Pakaian',
        email: 'Beli sepatu Nike Rp 1.200.000 di Zalora dari Blu Wimboro'
      },
      {
        category: 'Kecantikan',
        email: 'Treatment facial Rp 300.000 di salon dari Seabank Fara'
      },
      {
        category: 'Kesehatan',
        email: 'Bayar dokter spesialis Rp 400.000 dari Neobank Wimboro'
      }
    ];
    
    logger.info('🔹 TESTING PENDAPATAN CATEGORIES:');
    logger.info('=' .repeat(60));
    
    for (const test of incomeTests) {
      logger.info(`\n📈 Expected: ${test.category}`);
      logger.debug(`Email: "${test.email.substring(0, 80)}..."`);
      
      try {
        const result = await parseEmailWithEnhancedGemini(test.email);
        
        if (result) {
          const isCorrectCategory = result.category === test.category;
          const isCorrectType = result.transaction_type === 'income';
          const isPositiveAmount = result.amount > 0;
          
          logger.info(`📊 Result: ${result.category} ${isCorrectCategory ? '✅' : '❌'}`);
          logger.info(`💰 Amount: ${result.amount} ${isPositiveAmount ? '✅' : '❌'}`);
          logger.info(`📊 Type: ${result.transaction_type} ${isCorrectType ? '✅' : '❌'}`);
          logger.info(`🏦 Bank: ${result.bank || 'Not detected'}`);
          logger.info(`🎯 Confidence: ${result.confidence}%`);
          
          if (isCorrectCategory && isCorrectType && isPositiveAmount) {
            logger.success('🎉 PERFECT MATCH!');
          } else {
            logger.warning('⚠️  Needs improvement');
          }
        } else {
          logger.error('❌ Parsing failed');
        }
        
      } catch (error) {
        logger.error(`Error: ${error.message}`);
      }
    }
    
    logger.info('\n🔸 TESTING PENGELUARAN CATEGORIES:');
    logger.info('=' .repeat(60));
    
    for (const test of expenseTests) {
      logger.info(`\n📉 Expected: ${test.category}`);
      logger.debug(`Email: "${test.email.substring(0, 80)}..."`);
      
      try {
        const result = await parseEmailWithEnhancedGemini(test.email);
        
        if (result) {
          const isCorrectCategory = result.category === test.category;
          const isCorrectType = result.transaction_type === 'expense';
          const isNegativeAmount = result.amount < 0;
          
          logger.info(`📊 Result: ${result.category} ${isCorrectCategory ? '✅' : '❌'}`);
          logger.info(`💰 Amount: ${result.amount} ${isNegativeAmount ? '✅' : '❌'}`);
          logger.info(`📊 Type: ${result.transaction_type} ${isCorrectType ? '✅' : '❌'}`);
          logger.info(`🏦 Bank: ${result.bank || 'Not detected'}`);
          logger.info(`🎯 Confidence: ${result.confidence}%`);
          
          if (isCorrectCategory && isCorrectType && isNegativeAmount) {
            logger.success('🎉 PERFECT MATCH!');
          } else {
            logger.warning('⚠️  Needs improvement');
          }
        } else {
          logger.error('❌ Parsing failed');
        }
        
      } catch (error) {
        logger.error(`Error: ${error.message}`);
      }
    }
    
    logger.separator('Category Testing Complete');
    
  } catch (error) {
    logger.error('Test initialization failed:', error.message);
  }
}

// Test category mapping accuracy
async function testCategoryAccuracy() {
  logger.separator('Category Accuracy Summary');
  
  try {
    const mixedTests = [
      { text: 'Gaji PT ABC Rp 5.000.000', expected: 'Gaji', type: 'income' },
      { text: 'Beli baju di mall Rp 500.000', expected: 'Pakaian', type: 'expense' },
      { text: 'Dividen BCA Rp 200.000', expected: 'Dividen', type: 'income' },
      { text: 'Makan siang KFC Rp 75.000', expected: 'Makanan', type: 'expense' },
      { text: 'Cashback Shopee Rp 25.000', expected: 'Cashback', type: 'income' },
      { text: 'Bayar listrik PLN Rp 350.000', expected: 'Rumah Tangga', type: 'expense' },
      { text: 'Komisi sales Rp 800.000', expected: 'Komisi', type: 'income' },
      { text: 'Sedekah masjid Rp 100.000', expected: 'Sedekah', type: 'expense' }
    ];
    
    let correctCategories = 0;
    let correctTypes = 0;
    let total = mixedTests.length;
    
    for (const test of mixedTests) {
      try {
        const result = await parseEmailWithEnhancedGemini(test.text + ' dari Mandiri Wimboro');
        
        if (result) {
          if (result.category === test.expected) correctCategories++;
          if (result.transaction_type === test.type) correctTypes++;
          
          logger.info(`"${test.text}"`);
          logger.info(`  Expected: ${test.expected} (${test.type})`);
          logger.info(`  Got: ${result.category} (${result.transaction_type})`);
          logger.info(`  Match: ${result.category === test.expected ? '✅' : '❌'}`);
          logger.info('');
        }
      } catch (error) {
        logger.error(`Error testing: ${test.text}`);
      }
    }
    
    const categoryAccuracy = Math.round((correctCategories / total) * 100);
    const typeAccuracy = Math.round((correctTypes / total) * 100);
    
    logger.separator('Accuracy Results');
    logger.info(`📊 Category Accuracy: ${correctCategories}/${total} (${categoryAccuracy}%)`);
    logger.info(`📊 Transaction Type Accuracy: ${correctTypes}/${total} (${typeAccuracy}%)`);
    
    if (categoryAccuracy >= 80 && typeAccuracy >= 90) {
      logger.success('🎉 Excellent accuracy! Categories are working well.');
    } else if (categoryAccuracy >= 60 && typeAccuracy >= 80) {
      logger.info('✅ Good accuracy. Some fine-tuning may be needed.');
    } else {
      logger.warning('⚠️  Accuracy needs improvement. Review category logic.');
    }
    
  } catch (error) {
    logger.error('Accuracy test failed:', error.message);
  }
}

async function main() {
  await testEnhancedCategories();
  await testCategoryAccuracy();
}

main().catch(error => {
  logger.error('Test script error:', error);
  process.exit(1);
});