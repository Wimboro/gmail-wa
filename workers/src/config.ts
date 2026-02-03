import type { Env, BankAccounts } from "./types";

// Bank Configuration (from original constants.js)
export const BANK_ACCOUNTS: BankAccounts = {
  "Mandiri Wimboro": { owner: "Wimboro", type: "Mandiri" },
  "Mandiri Fara": { owner: "Fara", type: "Mandiri" },
  "Seabank Fara": { owner: "Fara", type: "Seabank" },
  "Jago Fara": { owner: "Fara", type: "Jago" },
  "Jago Wimboro": { owner: "Wimboro", type: "Jago" },
  "Blu Fara": { owner: "Fara", type: "Blu" },
  "Blu Wimboro": { owner: "Wimboro", type: "Blu" },
  "Neobank Fara": { owner: "Fara", type: "Neobank" },
  "Neobank Wimboro": { owner: "Wimboro", type: "Neobank" },
};

export const BANK_NAMES = Object.keys(BANK_ACCOUNTS);

// Helper to get config from env with defaults
export function getConfig(env: Env) {
  return {
    // Gmail
    GMAIL_ACCOUNTS: env.GMAIL_ACCOUNTS?.split(",").map((e) => e.trim()) || [
      "default",
    ],
    GMAIL_SEARCH_QUERY:
      env.GMAIL_SEARCH_QUERY ||
      "subject:(Transfer OR Pembayaran) is:unread newer_than:1d",

    // Gemini
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    GEMINI_MODEL: env.GEMINI_MODEL || "gemini-2.0-flash",

    // WhatsApp
    WHATSAPP_PHONE_NUMBERS:
      env.WHATSAPP_PHONE_NUMBERS?.split(",").map((n) => n.trim()) || [],
    WHATSAPP_GROUP_ID: env.WHATSAPP_GROUP_ID || "",
    ENABLE_WHATSAPP_NOTIFICATIONS:
      env.ENABLE_WHATSAPP_NOTIFICATIONS === "true",
    BATCH_NOTIFICATION_THRESHOLD:
      parseInt(env.BATCH_NOTIFICATION_THRESHOLD) || 5,
    WAHA_BASE_URL: env.WAHA_BASE_URL || "",
    WAHA_API_KEY: env.WAHA_API_KEY || "",
    WAHA_SESSION_NAME: env.WAHA_SESSION_NAME || "gmail-wa-bot",
  };
}

/**
 * Determine if transaction is income or expense based on bank context
 */
export function determineBankTransactionType(
  bankName: string,
  transactionText: string
): "income" | "expense" {
  const lowerText = transactionText.toLowerCase();

  // Income indicators when money comes TO our bank
  const incomeKeywords = [
    "terima",
    "dapat",
    "pemasukan",
    "masuk",
    "diterima",
    "gaji",
    "bonus",
    "transfer masuk",
    "kredit",
    "setoran",
    "received",
    "credit",
    "deposit",
    "hadiah",
  ];

  // Expense indicators when money goes FROM our bank
  const expenseKeywords = [
    "beli",
    "bayar",
    "belanja",
    "pengeluaran",
    "keluar",
    "dibayar",
    "transfer keluar",
    "debit",
    "tarik",
    "withdraw",
    "payment",
    "purchase",
  ];

  // Special cases that need context-based interpretation
  if (lowerText.includes("pembayaran")) {
    if (
      lowerText.includes("kartu kredit") ||
      lowerText.includes("credit card") ||
      lowerText.includes("qris") ||
      lowerText.includes("untuk") ||
      lowerText.includes("tagihan") ||
      lowerText.includes("bayar")
    ) {
      return "expense";
    }
    return "income";
  }

  // "penjualan" is typically income
  if (lowerText.includes("penjualan") || lowerText.includes("jual")) {
    return "income";
  }

  // Check for income indicators
  for (const keyword of incomeKeywords) {
    if (lowerText.includes(keyword)) {
      return "income";
    }
  }

  // Check for expense indicators
  for (const keyword of expenseKeywords) {
    if (lowerText.includes(keyword)) {
      return "expense";
    }
  }

  // Default to expense if unclear
  return "expense";
}

/**
 * Validate required configuration
 */
export function validateConfig(env: Env): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!env.GEMINI_API_KEY) {
    errors.push("GEMINI_API_KEY secret is not set");
  }

  const config = getConfig(env);

  if (config.ENABLE_WHATSAPP_NOTIFICATIONS) {
    if (!env.WAHA_BASE_URL) {
      errors.push("WAHA_BASE_URL secret is required for WhatsApp notifications");
    }
    if (!env.WAHA_API_KEY) {
      errors.push("WAHA_API_KEY secret is required for WhatsApp notifications");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
