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