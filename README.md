# Gmail to Sheets WhatsApp Processor (JavaScript)

A Node.js service that polls configured Gmail inboxes, extracts transaction details with Google Gemini, persists structured rows to Google Sheets, and pushes WhatsApp notifications through a WAHA (WhatsApp HTTP API) gateway.

## Features
- 📧 **Multi-inbox polling** – authenticate several Gmail accounts and process unread financial messages on a schedule.
- 🤖 **Enhanced Gemini parsing** – context-aware prompts interpret Indonesian banking emails, normalize amounts, banks, and categories, and fall back to a simpler parser when needed.
- 📊 **Google Sheets writer** – deduplicates against existing rows, adds headers automatically, and appends timestamped records.
- 📱 **WAHA notifications** – sends single or batch WhatsApp updates via a WAHA server (base URL + API key) to contacts and/or groups.
- 🛡️ **Duplicate protection & labeling** – skips reprocessing by labeling handled emails and comparing core fields before writing to the sheet.
- 🧩 **Modular architecture** – isolated auth, Gmail, Gemini, Sheets, and WhatsApp services with rich logging.

## Tech Stack
- Node.js 18+ (ES modules, async/await)
- `googleapis` for Gmail & Sheets integrations
- `@google/genai` for Gemini access
- `axios` for WAHA HTTP calls
- `dotenv`-driven configuration with a custom timestamped logger

## Quick Start
```bash
# Clone the repository
git clone <repository-url>
cd gmail-wa

# Install dependencies
npm install

# Optional: scaffold .env and credential checklist
npm run setup
```

1. Copy the templates and fill them with your own secrets:
   - `cp credentials.json.template credentials.json`
   - `cp sa-credentials.json.template sa-credentials.json`
   - `cp .env.example .env`
2. Install dependencies with `npm install` (or `pnpm install`/`yarn install`).
3. Run `npm test` to ensure the code compiles and exports correctly.
4. Create a writable directory for OAuth tokens (matches the default `TOKEN_DIRECTORY`): `mkdir -p tokens`.
5. Run `node run.js` once per Gmail inbox to print an authorization URL; paste the returned code and save the token as `token_<account>.json` inside the `tokens/` directory.

## Configuration

### Required credentials
- `credentials.json` – Google Cloud OAuth client used for Gmail access.
- `sa-credentials.json` – service-account key for Google Sheets.
- `token_<account>.json` – OAuth refresh/access tokens created per Gmail account on first authorization (stored in the directory defined by `TOKEN_DIRECTORY`, default `./tokens`).

### Environment variables
```env
# Gmail
GMAIL_ACCOUNTS=account1@gmail.com,account2@gmail.com
GMAIL_SEARCH_QUERY=subject:(Transfer OR Pembayaran) is:unread newer_than:1d

# Google Sheets
SPREADSHEET_ID=your-spreadsheet-id
SHEET_RANGE=Sheet1!A1

# Gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash

# WhatsApp / WAHA
ENABLE_WHATSAPP_NOTIFICATIONS=true
WHATSAPP_PHONE_NUMBERS=628123456789,628987654321
WHATSAPP_GROUP_ID=
WAHA_BASE_URL=http://localhost:3000
WAHA_API_KEY=your-waha-api-key
WAHA_SESSION_NAME=gmail-wa-bot
BATCH_NOTIFICATION_THRESHOLD=5

# Runtime
EMAIL_CHECK_INTERVAL_MINUTES=5
PROCESSOR_USER_ID=email-processor-main
NODE_ENV=development
TOKEN_DIRECTORY=./tokens
```

Phone numbers must be in international format without the leading `+` (e.g., `628123456789`). Share your spreadsheet with the service-account email found inside `sa-credentials.json`.

## Running the Processor
- `node run.js` – preferred entry; ensures the WAHA session is connected before importing the main loop.
- `node src/index.js` – runs the continuous processor directly (make sure WAHA is ready if notifications are enabled).

## Testing
- `npm test` – executes lightweight smoke tests via Node’s built-in runner to confirm that key modules import successfully.
- Add deeper integration tests under `tests/` (the runner automatically discovers `*.test.mjs`).

