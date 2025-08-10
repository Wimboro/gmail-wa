#!/usr/bin/env node

import { parseEmailWithGemini, initializeGemini } from './src/services/geminiService.js';
import { createDataRow, getHeaderRow, isDuplicate } from './src/services/sheetsService.js';
import { logger } from './utils/logger.js';

/**
 * Test script untuk memverifikasi struktur data baru
 */

function testDataStructure() {
  logger.separator('Testing New Data Structure');
  
  try {
    // Test 1: Header row structure
    logger.info('Test 1: Header row structure');
    const headers = getHeaderRow();
    logger.info('Headers:', headers);
    
    const expectedHeaders = ['Date', 'Amount', 'Category', 'Description', 'Bank', 'Timestamp'];
    const headersMatch = JSON.stringify(headers) === JSON.stringify(expectedHeaders);
    
    if (headersMatch) {
      logger.success('✅ Header structure is correct');
    } else {
      logger.error('❌ Header structure mismatch');
      logger.error('Expected:', expectedHeaders);
      logger.error('Got:', headers);
      return false;
    }
    
    // Test 2: Sample parsed data structure
    logger.info('\nTest 2: Sample parsed data structure');
    const sampleParsedData = {
      date: '2024-01-15',
      amount: -25000,
      category: 'Makanan',
      description: 'Pembayaran QRIS Warung Makan',
      bank: 'Jago Fara',
      transaction_type: 'expense'
    };
    
    logger.info('Sample parsed data:', sampleParsedData);
    
    // Test 3: Entry object creation
    logger.info('\nTest 3: Entry object creation (as used in emailProcessor)');
    const entry = {
      date: sampleParsedData.date || new Date().toISOString().split('T')[0],
      amount: sampleParsedData.amount || 0,
      category: sampleParsedData.category || 'Lainnya',
      description: sampleParsedData.description || '',
      bank: sampleParsedData.bank || ''
    };
    
    logger.info('Entry object:', entry);
    
    // Validate entry has all required fields
    const requiredFields = ['date', 'amount', 'category', 'description', 'bank'];
    const missingFields = requiredFields.filter(field => !(field in entry));
    
    if (missingFields.length === 0) {
      logger.success('✅ Entry object has all required fields');
    } else {
      logger.error('❌ Entry object missing fields:', missingFields);
      return false;
    }
    
    // Test 4: createDataRow function
    logger.info('\nTest 4: createDataRow function');
    const dataRow = createDataRow(entry);
    logger.info('Data row:', dataRow);
    
    // Validate data row structure
    if (dataRow.length === 6) {
      logger.success('✅ Data row has correct number of columns (6)');
      
      // Map row to headers for clarity
      const mappedRow = {};
      headers.forEach((header, index) => {
        mappedRow[header] = dataRow[index];
      });
      logger.info('Mapped row:', mappedRow);
      
      // Validate bank field is not empty for our sample
      if (mappedRow.Bank === 'Jago Fara') {
        logger.success('✅ Bank field is correctly populated');
      } else {
        logger.error('❌ Bank field not correctly populated');
        logger.error('Expected: Jago Fara, Got:', mappedRow.Bank);
        return false;
      }
      
    } else {
      logger.error('❌ Data row has incorrect number of columns');
      logger.error('Expected: 6, Got:', dataRow.length);
      return false;
    }
    
    // Test 5: Duplicate checking with bank field
    logger.info('\nTest 5: Duplicate checking with bank field');
    
    const existingEntries = [
      {
        date: '2024-01-15',
        amount: '-25000',
        category: 'Makanan',
        description: 'Pembayaran QRIS Warung Makan',
        bank: 'Jago Fara',
        timestamp: '2024-01-15 10:30:00'
      }
    ];
    
    // Test duplicate (should return true)
    const isDupe1 = isDuplicate(entry, existingEntries);
    if (isDupe1) {
      logger.success('✅ Duplicate detection works correctly (detected duplicate)');
    } else {
      logger.error('❌ Duplicate detection failed (should detect duplicate)');
      return false;
    }
    
    // Test non-duplicate with different bank (should return false)
    const entryDifferentBank = { ...entry, bank: 'Mandiri Wimboro' };
    const isDupe2 = isDuplicate(entryDifferentBank, existingEntries);
    if (!isDupe2) {
      logger.success('✅ Duplicate detection works correctly (different bank = not duplicate)');
    } else {
      logger.error('❌ Duplicate detection failed (different bank should not be duplicate)');
      return false;
    }
    
    // Test 6: Validate field mapping consistency
    logger.info('\nTest 6: Field mapping consistency');
    
    const headerMap = {
      'Date': 0,
      'Amount': 1,
      'Category': 2,
      'Description': 3,
      'Bank': 4,
      'Timestamp': 5
    };
    
    let mappingConsistent = true;
    Object.entries(headerMap).forEach(([header, index]) => {
      if (headers[index] !== header) {
        logger.error(`❌ Header mapping inconsistent at index ${index}: expected ${header}, got ${headers[index]}`);
        mappingConsistent = false;
      }
    });
    
    if (mappingConsistent) {
      logger.success('✅ Header mapping is consistent');
    } else {
      return false;
    }
    
    logger.separator('All Tests Passed! ✅');
    logger.success('🎉 Data structure is correctly updated for new spreadsheet format');
    
    return true;
    
  } catch (error) {
    logger.error('Test failed with error:', error.message);
    return false;
  }
}

