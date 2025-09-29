import { GoogleGenAI } from '@google/genai';
import { CONFIG, BANK_NAMES, BANK_ACCOUNTS, determineBankTransactionType } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

let genAI = null;

/**
 * Initialize Gemini AI client
 * @returns {GoogleGenAI} - Initialized Gemini client
 */
export function initializeGemini() {
  try {
    if (!CONFIG.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    
    genAI = new GoogleGenAI({
      apiKey: CONFIG.GEMINI_API_KEY
    });
    
    logger.success(`Gemini AI initialized with model: ${CONFIG.GEMINI_MODEL}`);
    return genAI;
  } catch (error) {
    logger.error('Error initializing Gemini AI:', error.message);
    throw error;
  }
}

/**
 * Parse email content using Gemini to extract financial transaction data
 * @param {string} emailText - Email content to parse
 * @returns {Promise<Object|null>} - Dictionary containing extracted fields or null if parsing failed
 */
export async function parseEmailWithGemini(emailText) {
  if (!emailText) {
    logger.warning('No email text to parse');
    return null;
  }
  
  if (!genAI) {
    initializeGemini();
  }
  
  try {
    // Get current date for reference
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Get bank names for context
    const bankList = BANK_NAMES.join(', ');
    
    // Create a detailed prompt for Gemini
    const prompt = `
Extract financial information from this Indonesian text: "${emailText}"
Today's date is ${currentDate}.

Available bank accounts: ${bankList}

Return a JSON object with these fields:
- amount: the monetary amount (numeric value only, without currency symbols)
- category: the spending/income category
- description: brief description of the transaction
- transaction_type: "income" if this is money received, or "expense" if this is money spent
- date: the date of the transaction in YYYY-MM-DD format
- bank: the bank account name from the available list above (exact match required)

For the date field, if no specific date is mentioned, use today's date (${currentDate}).

For the bank field, identify which bank account is mentioned in the text. Look for bank names like:
- Mandiri, Seabank, Jago, Blu, Neobank
- And owner names like Wimboro or Fara
- Match to the exact format from the available bank accounts list above

For transaction_type, analyze the context carefully:
- INCOME indicators (set to "income"): "terima", "dapat", "pemasukan", "masuk", "diterima", "gaji", "bonus", "transfer masuk", "kredit", etc.
- EXPENSE indicators (set to "expense"): "beli", "bayar", "belanja", "pengeluaran", "keluar", "dibayar", "transfer keluar", "debit", etc.

Context for bank transactions:
- If money comes TO the bank account = "income" (positive amount)
- If money goes FROM the bank account = "expense" (negative amount)

For category, try to identify specific categories like:
- Income category: "Gaji", "Bonus", "Komisi", "Investasi", "Hadiah", "Penjualan", "Refund", "Kembalian", "Cashback"
- Expense category: "Sedekah", "Makanan", "Transportasi", "Reimburse", "Hiburan", "Kesehatan", "Rumah Tangga", "Pakaian", "Kecantikan", "Pengembangan Keluarga"

If any field is unclear, set it to null.

Return only valid JSON, no additional text or formatting.
    `;
    
    // Send request to Gemini using the @google/genai API
    const result = await genAI.models.generateContentInternal({
      model: CONFIG.GEMINI_MODEL,
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    });
    
    let responseText = result.candidates[0].content.parts[0].text;
    
    // Clean the response in case it contains markdown code blocks
    if (responseText.includes('```json')) {
      responseText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      responseText = responseText.split('```')[1].split('```')[0].trim();
    }
    
    // Parse the JSON response
    const parsedData = JSON.parse(responseText);
    
    // Process the amount based on transaction type to ensure correct sign
    if (parsedData.amount !== null && parsedData.amount !== undefined) {
      // Convert amount to float and ensure proper sign
      let amount = Math.abs(parseFloat(parsedData.amount));
      
      // Apply sign based on transaction type
      if (parsedData.transaction_type === 'expense') {
        amount = -amount;
      }
      
      parsedData.amount = amount;
    }
    
    logger.success('Successfully parsed email data with Gemini AI');
    logger.debug('Parsed data:', parsedData);
    
    return parsedData;
    
  } catch (error) {
    logger.error('Error parsing email with Gemini:', error.message);
    
    // Log the response text for debugging if it's a JSON parse error
    if (error instanceof SyntaxError) {
      logger.debug('Failed to parse response as JSON. Raw response might be logged above.');
    }
    
    return null;
  }
}

/**
 * Test Gemini connection
 * @returns {Promise<boolean>} - True if connection is successful
 */
export async function testGeminiConnection() {
  try {
    if (!genAI) {
      initializeGemini();
    }
    
    const testPrompt = 'Respond with just the word "OK" if you can understand this message.';
    const result = await genAI.models.generateContentInternal({
      model: CONFIG.GEMINI_MODEL,
      contents: [{
        role: 'user',
        parts: [{ text: testPrompt }]
      }]
    });
    
    const text = result.candidates[0].content.parts[0].text.trim();
    
    logger.success('Gemini AI connection test successful');
    return text.toLowerCase().includes('ok');
  } catch (error) {
    logger.error('Gemini AI connection test failed:', error.message);
    return false;
  }
} 