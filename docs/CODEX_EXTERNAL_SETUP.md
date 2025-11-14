# Codex External Environment Setup - Complete Walkthrough

This is a **step-by-step guide** for setting up the Codex environment in the OpenAI Codex UI. Follow these instructions exactly to minimize manual work.

## Two Ways to Use Codex

**Option 1: Sign in with ChatGPT** (No API key needed) ✅ **Recommended if you have ChatGPT Plus/Pro**
- If you have ChatGPT Plus, Pro, Business, Edu, or Enterprise subscription
- Codex authenticates through your ChatGPT account
- No API key required in environment variables
- **Skip the OPENAI_API_KEY steps below**

**Option 2: API Key Authentication** (API key required)
- If you want to use OpenAI APIs programmatically from your code
- Requires an OpenAI API key
- Needed if you're using the `codex.ts` utility functions in your codebase
- **Follow all steps including OPENAI_API_KEY**

## Prerequisites

Before starting, you need:
1. An OpenAI account (ChatGPT subscription OR API access)
2. (Optional) An OpenAI API key - only needed if using programmatic API access (get from https://platform.openai.com/api-keys)
3. Access to the Codex environment creation UI

## Step-by-Step Instructions

### Step 1: Navigate to Codex Environment Creation

1. Go to the Codex environments page
2. Click **"New Environment"** or **"Create Environment"** button
3. You should see a form titled **"Create Environment"** or **"Codex - Create Environment"**

### Step 2: Basic Information

Fill in the basic information:

1. **Name field:**
   - Value: `marchalgreen/Rundeklar`
   - (Or your preferred name - this is just a label)

2. **Description field:**
   - Value: `Development environment for HerlevHjorten badminton management system`
   - (Or any 1-2 sentence description)
   - Character limit: 512 characters

### Step 3: Container Image Configuration

1. Find the **"Container image"** dropdown
2. Select: **`universal`** (this should be the default)
3. You'll see text below explaining: "Universal is an image based on Ubuntu 24.04..."
4. **No changes needed** - leave as `universal`

### Step 4: Environment Variables

**Important:** If you're using "Sign in with ChatGPT", you can skip `OPENAI_API_KEY` and only add the optional configuration variables (CODEX_MODEL, etc.). The API key is only needed if you want to use OpenAI APIs programmatically from your code.

#### 4a. Add OPENAI_API_KEY (as Secret) - OPTIONAL

**Skip this if you're using ChatGPT sign-in!** Only add this if you need programmatic API access.

1. Find the **"Environment variables"** section
2. Click the **"Add +"** button
3. A form will appear with fields:
   - **Name:** (text input)
   - **Value:** (text input)
   - **Secret:** (checkbox)
4. Fill in:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** `sk-your-actual-api-key-here` (paste your real API key)
   - **Secret:** ✅ **CHECK THIS BOX** (very important!)
5. Click **"Save"** or **"Add"** button
6. You should see `OPENAI_API_KEY` appear in the list with a lock icon (🔒) indicating it's a secret

#### 4b. Add CODEX_MODEL

1. Click **"Add +"** again
2. Fill in:
   - **Name:** `CODEX_MODEL`
   - **Value:** `gpt-4o` (recommended default - see CODEX_MODEL_RECOMMENDATIONS.md for alternatives)
   - **Secret:** ❌ **Leave unchecked**
3. Click **"Save"** or **"Add"**
   
   **Note:** `gpt-4o` is a good default. Consider `gpt-4o-mini` if cost is a concern, or `gpt-4-turbo` for maximum quality.

#### 4c. Add CODEX_MAX_TOKENS

1. Click **"Add +"** again
2. Fill in:
   - **Name:** `CODEX_MAX_TOKENS`
   - **Value:** `4096`
   - **Secret:** ❌ **Leave unchecked**
3. Click **"Save"** or **"Add"**

#### 4d. Add CODEX_TEMPERATURE

1. Click **"Add +"** again
2. Fill in:
   - **Name:** `CODEX_TEMPERATURE`
   - **Value:** `0.7`
   - **Secret:** ❌ **Leave unchecked**
3. Click **"Save"** or **"Add"**

#### 4e. Add CODEX_TIMEOUT

1. Click **"Add +"** again
2. Fill in:
   - **Name:** `CODEX_TIMEOUT`
   - **Value:** `30000`
   - **Secret:** ❌ **Leave unchecked**
3. Click **"Save"** or **"Add"**

**Verification:** You should now see environment variables listed:
- `OPENAI_API_KEY` (with 🔒 lock icon) - **Only if you added it**
- `CODEX_MODEL` (optional)
- `CODEX_MAX_TOKENS` (optional)
- `CODEX_TEMPERATURE` (optional)
- `CODEX_TIMEOUT` (optional)

**Note:** If using ChatGPT sign-in, you may only have the optional CODEX_* variables, or none at all. That's fine!

### Step 5: Secrets Section (Additional Security) - OPTIONAL

**Only if you added OPENAI_API_KEY in Step 4a:**

Even though `OPENAI_API_KEY` is already in environment variables as a secret, you can add it here too for extra security:

1. Find the **"Secrets"** section (usually below Environment Variables)
2. Click the **"Add +"** button
3. Fill in:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** `sk-your-actual-api-key-here` (same API key as before)
4. Click **"Save"** or **"Add"**

**Note:** This is optional. If you're using ChatGPT sign-in, you don't need this step.

### Step 6: Container Caching

1. Find the **"Container Caching"** section
2. Look for a toggle switch labeled **"Off"** / **"On"**
3. Set it to **"On"** (toggle to the right/enabled position)
4. This speeds up subsequent container starts

### Step 7: Setup Script

1. Find the **"Setup script"** section
2. Look for a toggle labeled **"Automatic"** / **"Manual"**
3. Set it to **"Automatic"** (should be default)
4. You'll see text: "Runs the install commands like npm install for common package managers"
5. **No changes needed** - Automatic is correct

### Step 8: Agent Internet Access

1. Find the **"Agent internet access"** section
2. Look for a toggle labeled **"Off"** / **"On"**
3. Set it to **"On"** (toggle to the right/enabled position)
4. You'll see text: "Internet access will be disabled after setup. Codex will only be able to use dependencies installed by the setup script."
5. **Important:** This allows Codex to fetch dependencies during setup

### Step 9: Review and Create

Before clicking create, verify:

- ✅ Name is set
- ✅ Description is set (optional but recommended)
- ✅ Container image: `universal`
- ✅ Environment Variables: Added (OPENAI_API_KEY only if needed, plus optional CODEX_* vars)
- ✅ Secrets: OPENAI_API_KEY added (only if you're using API key auth)
- ✅ Container Caching: **On**
- ✅ Setup Script: **Automatic**
- ✅ Agent Internet Access: **On**

### Step 10: Create Environment

1. Scroll to the bottom of the form
2. Find the **"Create environment"** button (usually blue/prominent)
3. Click it
4. Wait for the environment to be created (this may take 1-2 minutes)

### Step 11: Verify Setup

After creation, you should see:

1. A terminal/output window showing setup progress
2. Messages like:
   - "Installing dependencies..."
   - "Running: pnpm install"
   - "Done in X.Xs using pnpm vX.X.X"
   - "Finalizing container setup"
   - "Test complete"
3. A prompt showing: `/workspace/Rundeklar$` (or your workspace directory)

## Quick Copy-Paste Reference

If you need to quickly reference the values:

```
Environment Variables:
- OPENAI_API_KEY = sk-... (SECRET ✅)
- CODEX_MODEL = gpt-4o
- CODEX_MAX_TOKENS = 4096
- CODEX_TEMPERATURE = 0.7
- CODEX_TIMEOUT = 30000

Secrets:
- OPENAI_API_KEY = sk-... (same as above)

Settings:
- Container image: universal
- Container Caching: On
- Setup Script: Automatic
- Agent Internet Access: On
```

## Troubleshooting

### "Environment variable already exists"
- You may have added it twice - remove the duplicate
- Check both Environment Variables and Secrets sections

### "Invalid API key format"
- Ensure your API key starts with `sk-`
- Check for extra spaces before/after the key
- Don't include quotes around the key value

### "Setup script failed"
- Check that your repository is accessible
- Verify the workspace directory path
- Ensure `pnpm` is available (should be in universal image)

### "Cannot find environment variable"
- Verify variable names match exactly (case-sensitive)
- Check that you clicked "Save" after adding each variable
- Refresh the page and check again

## Next Steps

After the environment is created:

1. The Codex agent can now access your repository
2. Environment variables are available via `process.env.VARIABLE_NAME`
3. You can start using Codex for code generation and assistance
4. See `docs/CODEX_SETUP.md` for usage examples

## Visual Checklist

Use this checklist while setting up:

```
Codex Environment Creation Checklist
=====================================

Basic Info:
[ ] Name: marchalgreen/Rundeklar
[ ] Description: (any description)

Environment Variables (5 total):
[ ] OPENAI_API_KEY = sk-... (SECRET ✅)
[ ] CODEX_MODEL = gpt-4o
[ ] CODEX_MAX_TOKENS = 4096
[ ] CODEX_TEMPERATURE = 0.7
[ ] CODEX_TIMEOUT = 30000

Secrets:
[ ] OPENAI_API_KEY = sk-... (same value)

Settings:
[ ] Container image: universal
[ ] Container Caching: On ✅
[ ] Setup Script: Automatic ✅
[ ] Agent Internet Access: On ✅

Final:
[ ] Clicked "Create environment"
[ ] Setup completed successfully
[ ] Terminal shows /workspace/Rundeklar$ prompt
```

---

**That's it!** Follow these steps exactly and you'll have your Codex environment set up with minimal manual work.

