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
    
    logger.success(`Enhanced Gemini AI initialized with model: ${CONFIG.GEMINI_MODEL}`);
    return genAI;
  } catch (error) {
    logger.error('Error initializing Enhanced Gemini AI:', error.message);
    throw error;
  }
}

/**
 * Enhanced email preprocessing to extract more context
 * @param {string} emailText - Raw email text
 * @returns {Object} - Processed email with extracted context
 */
function preprocessEmail(emailText) {
  if (!emailText) return { text: '', context: {} };
  
  const context = {
    hasNumbers: /\d/.test(emailText),
    hasCurrency: /rp|rupiah|\$|usd/i.test(emailText),
    hasDate: /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/i.test(emailText),
    hasTime: /\d{1,2}:\d{2}/.test(emailText),
    language: emailText.match(/[a-zA-Z]/) ? 'mixed' : 'indonesian',
    emailType: 'unknown'
  };
  
  // Detect email type based on content patterns
  const lowerText = emailText.toLowerCase();
  
  if (lowerText.includes('transfer') || lowerText.includes('kirim')) {
    context.emailType = 'transfer';
  } else if (lowerText.includes('bayar') || lowerText.includes('payment')) {
    context.emailType = 'payment';
  } else if (lowerText.includes('terima') || lowerText.includes('received')) {
    context.emailType = 'receipt';
  } else if (lowerText.includes('tagihan') || lowerText.includes('bill')) {
    context.emailType = 'bill';
  } else if (lowerText.includes('gaji') || lowerText.includes('salary')) {
    context.emailType = 'salary';
  }
  
  // Extract potential amounts
  const amountMatches = emailText.match(/rp\.?\s*[\d,.]+(\.?\d{2})?/gi);
  if (amountMatches) {
    context.detectedAmounts = amountMatches.map(match => 
      match.replace(/[^\d,.]/g, '').replace(/,/g, '')
    );
  }
  
  // Extract potential dates
  const dateMatches = emailText.match(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g);
  if (dateMatches) {
    context.detectedDates = dateMatches;
  }
  
  // Extract potential bank mentions
  context.detectedBanks = [];
  for (const bankName of BANK_NAMES) {
    const bankParts = bankName.toLowerCase().split(' ');
    for (const part of bankParts) {
      if (lowerText.includes(part)) {
        context.detectedBanks.push(bankName);
        break;
      }
    }
  }
  
  return { text: emailText, context };
}

/**
 * Create enhanced prompt based on email context
 * @param {string} emailText - Email content
 * @param {Object} context - Extracted context
 * @returns {string} - Enhanced prompt
 */
