import type {
  Env,
  GmailMessage,
  GmailListResponse,
  GmailMessagePayload,
  GmailLabelsResponse,
} from "../types";
import { getGmailAccessToken } from "../auth/gmail";
import { logger } from "../utils/logger";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * Retrieve emails based on search query
 */
export async function getEmails(
  env: Env,
  accountId: string,
  searchQuery: string
): Promise<GmailMessage[]> {
  const accessToken = await getGmailAccessToken(env, accountId);

  logger.info(`Searching for emails with query: ${searchQuery}`);

  // List messages matching query
  const listUrl = `${GMAIL_API_BASE}/messages?q=${encodeURIComponent(searchQuery)}`;
  const listResponse = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    logger.error(`Gmail list failed: ${listResponse.status} ${errorText}`);
    throw new Error(`Gmail list failed: ${listResponse.status}`);
  }

  const listData = (await listResponse.json()) as GmailListResponse;
  const messages = listData.messages || [];

  if (messages.length === 0) {
    logger.info("No messages found matching the criteria");
    return [];
  }

  logger.info(`Found ${messages.length} messages, retrieving details...`);

  // Fetch full message details in parallel (with concurrency limit)
  const emails: GmailMessage[] = [];
  const batchSize = 10;

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (msg) => {
        try {
          const msgUrl = `${GMAIL_API_BASE}/messages/${msg.id}`;
          const msgResponse = await fetch(msgUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!msgResponse.ok) {
            logger.warning(`Failed to get message ${msg.id}: ${msgResponse.status}`);
            return null;
          }

          return (await msgResponse.json()) as GmailMessage;
        } catch (error) {
          logger.warning(`Error fetching message ${msg.id}`);
          return null;
        }
      })
    );

    emails.push(...batchResults.filter((m): m is GmailMessage => m !== null));
  }

  logger.success(`Successfully retrieved ${emails.length} emails`);
  return emails;
}

/**
 * Extract the text content from an email message
 */
export function extractEmailBody(payload: GmailMessagePayload | undefined): string | null {
  if (!payload) return null;

  try {
    // Handle multipart messages
    if (payload.parts) {
      for (const part of payload.parts) {
        // Look for plain text first
        if (part.mimeType === "text/plain" && part.body?.data) {
          return decodeBase64(part.body.data);
        }

        // If no plain text, try HTML content
        if (part.mimeType === "text/html" && part.body?.data) {
          const htmlContent = decodeBase64(part.body.data);
          return extractTextFromHtml(htmlContent);
        }

        // Recursively check nested parts
        if (part.parts) {
          const nestedBody = extractEmailBody(part);
          if (nestedBody) return nestedBody;
        }
      }
    } else {
      // Handle single-part messages
      const data = payload.body?.data;
      if (data) {
        const content = decodeBase64(data);

        if (payload.mimeType === "text/html") {
          return extractTextFromHtml(content);
        } else {
          return content;
        }
      }
    }

    return null;
  } catch (error) {
    logger.error("Error extracting email body");
    return null;
  }
}

/**
 * Decode base64 URL-safe encoded string
 */
function decodeBase64(data: string): string {
  // Gmail uses URL-safe base64
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

/**
 * Simple HTML to text conversion
 */
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mark an email as processed by adding a label and marking as read
 */
export async function markEmailProcessed(
  env: Env,
  accountId: string,
  messageId: string,
  labelName: string = "Processed-Financial"
): Promise<void> {
  const accessToken = await getGmailAccessToken(env, accountId);

  try {
    // Get or create the label
    const labelId = await getOrCreateLabel(accessToken, labelName);

    // Modify the message
    const modifyUrl = `${GMAIL_API_BASE}/messages/${messageId}/modify`;
    const modifyResponse = await fetch(modifyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        addLabelIds: [labelId],
        removeLabelIds: ["UNREAD"],
      }),
    });

    if (!modifyResponse.ok) {
      logger.warning(`Failed to modify message ${messageId}: ${modifyResponse.status}`);
      return;
    }

    logger.success(`Email ${messageId} marked as processed and read`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error processing email ${messageId}:`, message);
  }
}

/**
 * Get or create a Gmail label
 */
async function getOrCreateLabel(
  accessToken: string,
  labelName: string
): Promise<string> {
  // List existing labels
  const labelsResponse = await fetch(`${GMAIL_API_BASE}/labels`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!labelsResponse.ok) {
    throw new Error(`Failed to list labels: ${labelsResponse.status}`);
  }

  const labelsData = (await labelsResponse.json()) as GmailLabelsResponse;
  const existingLabel = labelsData.labels?.find((l) => l.name === labelName);

  if (existingLabel) {
    return existingLabel.id;
  }

  // Create new label
  const createResponse = await fetch(`${GMAIL_API_BASE}/labels`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: labelName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Failed to create label: ${createResponse.status}`);
  }

  const newLabel = (await createResponse.json()) as { id: string };
  logger.info(`Created new label: ${labelName}`);
  return newLabel.id;
}

/**
 * Get email headers
 */
export function getEmailHeaders(
  message: GmailMessage
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (message.payload?.headers) {
    for (const header of message.payload.headers) {
      const name = header.name.toLowerCase();
      if (["from", "to", "subject", "date"].includes(name)) {
        headers[name] = header.value;
      }
    }
  }

  return headers;
}
