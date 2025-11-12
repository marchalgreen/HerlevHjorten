# Demo Deployment Setup

This guide explains how to set up a separate GitHub Pages deployment for the RundeManager demo without the `/HerlevHjorten/` prefix.

## Overview

The demo will be deployed to a separate GitHub repository (`RundeManagerDemo`) but managed from the same codebase. This gives you:
- **Main app**: `https://marchalgreen.github.io/HerlevHjorten/` (with prefix)
- **Demo app**: `https://marchalgreen.github.io/RundeManagerDemo/` (no prefix, clean URL)

## Step 1: Create the Demo Repository

1. Go to https://github.com/new
2. Repository name: `RundeManagerDemo`
3. Description: "RundeManager Demo - Badminton training management system"
4. Make it **Public** (required for GitHub Pages)
5. **Do NOT** initialize with README, .gitignore, or license
6. Click "Create repository"

## Step 2: Enable GitHub Pages

1. Go to your new `RundeManagerDemo` repository
2. Click **Settings** → **Pages**
3. Under **Source**, select:
   - **Source**: `Deploy from a branch`
   - **Branch**: `gh-pages` (or `main` if you prefer)
   - **Folder**: `/ (root)`
4. Click **Save**

## Step 3: Set Up Repository Access (if needed)

If the workflow fails with permission errors, you may need to create a Personal Access Token:

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with `repo` scope
3. Go to your `HerlevHjorten` repository → Settings → Secrets and variables → Actions
4. Add a new secret named `DEMO_DEPLOY_TOKEN` with your token value

Then update `.github/workflows/deploy-demo.yml` to use:
```yaml
github_token: ${{ secrets.DEMO_DEPLOY_TOKEN }}
```

## Step 4: Verify the Workflow

The workflow `.github/workflows/deploy-demo.yml` will automatically:
- Build the app with base path `/` (no prefix)
- Deploy to the `RundeManagerDemo` repository
- Trigger on every push to `main` branch

## Step 5: First Deployment

1. Push your changes to the main branch:
   ```bash
   git push origin main
   ```

2. Go to the **Actions** tab in your `HerlevHjorten` repository
3. Watch the "Deploy Demo to GitHub Pages" workflow run
4. Once complete, your demo will be available at:
   ```
   https://marchalgreen.github.io/RundeManagerDemo/#/rundemanager/coach
   ```

## Demo URLs

Once deployed, access the demo via:
- **Landing/Coach**: `https://marchalgreen.github.io/RundeManagerDemo/#/rundemanager/coach`
- **Check-in**: `https://marchalgreen.github.io/RundeManagerDemo/#/rundemanager/check-in`
- **Match Program**: `https://marchalgreen.github.io/RundeManagerDemo/#/rundemanager/match-program`
- **Players**: `https://marchalgreen.github.io/RundeManagerDemo/#/rundemanager/players`
- **Statistics**: `https://marchalgreen.github.io/RundeManagerDemo/#/rundemanager/statistics`

## How It Works

1. **Single Codebase**: All code is managed in `HerlevHjorten` repository
2. **Automatic Deployment**: When you push to `main`, two workflows run:
   - `deploy.yml` → Deploys main app to `HerlevHjorten` GitHub Pages (with prefix)
   - `deploy-demo.yml` → Deploys demo to `RundeManagerDemo` GitHub Pages (no prefix)
3. **Different Base Paths**: 
   - Main app builds with `base: '/HerlevHjorten/'`
   - Demo builds with `base: '/'`

## Troubleshooting

**Workflow fails with "repository not found"**
- Make sure `RundeManagerDemo` repository exists and is public
- Check that the repository name matches exactly: `marchalgreen/RundeManagerDemo`

**Demo not updating**
- Check the Actions tab for errors
- Verify the workflow has permission to write to the demo repository
- Make sure GitHub Pages is enabled in the demo repository settings

**Wrong base path**
- Verify `VITE_BASE_PATH: '/'` is set in the demo workflow
- Check that the demo repository uses the correct branch/folder for GitHub Pages

## Notes

- The demo repository will only contain the built files (from `packages/webapp/dist`)
- You don't need to manually manage the demo repository - it's automatically updated
- Both deployments use the same codebase, so updates are synchronized
- The demo uses the `rundemanager` tenant configuration

