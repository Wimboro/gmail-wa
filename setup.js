#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Gmail to Sheets WhatsApp Processor Setup');
console.log('==========================================\n');

// Check if .env exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from template...');
  const envExamplePath = path.join(__dirname, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created successfully!\n');
  } else {
    console.log('❌ .env.example not found!\n');
  }
} else {
  console.log('✅ .env file already exists\n');
}

// Check required files
const requiredFiles = [
  { file: 'credentials.json', description: 'Gmail OAuth credentials' },
  { file: 'sa-credentials.json', description: 'Google Sheets service account credentials' }
];

console.log('🔍 Checking required credential files:');
for (const { file, description } of requiredFiles) {
  const filePath = path.join(__dirname, file);
  const templatePath = path.join(__dirname, `${file}.template`);
  
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} - Found`);
  } else {
    console.log(`❌ ${file} - Missing (${description})`);
    if (fs.existsSync(templatePath)) {
      console.log(`   📋 Template available: ${file}.template`);
    }
  }
}

console.log('\n📋 Setup Checklist:');
console.log('==================');

const checklist = [
  '□ Copy .env.example to .env and configure your settings',
  '□ Download credentials.json from Google Cloud Console (Gmail OAuth)',
  '□ Download sa-credentials.json from Google Cloud Console (Service Account)',
  '□ Set GEMINI_API_KEY in .env file',
  '□ Set SPREADSHEET_ID in .env file',
  '□ Set WHATSAPP_PHONE_NUMBERS in .env file',
  '□ Share your Google Spreadsheet with the service account email',
  '□ Run "npm start" to begin processing'
];

checklist.forEach(item => console.log(item));

console.log('\n📚 Documentation:');
console.log('================');
console.log('• README.md - Complete setup and usage guide');
console.log('• .env.example - Environment variables reference');
console.log('• *.template files - Credential file examples');

console.log('\n🔗 Useful Links:');
console.log('===============');
console.log('• Google Cloud Console: https://console.cloud.google.com/');
console.log('• Gemini API Keys: https://makersuite.google.com/app/apikey');
console.log('• WhatsApp Web: https://web.whatsapp.com/');

console.log('\n🚀 Quick Start:');
console.log('==============');
console.log('1. npm install');
console.log('2. node setup.js');
console.log('3. Configure .env file');
console.log('4. Add credential files');
console.log('5. npm start');

console.log('\n✨ Setup complete! Follow the checklist above to get started.'); 