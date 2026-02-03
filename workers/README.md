# Gmail-WA Processor - Cloudflare Workers

A Cloudflare Worker that processes Gmail emails containing financial transactions,
parses them using Gemini AI, and stores them in Cloudflare D1 database with optional
WhatsApp notifications.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                          │
│                                                             │
│  ┌──────────────────┐           ┌──────────────────────┐   │
│  │ gmail-wa-processor│           │  bebong-dashboard    │   │
│  │    (Worker)       │           │     (Worker)         │   │
│  │                   │           │                      │   │
│  │ Cron: */5 * * * * │           │  HTTP: dashboard UI  │   │
│  └────────┬──────────┘           └──────────┬───────────┘   │
│           │                                  │              │
│           │         ┌────────────┐          │              │
│           └────────►│ D1 Database │◄─────────┘              │
│                     │ bebong-    │                         │
│                     │ transactions│                         │
│                     └────────────┘                         │
│                                                             │
│  ┌──────────────────┐                                      │
│  │   KV Storage      │ (OAuth tokens, credentials)         │
│  └──────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
         │                     │
         ▼                     ▼
    ┌─────────┐          ┌──────────┐
    │ Gmail   │          │  WAHA    │
    │  API    │          │ Server   │
    └─────────┘          └──────────┘
```

## Setup

### 1. Install Dependencies

```bash
cd workers
npm install
```

### 2. Create KV Namespaces

```bash
# Create namespaces
npx wrangler kv namespace create OAUTH_TOKENS
npx wrangler kv namespace create CREDENTIALS

# Update wrangler.toml with the returned IDs
```

### 3. Set Secrets

```bash
# Gemini API Key (required)
npx wrangler secret put GEMINI_API_KEY

# WAHA WhatsApp (optional)
npx wrangler secret put WAHA_BASE_URL
npx wrangler secret put WAHA_API_KEY
```

### 4. Upload OAuth Credentials

#### Gmail OAuth Credentials
From your `credentials.json`, extract client_id and client_secret:

```bash
npx wrangler kv key put --binding=CREDENTIALS "gmail_oauth" \
  '{"client_id":"YOUR_CLIENT_ID","client_secret":"YOUR_CLIENT_SECRET"}'
```

#### Gmail OAuth Tokens
For each Gmail account, upload the token from your existing `token_*.json` files:

```bash
npx wrangler kv key put --binding=OAUTH_TOKENS "gmail:your-email@gmail.com" \
  '{"access_token":"...","refresh_token":"...","expiry_date":...,"token_type":"Bearer"}'
```

### 5. Configure Gmail Accounts

Edit `wrangler.toml` and add your Gmail accounts:

```toml
[vars]
GMAIL_ACCOUNTS = "account1@gmail.com,account2@gmail.com"
```

### 6. Local Development

```bash
# Copy example env file
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your credentials

# Start local dev server
npm run dev
```

### 7. Deploy

```bash
npm run deploy
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/status` | GET | Service status (D1, Gemini, WAHA) |
| `/balance` | GET | Balance summary from D1 |
| `/trigger` | POST | Manually trigger email processing |

## Cron Schedule

By default, the worker runs every 5 minutes:

```toml
[triggers]
crons = ["*/5 * * * *"]
```

## Testing Cron Locally

```bash
# Start dev server
npm run dev

# In another terminal, trigger cron
curl http://localhost:8787/cdn-cgi/handler/scheduled
```

## Project Structure

```
workers/
├── src/
│   ├── index.ts           # Main entry (fetch + scheduled handlers)
│   ├── types.ts           # TypeScript interfaces
│   ├── config.ts          # Configuration and bank data
│   ├── auth/
│   │   └── gmail.ts       # Gmail OAuth token management (KV-based)
│   ├── services/
│   │   ├── d1.ts          # D1 database operations
│   │   ├── gmail.ts       # Gmail API via fetch
│   │   ├── gemini.ts      # Gemini AI parsing
│   │   └── whatsapp.ts    # WAHA WhatsApp notifications
│   ├── processors/
│   │   └── email.ts       # Email processing orchestration
│   └── utils/
│       └── logger.ts      # Console logging
├── wrangler.toml          # Wrangler configuration
├── package.json
└── tsconfig.json
```

## D1 Database

This worker shares the `bebong-transactions` D1 database with the bebong-dashboard.
Transactions appear immediately in the dashboard after processing.

Database ID: `899edeb1-5fc8-4b4b-bf18-7c03f812cb5d`

### Schema

```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'Lainnya',
  description TEXT,
  bank TEXT DEFAULT 'Tidak Diketahui',
  type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
  chat_id TEXT,     -- Used for account_id
  message_id TEXT,  -- Used for email_id
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);
```

## Troubleshooting

### OAuth Token Expired
If you see "Token refresh failed", the refresh token may be invalid.
Generate a new token using the original setup process and re-upload to KV.

### Gemini API Errors
Check that your API key is valid and has quota remaining.
Test with: `curl http://localhost:8787/status`

### WAHA Connection Issues
Ensure your WAHA server is running and the session is authenticated.
Check WAHA dashboard for QR code scanning if needed.
