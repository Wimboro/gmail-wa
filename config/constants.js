import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Gmail Configuration
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
];

export const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets'
];

// File paths
export const CREDENTIALS_FILE = 'credentials.json';
export const SA_CREDENTIALS_FILE = 'sa-credentials.json';
export const TOKEN_FILE_TEMPLATE = 'token_{}.json';

// Environment variables with defaults
export const CONFIG = {
  // Gmail
  GMAIL_ACCOUNTS: process.env.GMAIL_ACCOUNTS?.split(',').map(email => email.trim()) || ['default'],
  GMAIL_SEARCH_QUERY: process.env.GMAIL_SEARCH_QUERY || 
    'subject:(Transfer OR Pembayaran OR Transaksi OR payment OR transaction) is:unread newer_than:1d',
  
  // Google Sheets
  SPREADSHEET_ID: process.env.SPREADSHEET_ID || '',
  SHEET_RANGE: 'Sheet1!A1',
  
  // Gemini AI
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  
  // WhatsApp
  WHATSAPP_PHONE_NUMBERS: process.env.WHATSAPP_PHONE_NUMBERS?.split(',').map(num => num.trim()) || [],
  WHATSAPP_GROUP_ID: process.env.WHATSAPP_GROUP_ID || '',
  ENABLE_WHATSAPP_NOTIFICATIONS: process.env.ENABLE_WHATSAPP_NOTIFICATIONS === 'true',
  BATCH_NOTIFICATION_THRESHOLD: parseInt(process.env.BATCH_NOTIFICATION_THRESHOLD) || 5,
  
  // Application
  PROCESSOR_USER_ID: process.env.PROCESSOR_USER_ID || 'email-processor-main',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Continuous Mode
  EMAIL_CHECK_INTERVAL_MINUTES: parseInt(process.env.EMAIL_CHECK_INTERVAL_MINUTES) || 5
};

// Bank Configuration
export const BANK_ACCOUNTS = {
  'Mandiri Wimboro': { owner: 'Wimboro', type: 'Mandiri' },
  'Mandiri Fara': { owner: 'Fara', type: 'Mandiri' },
  'Seabank Fara': { owner: 'Fara', type: 'Seabank' },
  'Jago Fara': { owner: 'Fara', type: 'Jago' },
  'Jago Wimboro': { owner: 'Wimboro', type: 'Jago' },
  'Blu Fara': { owner: 'Fara', type: 'Blu' },
  'Blu Wimboro': { owner: 'Wimboro', type: 'Blu' },
  'Neobank Fara': { owner: 'Fara', type: 'Neobank' },
  'Neobank Wimboro': { owner: 'Wimboro', type: 'Neobank' }
};

// Get list of all bank names
export const BANK_NAMES = Object.keys(BANK_ACCOUNTS);

/**
 * Determine if transaction is income or expense based on bank context
 * @param {string} bankName - Name of the bank
 * @param {string} transactionText - Transaction description text
 * @returns {string} - 'income' or 'expense'
 */
export function determineBankTransactionType(bankName, transactionText) {
  const lowerText = transactionText.toLowerCase();
  
  // Income indicators when money comes TO our bank
  const incomeKeywords = [
    'terima', 'dapat', 'pemasukan', 'masuk', 'diterima', 'gaji', 'bonus',
    'transfer masuk', 'kredit', 'setoran', 'received', 'credit', 'deposit', 'hadiah'
  ];
  
  // Expense indicators when money goes FROM our bank
  const expenseKeywords = [
    'beli', 'bayar', 'belanja', 'pengeluaran', 'keluar', 'dibayar',
    'transfer keluar', 'debit', 'tarik', 'withdraw', 'payment', 'purchase'
  ];
  
  // Special cases that need context-based interpretation
  // "pembayaran" could be income (receiving payment) or expense (making payment)
  if (lowerText.includes('pembayaran')) {
    // These are typically expenses (making payments)
    if (lowerText.includes('kartu kredit') || lowerText.includes('credit card') ||
        lowerText.includes('qris') || lowerText.includes('untuk') || 
        lowerText.includes('tagihan') || lowerText.includes('bayar')) {
      return 'expense';
    }
    // Otherwise could be receiving payment, so default to income
    return 'income';
  }
  
  // "penjualan" is typically income (selling something = receiving money)
  if (lowerText.includes('penjualan') || lowerText.includes('jual')) {
    return 'income';
  }
  
  // Check for income indicators
  for (const keyword of incomeKeywords) {
    if (lowerText.includes(keyword)) {
      return 'income';
    }
  }
  
  // Check for expense indicators  
  for (const keyword of expenseKeywords) {
    if (lowerText.includes(keyword)) {
      return 'expense';
    }
  }
  
  // Default to expense if unclear
  return 'expense';
}

// Validation
export const validateConfig = () => {
  const required = [
    'GEMINI_API_KEY',
    'SPREADSHEET_ID'
  ];
  
  const missing = required.filter(key => !CONFIG[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (CONFIG.GMAIL_ACCOUNTS.length === 0) {
    throw new Error('At least one Gmail account must be specified');
  }
  
  console.log('✅ Configuration validated successfully');
  return true;
}; 