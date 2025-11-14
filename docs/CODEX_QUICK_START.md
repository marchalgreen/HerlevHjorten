# Codex Quick Start - Minimal Setup Guide

This is the **fastest way** to set up Codex. Follow these exact steps.

## Do You Need an API Key?

**No API key needed if:**
- ✅ You have ChatGPT Plus/Pro/Business subscription
- ✅ You're using "Sign in with ChatGPT"
- ✅ You're just using Codex through the ChatGPT interface

**API key needed if:**
- ❌ You want to call OpenAI APIs from your code
- ❌ You're using `packages/webapp/src/lib/codex.ts` functions

**See [CODEX_AUTHENTICATION.md](./CODEX_AUTHENTICATION.md) for details.**

## What You Need

1. (Optional) Your OpenAI API key - only if using programmatic API access (get from https://platform.openai.com/api-keys)
2. Access to Codex environment creation UI
3. ChatGPT account (if using sign-in method)

## The 5-Minute Setup

### Part 1: Environment Variables (Optional - Skip if You Want)

**Since you have ChatGPT Pro, you can skip all environment variables!** Codex will authenticate through your ChatGPT account automatically.

However, if you want to configure Codex behavior, you can optionally add these (all are optional):

```
1. Name: CODEX_MODEL
   Value: gpt-4o
   Secret: ❌ UNCHECKED
   (Note: gpt-4o is recommended default. See CODEX_MODEL_RECOMMENDATIONS.md for alternatives)

2. Name: CODEX_MAX_TOKENS
   Value: 4096
   Secret: ❌ UNCHECKED

3. Name: CODEX_TEMPERATURE
   Value: 0.7
   Secret: ❌ UNCHECKED

4. Name: CODEX_TIMEOUT
   Value: 30000
   Secret: ❌ UNCHECKED
```

**Skip OPENAI_API_KEY** - You don't need it with ChatGPT Pro!

### Part 2: Secrets Section

**Skip this entirely!** You don't need any secrets since you're using ChatGPT sign-in.

### Part 3: Settings (Just Toggle These)

Find these sections and set them:

```
Container Caching:     On ✅
Setup Script:          Automatic ✅
Agent Internet Access: On ✅
```

### Part 4: Create

Click **"Create environment"** button at the bottom.

**Done!** That's all you need to do.

---

## Full Walkthrough

For detailed step-by-step instructions with screenshots descriptions, see [CODEX_EXTERNAL_SETUP.md](./CODEX_EXTERNAL_SETUP.md).

## Troubleshooting

**"Where do I find the Environment Variables section?"**
- It's usually in the middle of the form, labeled "Environment variables" or "Code execution"

**"I don't see a Secrets section"**
- It might be below Environment Variables, or combined with it
- If you can't find it, the environment variable with Secret checked is enough

**"What if I make a mistake?"**
- You can edit environment variables after creation
- Or delete and recreate the environment

**"Do I need all 5 variables?"**
- **With ChatGPT Pro: None are required!** You can skip all environment variables.
- The CODEX_* variables are optional configuration - Codex will use defaults if you don't set them.
- Only add OPENAI_API_KEY if you're calling OpenAI APIs programmatically from your code.

