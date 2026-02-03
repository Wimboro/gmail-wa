#!/bin/bash
# Setup script for gmail-wa-processor Worker
# Run this after creating KV namespaces

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Gmail-WA Processor Setup ==="
echo ""

# Check for wrangler
if ! command -v npx &> /dev/null; then
    echo "Error: npx not found. Please install Node.js"
    exit 1
fi

echo "Step 1: Uploading Gmail OAuth credentials..."
# Extract client_id and client_secret from credentials.json
if [ -f "$PARENT_DIR/credentials.json" ]; then
    CLIENT_ID=$(cat "$PARENT_DIR/credentials.json" | grep -o '"client_id":"[^"]*"' | cut -d'"' -f4)
    CLIENT_SECRET=$(cat "$PARENT_DIR/credentials.json" | grep -o '"client_secret":"[^"]*"' | cut -d'"' -f4)
    
    OAUTH_JSON="{\"client_id\":\"$CLIENT_ID\",\"client_secret\":\"$CLIENT_SECRET\"}"
    echo "Uploading gmail_oauth to CREDENTIALS namespace..."
    npx wrangler kv key put --binding=CREDENTIALS "gmail_oauth" "$OAUTH_JSON"
    echo "Done!"
else
    echo "Warning: credentials.json not found in parent directory"
fi

echo ""
echo "Step 2: Uploading Gmail OAuth tokens..."

# Upload each token file
for token_file in "$PARENT_DIR"/token_*.json; do
    if [ -f "$token_file" ]; then
        # Extract account name from filename (token_NAME.json -> NAME)
        account=$(basename "$token_file" .json | sed 's/token_//')
        echo "Uploading token for account: $account"
        
        # Read and upload token
        TOKEN_CONTENT=$(cat "$token_file")
        npx wrangler kv key put --binding=OAUTH_TOKENS "gmail:$account" "$TOKEN_CONTENT"
        echo "Done!"
    fi
done

echo ""
echo "Step 3: Setting secrets..."
echo "You need to set the following secrets manually:"
echo ""
echo "  npx wrangler secret put GEMINI_API_KEY"
echo "  npx wrangler secret put WAHA_BASE_URL"
echo "  npx wrangler secret put WAHA_API_KEY"
echo ""

echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev' to start local development"
echo "2. Run 'npm run deploy' to deploy to Cloudflare"
