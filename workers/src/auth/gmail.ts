import type { Env, OAuthToken, GmailOAuthCredentials } from "../types";
import { logger } from "../utils/logger";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Normalize token format (handle both Python and JS formats)
 */
function normalizeToken(stored: OAuthToken): {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  clientId?: string;
  clientSecret?: string;
} {
  // Get access token (supports both formats)
  const accessToken = stored.access_token || stored.token || "";
  
  // Get refresh token
  const refreshToken = stored.refresh_token;
  
  // Get expiry date (supports both formats)
  let expiryDate: number;
  if (stored.expiry_date) {
    expiryDate = stored.expiry_date;
  } else if (stored.expiry) {
    // Parse ISO date string
    expiryDate = new Date(stored.expiry).getTime();
  } else {
    // Default to expired (force refresh)
    expiryDate = 0;
  }
  
  return {
    accessToken,
    refreshToken,
    expiryDate,
    clientId: stored.client_id,
    clientSecret: stored.client_secret,
  };
}

/**
 * Get Gmail access token from KV, refreshing if expired
 */
export async function getGmailAccessToken(
  env: Env,
  accountId: string
): Promise<string> {
  const tokenKey = `gmail:${accountId}`;
  const storedJson = await env.OAUTH_TOKENS.get(tokenKey);

  if (!storedJson) {
    throw new Error(
      `No OAuth token found for account: ${accountId}. ` +
        `Please upload token using: wrangler kv key put --binding=OAUTH_TOKENS "gmail:${accountId}" '<token_json>'`
    );
  }

  const stored: OAuthToken = JSON.parse(storedJson);
  const normalized = normalizeToken(stored);

  // Check if token is expired (with 5 min buffer)
  const bufferMs = 5 * 60 * 1000;
  if (Date.now() > normalized.expiryDate - bufferMs) {
    logger.info(`Token expired for ${accountId}, refreshing...`);
    return refreshAccessToken(env, accountId, stored, normalized);
  }

  return normalized.accessToken;
}

/**
 * Refresh an expired access token
 */
async function refreshAccessToken(
  env: Env,
  accountId: string,
  token: OAuthToken,
  normalized: ReturnType<typeof normalizeToken>
): Promise<string> {
  // Get OAuth credentials - first try from token, then from KV
  let clientId = normalized.clientId;
  let clientSecret = normalized.clientSecret;
  
  if (!clientId || !clientSecret) {
    const credentialsJson = await env.CREDENTIALS.get("gmail_oauth");

    if (!credentialsJson) {
      throw new Error(
        "Gmail OAuth credentials not found in KV. " +
          'Please upload using: wrangler kv key put --binding=CREDENTIALS "gmail_oauth" \'{"client_id":"...","client_secret":"..."}\''
      );
    }

    const credentials: GmailOAuthCredentials = JSON.parse(credentialsJson);
    clientId = credentials.client_id;
    clientSecret = credentials.client_secret;
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: normalized.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`Token refresh failed: ${response.status} ${errorText}`);
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  // Update stored token (preserve original format but update access token and expiry)
  const updated: OAuthToken = {
    ...token,
    // Update both formats for compatibility
    access_token: data.access_token,
    token: data.access_token,
    expiry_date: Date.now() + data.expires_in * 1000,
    expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };

  await env.OAUTH_TOKENS.put(`gmail:${accountId}`, JSON.stringify(updated));
  logger.success(`Token refreshed for account: ${accountId}`);

  return data.access_token;
}

/**
 * Check if OAuth token exists for an account
 */
export async function hasOAuthToken(
  env: Env,
  accountId: string
): Promise<boolean> {
  const tokenKey = `gmail:${accountId}`;
  const stored = await env.OAUTH_TOKENS.get(tokenKey);
  return stored !== null;
}

/**
 * Store OAuth token (for initial setup or manual upload)
 */
export async function storeOAuthToken(
  env: Env,
  accountId: string,
  token: OAuthToken
): Promise<void> {
  const tokenKey = `gmail:${accountId}`;
  await env.OAUTH_TOKENS.put(tokenKey, JSON.stringify(token));
  logger.success(`Token stored for account: ${accountId}`);
}

/**
 * Test Gmail authentication
 */
export async function testGmailAuth(
  env: Env,
  accountId: string
): Promise<boolean> {
  try {
    const accessToken = await getGmailAccessToken(env, accountId);
    
    // Test with a simple Gmail API call
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      logger.error(`Gmail auth test failed: ${response.status}`);
      return false;
    }

    const profile = (await response.json()) as { emailAddress: string };
    logger.success(`Gmail auth OK for: ${profile.emailAddress}`);
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Gmail auth test failed:`, message);
    return false;
  }
}
