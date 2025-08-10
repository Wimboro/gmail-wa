# Gmail to Sheets WhatsApp Processor (JavaScript)

A modern JavaScript application that automatically processes Gmail emails containing financial transaction data, extracts information using Google Gemini AI, stores it in Google Sheets, and sends WhatsApp notifications.

## Features

- 📧 **Gmail Integration**: Automatically fetch and process emails with financial data
- 🤖 **AI-Powered Parsing**: Uses Google Gemini AI to extract transaction details from Indonesian emails
- 📊 **Google Sheets Integration**: Automatically stores processed data in spreadsheets
- 📱 **WhatsApp Notifications**: Real-time notifications for new transactions
- 🔄 **Multi-Account Support**: Process multiple Gmail accounts simultaneously
- 🛡️ **Duplicate Detection**: Prevents duplicate transactions in your sheets
- 🏗️ **Clean Architecture**: Modular design with separation of concerns

## Tech Stack

- **Node.js** with ES6+ modules
- **@google/genai** for Gemini AI integration
- **whatsapp-web.js** for WhatsApp notifications
- **googleapis** for Gmail and Sheets integration
- **Modern async/await** patterns

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd gmail-sheets-whatsapp-js

# Install dependencies
npm install
```

### 2. Configuration

1. **Set up Google Cloud credentials**:
   - Download `credentials.json` from Google Cloud Console
   - Create `sa-credentials.json` for service account

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Run setup script**:
   ```bash
   node setup.js
   ```

### 3. Running the Application

**Recommended: Use the runner script for WhatsApp support**

```bash
# This ensures WhatsApp is authenticated before processing emails
node run.js
```

**Alternative: Direct execution**

```bash
# Direct execution (may miss WhatsApp notifications if not pre-authenticated)
node src/index.js
```

### 4. WhatsApp Setup

1. When you first run the application, a QR code will appear
2. Scan it with your WhatsApp mobile app
3. The application will wait for authentication before processing emails
4. Once authenticated, subsequent runs will be faster

## Configuration

### Environment Variables

```env
# Gmail Configuration
GMAIL_ACCOUNTS=account1,account2,account3
GMAIL_SEARCH_QUERY=subject:(Transfer OR Pembayaran) is:unread newer_than:1d

# Google Sheets Configuration
SPREADSHEET_ID=your-spreadsheet-id

# Gemini AI Configuration
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash

# WhatsApp Configuration
WHATSAPP_PHONE_NUMBERS=628123456789,628987654321
ENABLE_WHATSAPP_NOTIFICATIONS=true
BATCH_NOTIFICATION_THRESHOLD=5

# Application Configuration
PROCESSOR_USER_ID=email-processor-main
NODE_ENV=development
```

### Phone Number Format

WhatsApp phone numbers should be in international format without the `+` sign:
- ✅ `628123456789` (Indonesia)
- ✅ `1234567890` (US)
- ❌ `+628123456789`
- ❌ `08123456789`

## Usage

### Basic Operation

1. **Email Processing**: The application searches for unread emails matching your criteria
2. **AI Parsing**: Each email is processed by Gemini AI to extract transaction data
3. **Sheet Update**: Valid transactions are added to your Google Sheet
4. **WhatsApp Notifications**: Real-time notifications are sent for new transactions

### Message Format

WhatsApp notifications include:
- 💰/💸 Transaction type (income/expense)
- 📧 Gmail account
- 💵 Amount in Indonesian Rupiah format
- 🏷️ Category
- 📝 Description
- 📅 Date

### Testing

```bash
# Test Gemini AI connection
node test-genai.js

# Test WhatsApp notifications
node test-whatsapp.js

# Test complete workflow with sample data
node run.js
```

## Troubleshooting

### WhatsApp Notifications Not Working

**Problem**: Transactions are processed but WhatsApp notifications aren't sent.

**Solution**: Use the runner script instead of direct execution:

```bash
# ✅ Recommended - ensures WhatsApp is ready
node run.js

# ❌ May have timing issues
node src/index.js
```

**Why**: The WhatsApp client needs time to authenticate via QR code. The runner script ensures authentication is complete before processing emails.

### Common Issues

1. **"GEMINI_API_KEY not found"**
   - Set your API key in `.env`
   - Verify the key is valid

2. **"Spreadsheet not found"**
   - Check your `SPREADSHEET_ID`
   - Ensure the service account has access

3. **"WhatsApp authentication failed"**
   - Scan the QR code with your phone
   - Check if WhatsApp Web is already logged in elsewhere

4. **"Phone number not found on WhatsApp"**
   - Verify the phone number format
   - Ensure the number is registered on WhatsApp

## Architecture

```
src/
├── auth/           # Authentication modules
├── services/       # Core business logic
├── processors/     # Email processing workflows
└── index.js        # Main application entry

config/             # Configuration management
utils/              # Utility functions
test-*.js          # Test scripts
run.js             # Recommended runner script
```

## Migration from Python

This is a JavaScript port of the original Python version with these improvements:

- ✅ Better performance with async/await
- ✅ Modern ES6+ modules
- ✅ WhatsApp instead of Telegram
- ✅ Improved error handling
- ✅ Better logging with colors
- ✅ Modular architecture

See [MIGRATION.md](MIGRATION.md) for detailed migration notes.

## Development

### Adding New Features

1. **New AI Models**: Update `geminiService.js`
2. **New Notification Channels**: Create new service in `src/services/`
3. **New Email Patterns**: Modify the Gemini prompt in `geminiService.js`

### Code Style

- Use ES6+ modules
- Async/await for asynchronous operations
- Descriptive logging
- Error handling with try/catch

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the logs for error messages
3. Ensure all dependencies are properly configured

---

**Note**: This application processes personal financial data. Ensure proper security measures and comply with relevant data protection regulations.