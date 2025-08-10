# Migration Guide: Python to JavaScript

This document helps you migrate from the Python version to the JavaScript version of the Gmail to Sheets processor.

## 🔄 Key Changes

### Technology Stack
| Component | Python Version | JavaScript Version |
|-----------|----------------|-------------------|
| **Runtime** | Python 3.8+ | Node.js 18+ |
| **Gmail API** | `googleapis` | `googleapis` |
| **Sheets API** | `googleapis` | `googleapis` |
| **AI Service** | `google.generativeai` | `@google/genai` |
| **Notifications** | Telegram (`python-telegram-bot`) | WhatsApp (`whatsapp-web.js`) |
| **Environment** | `python-dotenv` | `dotenv` |

### Architecture Improvements
- ✅ **Modular Design**: Clean separation of concerns
- ✅ **Modern JavaScript**: ES6+ modules, async/await
- ✅ **Better Error Handling**: Comprehensive error management
- ✅ **Enhanced Logging**: Colored, timestamped console output
- ✅ **Type Safety**: JSDoc annotations for better IDE support

## 📁 File Structure Comparison

### Python Version
```
gmail_to_sheets.py          # Monolithic script
telegram_notifier.py        # Telegram notifications
credentials.json            # OAuth credentials
sa-credentials.json         # Service account credentials
token_*.json               # OAuth tokens
.env                       # Environment variables
```

### JavaScript Version
```
src/
├── auth/
│   ├── gmailAuth.js       # Gmail OAuth authentication
│   └── sheetsAuth.js      # Sheets service account auth
├── services/
│   ├── gmailService.js    # Gmail operations
│   ├── sheetsService.js   # Sheets operations
│   ├── geminiService.js   # AI processing
│   └── whatsappService.js # WhatsApp notifications
├── processors/
│   └── emailProcessor.js # Main processing logic
└── index.js              # Application entry point
config/
└── constants.js          # Configuration management
utils/
└── logger.js             # Logging utilities
```

## 🔧 Configuration Migration

### Environment Variables

Most environment variables remain the same:

```env
# Same in both versions
GMAIL_ACCOUNTS=your-email@gmail.com
GMAIL_SEARCH_QUERY=subject:(Transfer OR payment) is:unread newer_than:1d
SPREADSHEET_ID=your-spreadsheet-id
GEMINI_API_KEY=your-gemini-api-key
PROCESSOR_USER_ID=email-processor-main

# Changed for JavaScript version
GEMINI_MODEL=gemini-2.0-flash-exp  # Was MODEL_NAME in Python

# New in JavaScript version
WHATSAPP_PHONE_NUMBERS=6281234567890,6289876543210
WHATSAPP_GROUP_ID=optional-group-id
ENABLE_WHATSAPP_NOTIFICATIONS=true
BATCH_NOTIFICATION_THRESHOLD=5
NODE_ENV=development
```

### Credential Files

**No changes needed** - use the same files:
- `credentials.json` (Gmail OAuth)
- `sa-credentials.json` (Sheets Service Account)
- `token_*.json` (Generated OAuth tokens)

## 📱 Notification Changes

### From Telegram to WhatsApp

#### Python (Telegram)
```python
# telegram_notifier.py
def send_telegram_notification(transaction, account_id):
    bot.send_message(chat_id, message)

def send_batch_notification(count, account_id):
    bot.send_message(chat_id, batch_message)
```

#### JavaScript (WhatsApp)
```javascript
// whatsappService.js
export async function sendWhatsAppNotification(transaction, accountId) {
  await whatsappClient.sendMessage(chatId, message);
}

export async function sendBatchWhatsAppNotification(count, accountId) {
  await whatsappClient.sendMessage(chatId, batchMessage);
}
```

### Message Format Comparison

#### Telegram Format (Python)
```
💰 TRANSAKSI BARU

Akun: your-email@gmail.com
Jenis: PEMASUKAN
Jumlah: Rp 1,500,000
Kategori: Gaji
Deskripsi: Transfer gaji
Tanggal: 2024-01-15
```

#### WhatsApp Format (JavaScript)
```
💰 *TRANSAKSI BARU*

📧 *Akun:* your-email@gmail.com
📊 *Jenis:* PEMASUKAN
💵 *Jumlah:* Rp 1,500,000
🏷️ *Kategori:* Gaji
📝 *Deskripsi:* Transfer gaji
📅 *Tanggal:* 2024-01-15

_Diproses otomatis dari email_
```