function createEnhancedPrompt(emailText, context) {
  const currentDate = new Date().toISOString().split('T')[0];
  const bankList = BANK_NAMES.join(', ');
  
  let promptContext = '';
  
  // Add context-specific instructions
  if (context.emailType !== 'unknown') {
    promptContext += `\nEmail Type Detected: ${context.emailType}\n`;
  }
  
  if (context.detectedAmounts && context.detectedAmounts.length > 0) {
    promptContext += `\nPotential amounts found: ${context.detectedAmounts.join(', ')}\n`;
  }
  
  if (context.detectedBanks && context.detectedBanks.length > 0) {
    promptContext += `\nPotential banks mentioned: ${context.detectedBanks.join(', ')}\n`;
  }
  
  if (context.detectedDates && context.detectedDates.length > 0) {
    promptContext += `\nPotential dates found: ${context.detectedDates.join(', ')}\n`;
  }
  
  return `
You are a financial transaction expert analyzing Indonesian bank notification emails.

EMAIL CONTENT:
"${emailText}"

ANALYSIS CONTEXT:${promptContext}

AVAILABLE BANK ACCOUNTS: ${bankList}
TODAY'S DATE: ${currentDate}

TASK: Extract financial transaction information and return ONLY a valid JSON object with these exact fields:

{
  "amount": number (positive for income, negative for expenses, no currency symbols),
  "category": string (specific category based on transaction type),
  "description": string (clear, concise description of what happened),
  "transaction_type": "income" | "expense",
  "date": "YYYY-MM-DD" (use ${currentDate} if no date found),
  "bank": string (exact match from available banks above, or null),
  "confidence": number (0-100, how confident you are in this analysis),
  "additional_info": {
    "recipient": string (who received money, if applicable),
    "sender": string (who sent money, if applicable),
    "reference_number": string (transaction reference/ID, if found),
    "merchant": string (merchant/store name, if applicable),
    "location": string (transaction location, if found)
  }
}

ENHANCED ANALYSIS RULES:

1. AMOUNT EXTRACTION:
   - Look for patterns: "Rp 1.000.000", "1,000,000", "1.000.000"
   - Consider context: "terima Rp X" = income (+), "bayar Rp X" = expense (-)
   - If multiple amounts, choose the main transaction amount

2. BANK IDENTIFICATION:
   - Match bank names: Mandiri, Seabank, Jago, Blu, Neobank
   - Match owner names: Wimboro, Fara
   - Combine for exact match: "Mandiri Wimboro", "Jago Fara", etc.
   - Look in sender email, subject, and body content

3. CATEGORY INTELLIGENCE:
   PENDAPATAN (amount positif):
   - "Gaji" - untuk gaji bulanan/harian
   - "Bonus" - untuk bonus kerja, THR, insentif  
   - "Komisi" - untuk komisi penjualan, marketing
   - "Dividen" - untuk dividen investasi, saham
   - "Bunga" - untuk bunga bank, deposito
   - "Hadiah" - untuk hadiah dari orang lain
   - "Warisan" - untuk warisan, hibah
   - "Penjualan" - untuk hasil penjualan barang
   - "Refund" - untuk pengembalian uang
   - "Kembalian" - untuk uang kembalian, pengembalian
   - "Cashback" - untuk cashback, reward
   
   PENGELUARAN (amount negatif):
   - "Makanan" - untuk makanan, minuman, restoran
   - "Transportasi" - untuk bensin, parkir, ojek, taksi, bus
   - "Reimburse" - untuk pengeluaran yang akan direimburse
   - "Sedekah" - untuk zakat, sedekah, donasi
   - "Hiburan" - untuk bioskop, game, rekreasi
   - "Pengembangan Keluarga" - untuk pendidikan, kursus, buku
   - "Rumah Tangga" - untuk belanja rumah tangga, listrik, air
   - "Pakaian" - untuk pakaian, sepatu, aksesoris
   - "Kecantikan" - untuk kosmetik, salon, perawatan
   - "Kesehatan" - untuk obat, dokter, rumah sakit
   
   - Choose the MOST SPECIFIC category that matches the transaction context

4. DESCRIPTION ENHANCEMENT:
   - Include key details: who, what, where
   - Examples: "Transfer ke John Doe", "Belanja di Indomaret", "Bayar tagihan PLN"
   - Keep under 100 characters but informative

5. TRANSACTION TYPE LOGIC:
   - Income indicators: terima, dapat, masuk, kredit, gaji, bonus, penjualan
   - Expense indicators: bayar, beli, keluar, debit, transfer ke, kirim
   - Context matters: "transfer masuk" vs "transfer keluar"

6. DATE PARSING:
   - Formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
   - Indonesian months: Januari, Februari, Maret, etc.
   - Relative dates: "kemarin", "hari ini", "minggu lalu"

7. ADDITIONAL INFO EXTRACTION:
   - Look for recipient names, reference numbers, merchant names
   - Extract location information if available
   - Find transaction IDs or reference codes

8. CONFIDENCE SCORING:
   - 90-100: All key fields clearly identified
   - 70-89: Most fields identified, some assumptions made
   - 50-69: Basic information extracted, significant uncertainty
   - Below 50: Very uncertain, may need manual review

IMPORTANT:
- Return ONLY valid JSON, no explanations or markdown
- Set fields to null if truly unclear (don't guess)
- Prioritize accuracy over completeness
- Use Indonesian language context and banking terminology
`;
}

/**
 * Enhanced email parsing with better context understanding
 * @param {string} emailText - Email content to parse
 * @returns {Promise<Object|null>} - Enhanced parsed data or null if parsing failed
 */
