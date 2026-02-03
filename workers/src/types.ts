// Environment bindings for Cloudflare Worker
export interface Env {
  // D1 Database (shared with bebong-dashboard)
  DB: D1Database;

  // KV Namespaces
  OAUTH_TOKENS: KVNamespace;
  CREDENTIALS: KVNamespace;

  // Secrets (set via wrangler secret put)
  GEMINI_API_KEY: string;
  WAHA_BASE_URL: string;
  WAHA_API_KEY: string;

  // Environment variables (set in wrangler.toml)
  GMAIL_ACCOUNTS?: string; // Comma-separated
  GMAIL_SEARCH_QUERY: string;
  GEMINI_MODEL: string;
  WHATSAPP_PHONE_NUMBERS?: string; // Comma-separated
  WHATSAPP_GROUP_ID?: string;
  ENABLE_WHATSAPP_NOTIFICATIONS: string;
  BATCH_NOTIFICATION_THRESHOLD: string;
  WAHA_SESSION_NAME: string;
}

// OAuth token stored in KV (supports multiple formats)
export interface OAuthToken {
  // Standard format
  access_token?: string;
  refresh_token: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
  account_id?: string;
  
  // Python/alternative format
  token?: string;
  expiry?: string;
  scopes?: string[];
  client_id?: string;
  client_secret?: string;
}

// Gmail OAuth credentials stored in KV
export interface GmailOAuthCredentials {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
}

// Database row type (matches bebong-transactions schema)
export interface Transaction {
  id: number;
  date: string;
  amount: number;
  category: string;
  description: string | null;
  bank: string;
  type: "income" | "expense";
  chat_id: string | null; // Used for account_id in email processing
  message_id: string | null; // Used for email_id in email processing
  created_at: string;
  updated_at: string | null;
}

// Input for inserting a transaction
export interface TransactionInput {
  date: string;
  amount: number;
  category: string;
  description: string;
  bank: string;
  type: "income" | "expense";
  email_id?: string;
  account_id?: string;
}

// Parsed email data from Gemini
export interface ParsedEmailData {
  date: string | null;
  amount: number | null;
  category: string | null;
  description: string | null;
  bank: string | null;
  transaction_type: "income" | "expense";
  confidence?: number;
  additional_info?: {
    recipient?: string;
    sender?: string;
    reference_number?: string;
    merchant?: string;
    location?: string;
  };
}

// Gmail message structure
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailMessagePayload;
  internalDate?: string;
}

export interface GmailMessagePayload {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { size: number; data?: string };
  parts?: GmailMessagePayload[];
}

// Gmail list response
export interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

// Gmail labels response
export interface GmailLabelsResponse {
  labels?: Array<{ id: string; name: string; type?: string }>;
}

// Gemini API response
export interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  };
}

// Processing summary
export interface ProcessingSummary {
  accountId: string;
  processed: number;
  duplicates: number;
  errors: number;
}

// WAHA send message response
export interface WAHASendResponse {
  id?: string;
  timestamp?: number;
  status?: string;
}

// Bank configuration (from constants.js)
export interface BankAccount {
  owner: string;
  type: string;
}

export type BankAccounts = Record<string, BankAccount>;
