# Deployment Guide - GitHub Pages

This guide will help you deploy your Herlev/Hjorten app to GitHub Pages so you can share it with friends.

## Prerequisites

- Your repository is public on GitHub
- You have push access to the repository

## Automatic Deployment (Recommended)

### Step 1: Enable GitHub Pages

1. **Go to your GitHub repository** on GitHub.com
2. **Click "Settings"** (top right)
3. **Scroll down to "Pages"** in the left sidebar
4. **Under "Source"**, select:
   - **Source**: `GitHub Actions`
5. **Save** (no need to click anything else, the workflow will handle it)

### Step 2: Push to Main Branch

The GitHub Actions workflow will automatically deploy when you push to `main` or `master`:

```bash
# Make sure you're on the main branch
git checkout main

# Commit and push
git add .
git commit -m "Setup GitHub Pages deployment"
git push origin main
```

### Step 3: Wait for Deployment

1. **Go to the "Actions" tab** in your GitHub repository
2. **Watch the workflow run** - it will:
   - Install dependencies
   - Build the app
   - Deploy to GitHub Pages
3. **Wait 2-3 minutes** for the first deployment

### Step 4: Get Your Live URL

Once deployed, your app will be available at:
```
https://<your-username>.github.io/HerlevHjorten/
```

For example, if your GitHub username is `mhalgreen`:
```
https://mhalgreen.github.io/HerlevHjorten/
```

## Manual Deployment (Alternative)

If you prefer to deploy manually:

```bash
# Build the app
pnpm build

# Install gh-pages if not already installed
pnpm add -D gh-pages

# Deploy (replace with your actual GitHub username/repo)
pnpm exec gh-pages -d packages/webapp/dist
```

## Important Notes

- **HashRouter**: Your app uses `HashRouter`, so routes will work with `#` (e.g., `https://your-username.github.io/HerlevHjorten/#/check-in`)
- **LocalStorage**: The app uses browser localStorage, so each user will have their own data
- **No Backend**: This is a client-side app, so all data is stored locally in the browser
- **Base Path**: The app is configured to work with the `/HerlevHjorten/` base path on GitHub Pages

## Updating Your App

Every time you push to the `main` branch, the app will automatically redeploy. Just push your changes:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

The GitHub Actions workflow will handle the rest!

## Troubleshooting

- **404 on routes**: Make sure you're using the HashRouter (which you are) - routes should work with `#`
- **Build fails**: Check the "Actions" tab for error messages
- **Assets not loading**: Verify the base path in `vite.config.ts` is set correctly

## Sharing Your App

Once deployed, share this URL with your friends:
```
https://<your-username>.github.io/HerlevHjorten/
```

🎉 Your app is now live!
