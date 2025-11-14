# Codex Authentication - Do You Need an API Key?

## Quick Answer

**You DON'T need an API key if:**
- ✅ You have ChatGPT Plus, Pro, Business, Edu, or Enterprise subscription
- ✅ You're just using Codex through the ChatGPT interface
- ✅ You're using "Sign in with ChatGPT" authentication

**You DO need an API key if:**
- ❌ You want to use OpenAI APIs programmatically from your code
- ❌ You're using the `packages/webapp/src/lib/codex.ts` utility functions
- ❌ You don't have a ChatGPT subscription

## Two Authentication Methods

### Method 1: Sign in with ChatGPT (No API Key) ✅ **Easiest**

**How it works:**
- Codex authenticates through your ChatGPT account
- No API key needed in environment variables
- Works automatically when you sign in

**Who can use it:**
- ChatGPT Plus subscribers
- ChatGPT Pro subscribers  
- ChatGPT Business customers
- ChatGPT Edu customers
- ChatGPT Enterprise customers

**Setup:**
1. When creating Codex environment, choose "Sign in with ChatGPT"
2. Authenticate with your ChatGPT account
3. That's it! No API key needed.

**Your colleague's setup:**
If they only have environment variables like `NODE_ENV`, `DATABASE_URL`, etc., and no `OPENAI_API_KEY`, they're using this method. Codex works through their ChatGPT subscription.

---

### Method 2: API Key Authentication (API Key Required)

**How it works:**
- You provide an OpenAI API key
- Codex uses this key to authenticate API requests
- Required for programmatic access from your code

**Who needs it:**
- Developers calling OpenAI APIs from code
- Using `codex.ts` utility functions
- Building applications that use OpenAI APIs directly

**Setup:**
1. Get API key from https://platform.openai.com/api-keys
2. Add `OPENAI_API_KEY` to environment variables
3. Mark it as a secret

---

## Why Your Colleague Doesn't Have It

Looking at your colleague's setup:
- They have `NODE_ENV`, `DATABASE_URL`, `RESEND_API_KEY`, etc.
- **No `OPENAI_API_KEY`**
- Their Codex is working

**This means:**
- They're using "Sign in with ChatGPT" authentication
- Codex authenticates through their ChatGPT subscription
- They don't need an API key because they're not calling APIs programmatically

---

## When Do You Need the API Key?

You only need `OPENAI_API_KEY` if you're using code like this:

```typescript
import { codexRequest } from '@/lib/codex'

// This requires OPENAI_API_KEY
const response = await codexRequest({
  prompt: 'Generate code...',
  maxTokens: 1000
})
```

If you're just using Codex through the ChatGPT interface to:
- Generate code
- Refactor code
- Get help with your codebase

Then you **don't need** the API key - just sign in with ChatGPT!

---

## Recommendation

**For most users:** Use "Sign in with ChatGPT" - it's simpler and doesn't require managing API keys.

**Only add API key if:**
- You're building features that call OpenAI APIs from your application code
- You're using the `codex.ts` utility functions
- You don't have a ChatGPT subscription

---

## Summary

| Scenario | Need API Key? | Why |
|----------|---------------|-----|
| Using Codex via ChatGPT UI | ❌ No | Authenticates via ChatGPT account |
| Using Codex via ChatGPT UI + ChatGPT subscription | ❌ No | Authenticates via ChatGPT account |
| Calling OpenAI APIs from code | ✅ Yes | Code needs API key to authenticate |
| Using `codex.ts` utility functions | ✅ Yes | Functions need API key to work |
| No ChatGPT subscription | ✅ Yes | API key is required for access |

**Bottom line:** If your colleague's setup works without an API key, you probably don't need one either - unless you're calling OpenAI APIs programmatically from your code!