async function testWithGeminiParsing() {
  logger.separator('Testing with Gemini AI Parsing');
  
  try {
    // Initialize Gemini (if API key is available)
    try {
      await initializeGemini();
      logger.success('✅ Gemini AI initialized');
    } catch (error) {
      logger.warning('⚠️  Gemini AI not available (no API key), skipping AI parsing test');
      return true;
    }
    
    // Test sample email parsing
    const sampleEmail = 'Transfer masuk dari PT Gajah Rp 5.000.000 ke rekening Mandiri Wimboro tanggal 2024-01-15';
    
    logger.info('Testing email parsing with sample text:');
    logger.info(`"${sampleEmail}"`);
    
    const parsedData = await parseEmailWithGemini(sampleEmail);
    
    if (parsedData) {
      logger.success('✅ Gemini parsing successful');
      logger.info('Parsed data:', parsedData);
      
      // Validate parsed data has bank field
      if (parsedData.bank) {
        logger.success(`✅ Bank field detected: ${parsedData.bank}`);
      } else {
        logger.warning('⚠️  Bank field not detected in parsed data');
      }
      
      // Create entry from parsed data
      const entry = {
        date: parsedData.date || new Date().toISOString().split('T')[0],
        amount: parsedData.amount || 0,
        category: parsedData.category || 'Lainnya',
        description: parsedData.description || '',
        bank: parsedData.bank || ''
      };
      
      logger.info('Entry from parsed data:', entry);
      
      // Create data row
      const dataRow = createDataRow(entry);
      logger.info('Final data row for spreadsheet:', dataRow);
      
      logger.success('✅ End-to-end parsing test successful');
      
    } else {
      logger.error('❌ Gemini parsing failed');
      return false;
    }
    
    return true;
    
  } catch (error) {
    logger.error('Gemini parsing test failed:', error.message);
    return false;
  }
}

async function main() {
  logger.separator('Data Structure Validation Tests');
  
  const structureTest = testDataStructure();
  
  if (structureTest) {
    logger.info('\n🔄 Running Gemini AI integration test...');
    const geminiTest = await testWithGeminiParsing();
    
    if (geminiTest) {
      logger.separator('All Tests Completed Successfully! 🎉');
      logger.success('✅ Data structure is ready for the new spreadsheet format');
      logger.info('💡 You can now run your main application with confidence');
    } else {
      logger.warning('⚠️  Structure tests passed but Gemini integration has issues');
    }
  } else {
    logger.error('❌ Structure validation failed');
    logger.info('💡 Please check the error messages above and fix the issues');
  }
}

main().catch(error => {
  logger.error('Test script error:', error);
  process.exit(1);
});