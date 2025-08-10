#!/usr/bin/env node

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testGenAI() {
  console.log('🧪 Testing @google/genai package...');
  
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.log('❌ GEMINI_API_KEY not found in environment variables');
      console.log('Please set GEMINI_API_KEY in your .env file');
      return;
    }
    
    console.log('✅ API key found');
    
    // Initialize the client
    const genAI = new GoogleGenAI({
      apiKey: apiKey
    });
    console.log('✅ GoogleGenAI client initialized');
    
    const modelName = 'gemini-2.0-flash';
    console.log(`✅ Using model: ${modelName}`);
    
    // Test a simple request
    console.log('🔄 Testing API call...');
    const result = await genAI.models.generateContentInternal({
      model: modelName,
      contents: [{
        role: 'user',
        parts: [{ text: 'Say "Hello from @google/genai!" if you can understand this.' }]
      }]
    });
    
    const response = result.candidates[0].content.parts[0].text;
    
    console.log('✅ API call successful!');
    console.log('📝 Response:', response);
    
    // Test with Indonesian financial text (similar to our use case)
    console.log('\n🔄 Testing Indonesian financial text parsing...');
    const financialTest = await genAI.models.generateContentInternal({
      model: modelName,
      contents: [{
        role: 'user',
        parts: [{ text: `
Extract financial information from this Indonesian text: "Transfer masuk Rp 1.500.000 dari PT ABC untuk gaji bulan Januari 2024"

Return a JSON object with these fields:
- amount: the monetary amount (numeric value only)
- category: the spending/income category
- description: brief description
- transaction_type: "income" or "expense"
- date: today's date in YYYY-MM-DD format

Return only valid JSON.
        ` }]
      }]
    });
    
    const financialResponse = financialTest.candidates[0].content.parts[0].text;
    console.log('✅ Financial parsing test successful!');
    console.log('📝 Financial Response:', financialResponse);
    
    console.log('\n🎉 All tests passed! @google/genai is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('API_KEY')) {
      console.log('💡 Make sure your GEMINI_API_KEY is valid');
    }
    
    if (error.message.includes('quota')) {
      console.log('💡 You might have exceeded your API quota');
    }
    
    if (error.message.includes('model')) {
      console.log('💡 The model name might be incorrect');
    }
    
    // Log more details for debugging
    console.log('🔍 Error details:', error);
  }
}

// Run the test
testGenAI(); 