## How It Works
1. **Startup** – configuration is validated, Gemini is initialized, and WAHA connectivity is checked (if enabled).
2. **Polling loop** – every `EMAIL_CHECK_INTERVAL_MINUTES`, each Gmail account authenticates via its token and fetches unread messages matching `GMAIL_SEARCH_QUERY`.
3. **AI parsing** – email bodies are normalized and passed to `enhancedGeminiService`; on failure, `geminiService` provides a fallback parse.
4. **Sheet persistence** – existing rows are fetched, duplicates removed, headers added when necessary, and new rows appended with timestamps.
5. **Notifications** – for new transactions, the WAHA service sends either per-transaction or batch WhatsApp messages to configured recipients.
6. **Cleanup** – processed emails are labeled (and optionally marked as read) to avoid reprocessing.

## Project Structure
```
src/
├── auth/                  # Gmail OAuth + Sheets service-account helpers
├── processors/            # Orchestrates per-account processing
├── services/
│   ├── enhancedGeminiService.js  # Contextual Gemini prompts & post-processing
│   ├── geminiService.js          # Base Gemini integration and fallback parser
│   ├── gmailService.js           # Gmail queries, body extraction, labeling
│   ├── sheetsService.js          # Spreadsheet I/O, dedupe, row formatting
│   └── whatsappService.js        # WAHA client/session + notification logic
└── index.js               # Main continuous runner

config/                    # ENV parsing, constants, bank metadata
utils/                     # Logger utility
run.js                     # Wrapper that waits for WAHA readiness
setup.js                   # Bootstrap checklist (.env, credentials)
tests/                     # Node test runner smoke tests
```

## Utilities & Tests
- `npm test` – verifies that configuration, main entry, and processors load without throwing (no credentials required).
- Add custom integration checks under `tests/` to exercise Gmail, Sheets, Gemini, or WAHA in your environment.

## Deployment
- **Local / PM2**: Run `npm install`, set up `.env`, then manage the process with `pm2 start run.js --name gmail-wa`.
- **Docker / containers**: Copy the project into an image with Node 18+, mount credentials/tokens as secrets or bind mounts, and set the container command to `node run.js`.
- **Systemd / services**: Wrap `node run.js` in a unit file, ensure the working directory has read/write access to tokens, and enable automatic restarts on failure.
- Keep `credentials.json`, `sa-credentials.json`, and `token_*.json` outside the image when possible; mount them at runtime.
- **Docker Compose**: Ensure `.env`, `credentials.json`, `sa-credentials.json`, and the `tokens/` directory exist, then run `docker compose up -d --build`. Compose maps credentials read-only and persists tokens under `./tokens`.

## Troubleshooting
- **WAHA session not connected** – ensure `WAHA_BASE_URL`, `WAHA_API_KEY`, and `WAHA_SESSION_NAME` are correct, the WAHA server is running, and authenticate the session via the WAHA dashboard (QR scan) before rerunning.
- **Gmail authorization loops** – delete the stale `token_<account>.json`, rerun the processor, and complete the OAuth flow in the printed URL.
- **Spreadsheet not found or permission denied** – verify `SPREADSHEET_ID` and share the sheet with the service-account email.
- **Phone number errors** – strip `+`, keep only digits, and confirm the number is registered on WhatsApp.

Logs are timestamped; check the console output for detailed error messages and follow the hints printed by each service.

## Development Notes
- To support new email patterns, update the prompt logic inside `src/services/enhancedGeminiService.js`.
- To add another notification channel, create a new service in `src/services/` and wire it into `emailProcessor.js`.
- Follow ES module imports, prefer async/await, and wrap external calls in `try/catch` with informative logging.

## Security & Compliance
- Never commit `credentials.json`, `sa-credentials.json`, `.env`, or `token_*.json`. They are ignored by Git, but double-check before opening pull requests.
- Rotate OAuth tokens and API keys periodically; revoke and recreate them immediately if the files leak.
- Limit spreadsheet access to the service account email and monitor WAHA usage from a secured host.
- Treat processed transaction data as sensitive—enable disk encryption, restrict file permissions, and follow local privacy regulations.

## Support
1. Revisit this README and the troubleshooting section.
2. Inspect the console log output for precise failure reasons.
3. Double-check credentials, tokens, environment variables, and WAHA connectivity.

## License
Released under the [MIT License](LICENSE). Contributions are welcome via pull requests—please include tests for new behaviours where possible.
