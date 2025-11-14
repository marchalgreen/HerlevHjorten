#!/bin/bash
# Helper script to find OpenAI API key in common locations

echo "🔍 Searching for OpenAI API key..."
echo ""

# Check .env.local
if [ -f "packages/webapp/.env.local" ]; then
  echo "📄 Checking packages/webapp/.env.local:"
  grep -i "OPENAI_API_KEY\|sk-" packages/webapp/.env.local 2>/dev/null || echo "   ❌ Not found"
  echo ""
fi

# Check root .env.local
if [ -f ".env.local" ]; then
  echo "📄 Checking .env.local (root):"
  grep -i "OPENAI_API_KEY\|sk-" .env.local 2>/dev/null || echo "   ❌ Not found"
  echo ""
fi

# Check shell environment
echo "🔧 Checking shell environment:"
env | grep -i "OPENAI\|sk-" || echo "   ❌ Not found"
echo ""

# Check Vercel (if configured)
if command -v vercel &> /dev/null; then
  echo "☁️  Checking Vercel environment variables:"
  vercel env ls 2>/dev/null | grep -i "OPENAI" || echo "   ⚠️  Vercel CLI not linked or no OpenAI vars found"
  echo ""
fi

# Check macOS Keychain (if on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "🔐 Checking macOS Keychain:"
  security find-generic-password -s "OpenAI" -w 2>/dev/null && echo "   ✅ Found in Keychain" || echo "   ❌ Not found in Keychain"
  echo ""
fi

echo "💡 If not found, you can:"
echo "   1. Check Vercel dashboard: https://vercel.com/dashboard → Your Project → Settings → Environment Variables"
echo "   2. Check OpenAI platform: https://platform.openai.com/api-keys"
echo "   3. Check your password manager"
echo "   4. Create a new key at: https://platform.openai.com/api-keys"


