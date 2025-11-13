# Vercel Monorepo Setup Guide

## Important: Configure Root Directory in Vercel Dashboard

**`rootDirectory` is NOT a property in `vercel.json`** - it must be configured in the Vercel Dashboard project settings.

## Step-by-Step Setup

### 1. Configure Project Settings in Vercel Dashboard

1. Go to your Vercel project: **Settings** → **General**
2. Scroll to **Root Directory**
3. Click **Edit** and set it to: `packages/webapp`
4. Click **Save**

### 2. vercel.json Configuration

The `vercel.json` file should contain:

```json
{
  "buildCommand": "pnpm --filter webapp build",
  "outputDirectory": "packages/webapp/dist",
  "installCommand": "pnpm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Key Points:**
- `buildCommand`: Uses `pnpm --filter webapp build` to build only the webapp workspace
- `outputDirectory`: Set to `packages/webapp/dist` (relative to repo root)
- `installCommand`: `pnpm install` installs all workspace dependencies
- **NO `rootDirectory`** in vercel.json - this is set in Dashboard only

### 3. How It Works

1. Vercel clones your repo
2. Runs `pnpm install` from repo root (installs all workspace deps)
3. Changes directory to `packages/webapp` (based on Dashboard setting)
4. Runs `pnpm --filter webapp build` (builds the webapp)
5. Looks for output in `packages/webapp/dist` (relative to repo root)

### 4. Alternative: If Root Directory Setting Doesn't Work

If setting rootDirectory in Dashboard doesn't work, you can use absolute paths:

```json
{
  "buildCommand": "cd packages/webapp && pnpm build",
  "outputDirectory": "packages/webapp/dist",
  "installCommand": "pnpm install",
  "framework": "vite"
}
```

But the recommended approach is to set Root Directory in Dashboard and use workspace filters in buildCommand.

## References

- [Vercel Monorepo Documentation](https://vercel.com/docs/monorepos)
- [Vercel Build Configuration](https://docs.vercel.com/docs/builds)

