import type { Env, TransactionInput, Transaction } from "../types";
import { logger } from "../utils/logger";

/**
 * Insert a transaction into D1
 * Uses the existing bebong-transactions schema
 * Maps email_id -> message_id, account_id -> chat_id
 */
export async function insertTransaction(
  env: Env,
  transaction: TransactionInput
): Promise<{ success: boolean; isDuplicate: boolean; id?: number }> {
  try {
    // Check for duplicate first (based on date, amount, description, bank)
    const existing = await env.DB.prepare(
      `
      SELECT id FROM transactions 
      WHERE date = ? AND amount = ? AND description = ? AND bank = ?
      LIMIT 1
    `
    )
      .bind(
        transaction.date,
        transaction.amount,
        transaction.description,
        transaction.bank
      )
      .first();

    if (existing) {
      logger.debug(`Duplicate found for: ${transaction.description}`);
      return { success: true, isDuplicate: true };
    }

    // Insert new transaction
    const result = await env.DB.prepare(
      `
      INSERT INTO transactions 
      (date, amount, category, description, bank, type, chat_id, message_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
      .bind(
        transaction.date,
        transaction.amount,
        transaction.category,
        transaction.description,
        transaction.bank,
        transaction.type,
        transaction.account_id || "email-processor", // Store in chat_id
        transaction.email_id || null // Store in message_id
      )
      .run();

    logger.success(
      `Inserted transaction: ${transaction.description} (ID: ${result.meta.last_row_id})`
    );

    return {
      success: true,
      isDuplicate: false,
      id: result.meta.last_row_id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("D1 insert error:", message);
    throw error;
  }
}

/**
 * Batch insert multiple transactions with duplicate checking
 */
export async function insertTransactionsBatch(
  env: Env,
  transactions: TransactionInput[]
): Promise<{ inserted: number; duplicates: number; errors: number }> {
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  for (const tx of transactions) {
    try {
      const result = await insertTransaction(env, tx);
      if (result.isDuplicate) {
        duplicates++;
      } else {
        inserted++;
      }
    } catch (error) {
      errors++;
      logger.error(`Failed to insert transaction: ${tx.description}`);
    }
  }

  return { inserted, duplicates, errors };
}

/**
 * Check if a transaction already exists
 */
export async function isDuplicate(
  env: Env,
  date: string,
  amount: number,
  description: string,
  bank: string
): Promise<boolean> {
  const result = await env.DB.prepare(
    `
    SELECT 1 FROM transactions 
    WHERE date = ? AND amount = ? AND description = ? AND bank = ?
    LIMIT 1
  `
  )
    .bind(date, amount, description, bank)
    .first();

  return result !== null;
}

/**
 * Get transactions with optional filters
 */
export async function getTransactions(
  env: Env,
  options: {
    startDate?: string;
    endDate?: string;
    bank?: string;
    category?: string;
    type?: "income" | "expense";
    limit?: number;
    offset?: number;
  } = {}
): Promise<Transaction[]> {
  let query = "SELECT * FROM transactions WHERE 1=1";
  const params: (string | number)[] = [];

  if (options.startDate) {
    query += " AND date >= ?";
    params.push(options.startDate);
  }
  if (options.endDate) {
    query += " AND date <= ?";
    params.push(options.endDate);
  }
  if (options.bank) {
    query += " AND bank = ?";
    params.push(options.bank);
  }
  if (options.category) {
    query += " AND category = ?";
    params.push(options.category);
  }
  if (options.type === "income") {
    query += " AND amount > 0";
  } else if (options.type === "expense") {
    query += " AND amount < 0";
  }

  query += " ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?";
  params.push(options.limit || 100, options.offset || 0);

  const result = await env.DB.prepare(query)
    .bind(...params)
    .all<Transaction>();
  return result.results || [];
}

/**
 * Get balance summary
 */
export async function getBalanceSummary(env: Env): Promise<{
  total_income: number;
  total_expense: number;
  total_balance: number;
  transaction_count: number;
}> {
  const result = await env.DB.prepare(
    `
    SELECT 
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
      SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expense,
      SUM(amount) as total_balance,
      COUNT(*) as transaction_count
    FROM transactions
  `
  ).first<{
    total_income: number;
    total_expense: number;
    total_balance: number;
    transaction_count: number;
  }>();

  return {
    total_income: result?.total_income || 0,
    total_expense: result?.total_expense || 0,
    total_balance: result?.total_balance || 0,
    transaction_count: result?.transaction_count || 0,
  };
}

/**
 * Test D1 connection
 */
export async function testD1Connection(env: Env): Promise<boolean> {
  try {
    const result = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM transactions"
    ).first<{ count: number }>();
    logger.success(
      `D1 connection OK. ${result?.count || 0} transactions in database.`
    );
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("D1 connection failed:", message);
    return false;
  }
}
