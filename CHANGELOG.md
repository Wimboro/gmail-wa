# Changelog

## [1.1.0] - 2024-06-09

### Changed
- **BREAKING**: Migrated from deprecated `@google/generative-ai` to `@google/genai`
- Updated Gemini AI service to use the new API structure
- Changed default model from `gemini-2.0-flash-exp` to `gemini-1.5-flash`
- Updated WhatsApp Web.js version to `^1.25.0` for better compatibility

### Added
- Test script (`test-genai.js`) to verify Gemini AI functionality
- New npm script `test-genai` to run Gemini AI tests
- Enhanced error handling for the new API

### Technical Details

#### API Changes
- **Old**: `import { GoogleGenerativeAI } from '@google/generative-ai'`
- **New**: `import { GoogleGenAI } from '@google/genai'`

#### Client Initialization
- **Old**: `new GoogleGenerativeAI(apiKey)`
- **New**: `new GoogleGenAI(apiKey)`

#### Response Handling
- **Old**: `const response = await result.response; response.text()`
- **New**: `result.response.text()`

#### Model Configuration
- **Old**: Default model `gemini-2.0-flash-exp`
- **New**: Default model `gemini-2.0-flash`

### Migration Steps
1. Updated `package.json` dependencies
2. Modified `src/services/geminiService.js` to use new API
3. Updated configuration files with new model defaults
4. Updated documentation to reflect changes

### Files Modified
- `package.json` - Updated dependencies
- `src/services/geminiService.js` - New API implementation
- `config/constants.js` - Updated default model
- `.env.example` - Updated model configuration
- `README.md` - Updated documentation
- `MIGRATION.md` - Updated package references

### Testing
Run `npm run test-genai` to verify the new Gemini AI integration works correctly.

---

## [1.0.0] - 2024-06-09

### Added
- Initial release with JavaScript implementation
- Gmail to Google Sheets automation
- WhatsApp notifications via whatsapp-web.js
- Gemini AI for transaction parsing
- Modular architecture with clean separation of concerns
- Comprehensive logging and error handling 