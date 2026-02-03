import type { Env, ParsedEmailData, GeminiResponse } from "../types";
import { getConfig, BANK_NAMES, determineBankTransactionType } from "../config";
import { logger } from "../utils/logger";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Parse email content using Gemini to extract financial transaction data
 */
export async function parseEmailWithGemini(
  env: Env,
  emailText: string
): Promise<ParsedEmailData | null> {
  if (!emailText) {
    logger.warning("No email text to parse");
    return null;
  }

  const config = getConfig(env);

  if (!config.GEMINI_API_KEY) {
    logger.error("GEMINI_API_KEY is not configured");
    return null;
  }

  try {
    const currentDate = new Date().toISOString().split("T")[0];
    const bankList = BANK_NAMES.join(", ");

    const prompt = createEnhancedPrompt(emailText, currentDate, bankList);

    const apiUrl = `${GEMINI_API_BASE}/${config.GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Gemini API failed: ${response.status} ${errorText}`);
      return null;
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      logger.error("No response text from Gemini");
      return null;
    }

    // Parse JSON from response
    const parsedData = parseGeminiResponse(text);

    if (!parsedData) {
      return null;
    }

    // Post-process and validate
    const enhancedData = postProcessParsedData(parsedData, emailText);

    logger.success(`Parsed email with ${enhancedData.confidence || 70}% confidence`);
    return enhancedData;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Error parsing email with Gemini:", message);
    return null;
  }
}

/**
 * Create enhanced prompt for Gemini
 */
function createEnhancedPrompt(
  emailText: string,
  currentDate: string,
  bankList: string
): string {
  return `
You are a financial transaction expert analyzing Indonesian bank notification emails.

EMAIL CONTENT:
"${emailText}"

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
  "confidence": number (0-100, how confident you are in this analysis)
}

CATEGORY OPTIONS:
PENDAPATAN (income): "Gaji", "Bonus", "Komisi", "Dividen", "Bunga", "Hadiah", "Penjualan", "Refund", "Cashback"
PENGELUARAN (expense): "Makanan", "Transportasi", "Reimburse", "Sedekah", "Hiburan", "Pengembangan Keluarga", "Rumah Tangga", "Pakaian", "Kecantikan", "Kesehatan", "Lainnya"

TRANSACTION TYPE LOGIC:
- Income indicators: terima, dapat, masuk, kredit, gaji, bonus, penjualan
- Expense indicators: bayar, beli, keluar, debit, transfer ke, kirim

IMPORTANT:
- Return ONLY valid JSON, no explanations or markdown
- Set fields to null if truly unclear (don't guess)
- Use Indonesian language context and banking terminology
- Amount should be positive for income, negative for expense
`;
}

/**
 * Parse JSON from Gemini response
 */
function parseGeminiResponse(text: string): ParsedEmailData | null {
  try {
    let jsonText = text.trim();

    // Clean markdown code blocks
    if (jsonText.includes("```json")) {
      jsonText = jsonText.split("```json")[1].split("```")[0].trim();
    } else if (jsonText.includes("```")) {
      jsonText = jsonText.split("```")[1].split("```")[0].trim();
    }

    return JSON.parse(jsonText) as ParsedEmailData;
  } catch (error) {
    logger.error("Failed to parse Gemini response as JSON");
    return null;
  }
}

/**
 * Post-process parsed data with validation and enhancement
 */
function postProcessParsedData(
  parsedData: ParsedEmailData,
  emailText: string
): ParsedEmailData {
  const enhanced = { ...parsedData };

  // Validate and correct amount
  if (enhanced.amount !== null && enhanced.amount !== undefined) {
    let amount = Math.abs(enhanced.amount);

    if (enhanced.transaction_type === "expense") {
      amount = -amount;
    }

    enhanced.amount = amount;
  }

  // Validate bank name
  if (enhanced.bank && !BANK_NAMES.includes(enhanced.bank)) {
    const bankLower = enhanced.bank.toLowerCase();
    const matchedBank = BANK_NAMES.find(
      (bank) =>
        bank.toLowerCase().includes(bankLower) ||
        bankLower.includes(bank.toLowerCase().split(" ")[0])
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
    const contextType = determineBankTransactionType(
      enhanced.bank,
      enhanced.description
    );
    if (contextType !== enhanced.transaction_type) {
      logger.info(
        `Bank context suggests ${contextType}, adjusting from ${enhanced.transaction_type}`
      );
      enhanced.transaction_type = contextType;

      // Reapply amount sign
      if (enhanced.amount !== null) {
        let amount = Math.abs(enhanced.amount);
        if (contextType === "expense") {
          amount = -amount;
        }
        enhanced.amount = amount;
      }
    }
  }

  // Ensure confidence is set
  if (!enhanced.confidence) {
    enhanced.confidence = 70;
  }

  // Ensure date is set
  if (!enhanced.date) {
    enhanced.date = new Date().toISOString().split("T")[0];
  }

  // Ensure category is set
  if (!enhanced.category) {
    enhanced.category = "Lainnya";
  }

  return enhanced;
}

/**
 * Test Gemini connection
 */
export async function testGeminiConnection(env: Env): Promise<boolean> {
  const config = getConfig(env);

  if (!config.GEMINI_API_KEY) {
    logger.error("GEMINI_API_KEY is not configured");
    return false;
  }

  try {
    const apiUrl = `${GEMINI_API_BASE}/${config.GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with just the word "OK".' }] }],
      }),
    });

    if (!response.ok) {
      logger.error(`Gemini test failed: ${response.status}`);
      return false;
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    logger.success("Gemini AI connection test successful");
    return text?.toLowerCase().includes("ok") ?? false;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Gemini test failed:", message);
    return false;
  }
}