## 🚀 Migration Steps

### 1. Install Node.js
```bash
# Install Node.js 18+ from nodejs.org
node --version  # Should be 18.0.0 or higher
```

### 2. Setup JavaScript Project
```bash
# Create new directory
mkdir gmail-sheets-whatsapp-js
cd gmail-sheets-whatsapp-js

# Copy the JavaScript project files
# (or clone from repository)

# Install dependencies
npm install
```

### 3. Migrate Configuration
```bash
# Copy your existing .env file
cp ../python-version/.env .env

# Update .env with new variables
# Add WHATSAPP_PHONE_NUMBERS
# Add ENABLE_WHATSAPP_NOTIFICATIONS=true
# Change MODEL_NAME to GEMINI_MODEL
```

### 4. Copy Credential Files
```bash
# Copy existing credential files
cp ../python-version/credentials.json .
cp ../python-version/sa-credentials.json .
cp ../python-version/token_*.json .
```

### 5. Test the Migration
```bash
# Run setup script
npm run setup

# Test the application
npm start
```

## 🔍 Feature Comparison

| Feature | Python Version | JavaScript Version | Status |
|---------|----------------|-------------------|---------|
| Gmail OAuth | ✅ | ✅ | **Same** |
| Service Account | ✅ | ✅ | **Same** |
| Email Processing | ✅ | ✅ | **Enhanced** |
| Gemini AI Parsing | ✅ | ✅ | **Same** |
| Duplicate Detection | ✅ | ✅ | **Same** |
| Spreadsheet Updates | ✅ | ✅ | **Same** |
| Telegram Notifications | ✅ | ❌ | **Removed** |
| WhatsApp Notifications | ❌ | ✅ | **New** |
| Batch Processing | ✅ | ✅ | **Enhanced** |
| Error Handling | ⚠️ | ✅ | **Improved** |
| Logging | ⚠️ | ✅ | **Enhanced** |
| Modular Architecture | ❌ | ✅ | **New** |

## 🎯 Benefits of Migration

### Performance
- **Faster Startup**: Node.js starts faster than Python
- **Better Memory Usage**: More efficient memory management
- **Concurrent Processing**: Better handling of async operations

### Developer Experience
- **Modern Syntax**: ES6+ features, async/await
- **Better IDE Support**: Enhanced autocomplete and error detection
- **Cleaner Code**: Modular architecture, separation of concerns

### Maintenance
- **Easier Testing**: Modular functions are easier to test
- **Better Error Messages**: More descriptive error handling
- **Enhanced Logging**: Colored, timestamped output

### WhatsApp vs Telegram
- **No Bot Setup**: WhatsApp Web doesn't require bot creation
- **Direct Messaging**: Send to personal numbers or groups
- **Better Formatting**: Rich text formatting with emojis
- **Wider Adoption**: More people use WhatsApp than Telegram

## 🔧 Troubleshooting Migration

### Common Issues

#### Node.js Version
```bash
# Error: Unsupported Node.js version
node --version
# Solution: Install Node.js 18+ from nodejs.org
```

#### Module Import Errors
```bash
# Error: Cannot use import statement outside a module
# Solution: Ensure package.json has "type": "module"
```

#### WhatsApp QR Code
```bash
# Error: WhatsApp client not ready
# Solution: Scan the QR code with your WhatsApp mobile app
```

#### Environment Variables
```bash
# Error: Missing required environment variables
# Solution: Copy .env.example to .env and configure
```

## 📞 Support

If you encounter issues during migration:

1. **Check the logs** for detailed error messages
2. **Verify configuration** using `npm run setup`
3. **Test individual components** using the test functions
4. **Review the README.md** for complete setup instructions

## 🎉 Migration Complete!

Once migrated, you'll have:
- ✅ Modern JavaScript codebase
- ✅ WhatsApp notifications instead of Telegram
- ✅ Better error handling and logging
- ✅ Modular, maintainable architecture
- ✅ Same core functionality with enhancements

The JavaScript version provides the same core functionality as the Python version while offering better performance, maintainability, and user experience. 