export async function parseEmailWithEnhancedGemini(emailText) {
  if (!emailText) {
    logger.warning('No email text to parse');
    return null;
  }
  
  if (!genAI) {
    initializeGemini();
  }
  
  try {
    // Preprocess email to extract context
    const { text, context } = preprocessEmail(emailText);
    logger.debug('Email preprocessing context:', context);
    
    // Create enhanced prompt
    const prompt = createEnhancedPrompt(text, context);
    
    // Send request to Gemini
    const result = await genAI.models.generateContentInternal({
      model: CONFIG.GEMINI_MODEL,
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    });
    
    let responseText = result.candidates[0].content.parts[0].text;
    
    // Clean response
    if (responseText.includes('```json')) {
      responseText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      responseText = responseText.split('```')[1].split('```')[0].trim();
    }
    
    // Parse JSON response
    const parsedData = JSON.parse(responseText);
    
    // Post-processing and validation
    const enhancedData = postProcessParsedData(parsedData, context);
    
    logger.success(`Enhanced parsing completed with ${enhancedData.confidence}% confidence`);
    logger.debug('Enhanced parsed data:', enhancedData);
    
    return enhancedData;
    
  } catch (error) {
    logger.error('Error in enhanced email parsing:', error.message);
    
    if (error instanceof SyntaxError) {
      logger.debug('JSON parse error - response may not be valid JSON');
    }
    
    return null;
  }
}

/**
 * Post-process parsed data with validation and enhancement
 * @param {Object} parsedData - Raw parsed data from Gemini
 * @param {Object} context - Email context from preprocessing
 * @returns {Object} - Enhanced and validated data
 */
function postProcessParsedData(parsedData, context) {
  const enhanced = { ...parsedData };
  
  // Validate and correct amount
  if (enhanced.amount !== null && enhanced.amount !== undefined) {
    let amount = Math.abs(parseFloat(enhanced.amount));
    
    if (enhanced.transaction_type === 'expense') {
      amount = -amount;
    }
    
    enhanced.amount = amount;
  }
  
  // Validate bank name
  if (enhanced.bank && !BANK_NAMES.includes(enhanced.bank)) {
    const bankLower = enhanced.bank.toLowerCase();
    const matchedBank = BANK_NAMES.find(bank => 
      bank.toLowerCase().includes(bankLower) || 
      bankLower.includes(bank.toLowerCase().split(' ')[0])
    );
    
    if (matchedBank) {
      enhanced.bank = matchedBank;
      logger.info(`Corrected bank name to: ${matchedBank}`);
    } else {
      logger.warning(`Unknown bank name: ${enhanced.bank}`);
      enhanced.bank = null;
    }
  }
  
  // Double-check transaction type with bank context
  if (enhanced.bank && enhanced.description) {
    const contextType = determineBankTransactionType(enhanced.bank, enhanced.description);
    if (contextType !== enhanced.transaction_type) {
      logger.info(`Bank context suggests ${contextType}, adjusting from ${enhanced.transaction_type}`);
      enhanced.transaction_type = contextType;
      
      // Reapply amount sign
      if (enhanced.amount !== null) {
        let amount = Math.abs(parseFloat(enhanced.amount));
        if (contextType === 'expense') {
          amount = -amount;
        }
        enhanced.amount = amount;
      }
    }
  }
  
  // Ensure confidence is set
  if (!enhanced.confidence) {
    enhanced.confidence = 70; // Default confidence
  }
  
  // Ensure additional_info exists
  if (!enhanced.additional_info) {
    enhanced.additional_info = {};
  }
  
  return enhanced;
}

/**
 * Test enhanced Gemini connection
 * @returns {Promise<boolean>} - True if connection is successful
 */
export async function testEnhancedGeminiConnection() {
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
    
    logger.success('Enhanced Gemini AI connection test successful');
    return text.toLowerCase().includes('ok');
  } catch (error) {
    logger.error('Enhanced Gemini AI connection test failed:', error.message);
    return false;
  }
}

export { initializeGemini as initializeEnhancedGemini };