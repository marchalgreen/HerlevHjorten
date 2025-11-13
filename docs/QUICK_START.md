# Quick Start - Vercel + Neon Setup

## ✅ Current Status

You're all set up! Here's what's working:

1. ✅ **Frontend**: React app running on port 5173
2. ✅ **API Server**: Express server running on port 3000 (local dev)
3. ✅ **Database**: Neon connection configured
4. ✅ **Environment**: `.env.local` with `DATABASE_URL`

## 🚀 Running Locally

### Start Both Servers

**Terminal 1 - API Server:**
```bash
cd packages/webapp
pnpm dev:api
```

**Terminal 2 - Frontend:**
```bash
cd packages/webapp
pnpm dev
```

### Or Use Vercel CLI (Alternative)

If you install Vercel CLI:
```bash
npm i -g vercel
cd packages/webapp
vercel dev
```

This runs both frontend and API routes together.

## 📋 Next Steps

1. **Apply Database Schema**
   - Go to Neon Dashboard → SQL Editor
   - Run `supabase/migrations/000_complete_schema_for_new_db.sql`

2. **Test the App**
   - Open `http://127.0.0.1:5173`
   - Try creating a player or starting a session

3. **Deploy to Vercel**
   - Push to GitHub
   - Vercel will automatically deploy
   - Add `DATABASE_URL` to Vercel environment variables

## 🔧 Troubleshooting

### "ERR_CONNECTION_REFUSED"
- Make sure `pnpm dev:api` is running in a separate terminal
- Check that port 3000 is not already in use

### "DATABASE_URL not set"
- Verify `.env.local` exists in `packages/webapp/`
- Check that `DATABASE_URL` is set (without quotes)
- Restart the API server after changing `.env.local`

### "Cannot connect to database"
- Verify your Neon connection string is correct
- Check Neon dashboard to ensure database is not paused
- Ensure connection string includes `?sslmode=require`

## 📁 File Structure

```
packages/webapp/
├── api/
│   └── db.ts              # Vercel serverless function (production)
├── scripts/
│   └── dev-api.ts         # Express server (local dev)
├── src/
│   └── api/
│       └── postgres.ts    # Browser client (calls API)
└── .env.local             # Environment variables (local)
```

## 🎯 How It Works

1. **Browser** → Makes fetch request to `/api/db`
2. **Vite Proxy** → Routes to `http://127.0.0.1:3000/api/db` (dev)
3. **Express Server** → Executes query on Neon using `postgres.js`
4. **Neon Database** → Returns results
5. **Browser** → Receives data

All database credentials stay server-side! 🔒

