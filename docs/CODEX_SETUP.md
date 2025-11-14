# Codex Agent Setup

This document describes how to set up external Codex agents for this repository.

## Overview

Codex agents can be used for automated code generation, refactoring, and development assistance. This setup configures the necessary environment variables and API integration.

## Environment Variables

### Required

- `OPENAI_API_KEY` - Your OpenAI API key
  - Get from: https://platform.openai.com/api-keys
  - Format: `sk-...` (starts with `sk-`)
  - Keep this secret secure - never commit to git

### Optional Configuration

- `CODEX_MODEL` - Model to use for Codex operations (default: `gpt-4o`)
  - **Recommended options:**
    - `gpt-4o` - Best balance of speed and quality (default, good for most code tasks)
    - `gpt-4o-mini` - More cost-effective, still very capable (good for high-volume usage)
    - `gpt-4-turbo` - Excellent code quality, slightly slower than gpt-4o
    - `gpt-3.5-turbo` - Fastest and cheapest, but less capable for complex code
  - **Recommendation:** Use `gpt-4o` for best balance, or `gpt-4o-mini` if cost is a concern
  
- `CODEX_MAX_TOKENS` - Maximum tokens per request (default: `4096`)
  - Higher values allow longer responses but cost more
  
- `CODEX_TEMPERATURE` - Creativity/randomness (default: `0.7`)
  - Range: 0.0 (deterministic) to 2.0 (creative)
  - Lower values for code generation, higher for creative tasks
  
- `CODEX_TIMEOUT` - Request timeout in milliseconds (default: `30000`)
  - Increase for large codebases or complex operations

## Local Setup

1. **Copy the example environment file:**
   ```bash
   cd packages/webapp
   cp .env.example .env.local
   ```

2. **Add your OpenAI API key:**
   ```bash
   # Edit .env.local and add your API key
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

3. **Restart your development server:**
   ```bash
   vercel dev
   # or
   pnpm dev
   ```

## Vercel Deployment Setup

### Using push-env.sh Script

```bash
# From repository root
./push-env.sh production .env.local
./push-env.sh preview .env.local
./push-env.sh development .env.local
```

### Using Vercel Dashboard

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - `OPENAI_API_KEY` = `sk-...` (mark as **Secret**)
   - `CODEX_MODEL` = `gpt-4o` (optional)
   - `CODEX_MAX_TOKENS` = `4096` (optional)
   - `CODEX_TEMPERATURE` = `0.7` (optional)
   - `CODEX_TIMEOUT` = `30000` (optional)
4. Select which environments to apply to (Production, Preview, Development)
5. Redeploy your application

## External Codex Environment Setup

**See [CODEX_EXTERNAL_SETUP.md](./CODEX_EXTERNAL_SETUP.md) for the complete step-by-step walkthrough.**

## Usage

Once configured, you can use Codex agents in your code:

```typescript
import { codexRequest } from '@/lib/codex'

// Example usage
const response = await codexRequest({
  prompt: 'Generate a function to calculate fibonacci numbers',
  maxTokens: 1000
})
```

## Security Best Practices

1. **Never commit API keys** - Always use `.env.local` (already in `.gitignore`)
2. **Use different keys** for development, staging, and production
3. **Rotate keys periodically** - Regenerate API keys every 90 days
4. **Monitor usage** - Check OpenAI dashboard for unexpected usage
5. **Set rate limits** - Configure usage limits in OpenAI dashboard
6. **Use secrets management** - Store sensitive values as secrets in Vercel

## Troubleshooting

### "OPENAI_API_KEY not set"
- Verify `.env.local` exists in `packages/webapp/`
- Check that the variable name is exactly `OPENAI_API_KEY`
- Restart your development server after adding variables

### "Invalid API key"
- Verify your API key starts with `sk-`
- Check that the key is active in OpenAI dashboard
- Ensure no extra spaces or quotes around the key value

### "Rate limit exceeded"
- Check your OpenAI usage dashboard
- Consider upgrading your OpenAI plan
- Implement request throttling in your code

### "Timeout error"
- Increase `CODEX_TIMEOUT` value
- Reduce `CODEX_MAX_TOKENS` for faster responses
- Check your network connection

## API Reference

See `packages/webapp/src/lib/codex.ts` for the Codex API utility implementation.

