# Vercel + Neon Setup - Complete Guide

## ✅ What We've Done

1. **Created Vercel API Route** (`packages/webapp/api/db.ts`)
   - Serverless function that proxies Postgres queries
   - Runs on Vercel's Node.js environment (where `postgres.js` works)
   - Handles CORS and error handling

2. **Updated Frontend** (`packages/webapp/src/api/postgres.ts`)
   - Browser-compatible Postgres client
   - Proxies all queries through Vercel API route
   - Maintains same API interface

3. **Removed Browser Dependencies**
   - Removed `postgres.js` direct usage in browser
   - Removed Buffer polyfills (no longer needed)

## 🚀 Setup Steps

### 1. Environment Variables in Vercel

Add these to your Vercel project:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `DATABASE_URL` = your Neon connection string (pooled)
   - `DATABASE_URL_UNPOOLED` = your Neon unpooled connection string (optional)

### 2. Apply Database Schema

Run the migration SQL in Neon:

1. Go to Neon Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/000_complete_schema_for_new_db.sql`
3. Paste and run in SQL Editor

### 3. Local Development

For local development, you need to run Vercel CLI to serve the API routes:

```bash
# Install Vercel CLI globally (if not already installed)
npm i -g vercel

# In the packages/webapp directory
cd packages/webapp
vercel dev
```

This will:
- Start Vite dev server on port 5173 (frontend)
- Start Vercel API routes on port 3000 (backend)

The frontend will automatically proxy API calls to `http://127.0.0.1:3000/api/db` in development.

### 4. Production Deployment

When you deploy to Vercel:
- Frontend builds and deploys automatically
- API routes (`api/db.ts`) deploy as serverless functions
- Environment variables are automatically available to API routes

## 📁 File Structure

```
packages/webapp/
├── api/
│   └── db.ts              # Vercel serverless function (backend)
├── src/
│   └── api/
│       └── postgres.ts    # Browser-compatible client (frontend)
└── vercel.json            # Vercel configuration
```

## 🔄 How It Works

1. **Browser** → Makes API call to `/api/db`
2. **Vercel API Route** → Receives query, executes on Neon using `postgres.js`
3. **Neon Database** → Returns results
4. **Vercel API Route** → Returns JSON response
5. **Browser** → Receives data

## 🧪 Testing

1. **Local**: Run `vercel dev` and test at `http://127.0.0.1:5173`
2. **Production**: Deploy to Vercel and test your deployed URL

## ⚠️ Important Notes

- **API Routes**: Must be in `packages/webapp/api/` directory for Vercel to detect them
- **Environment Variables**: Only available to API routes, not frontend (secure!)
- **Connection Pooling**: Use `DATABASE_URL` (pooled) for better performance
- **Development**: Requires `vercel dev` to run API routes locally

## 🐛 Troubleshooting

### "Cannot connect to API route"
- Make sure `vercel dev` is running locally
- Check that `api/db.ts` exists in `packages/webapp/api/`

### "DATABASE_URL not set"
- Add environment variables in Vercel dashboard
- For local dev, create `.env.local` with `DATABASE_URL=...`

### "Query failed"
- Check Neon database is accessible
- Verify schema is applied
- Check Vercel function logs for detailed errors

## ✅ Next Steps

1. Add `DATABASE_URL` to Vercel environment variables
2. Apply schema to Neon database
3. Test locally with `vercel dev`
4. Deploy to Vercel
5. Test production deployment

You're all set! 🎉

