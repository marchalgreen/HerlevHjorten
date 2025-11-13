# Local Development Setup

## Running the Application Locally

Since we're using Vercel API routes for database access, you need to run both the frontend and the API routes.

### Option 1: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally (if not already installed)
npm i -g vercel

# Navigate to webapp directory
cd packages/webapp

# Start both frontend and API routes
vercel dev
```

This will:
- Start Vite dev server on port 5173 (frontend)
- Start Vercel API routes on port 3000 (backend)
- Frontend automatically proxies API calls to `http://127.0.0.1:3000/api/db`

### Option 2: Separate Terminals

If you prefer to run them separately:

**Terminal 1 - Frontend:**
```bash
cd packages/webapp
pnpm dev
```

**Terminal 2 - API Routes:**
```bash
cd packages/webapp
vercel dev --listen 3000
```

### Environment Variables

Create `.env.local` in `packages/webapp/`:

```bash
DATABASE_URL=postgresql://user:password@ep-xxxxx.region.aws.neon.tech/dbname?sslmode=require
```

**Note**: The API route reads `DATABASE_URL` from environment variables. The frontend doesn't need it.

## Troubleshooting

### "Cannot connect to API route"
- Make sure `vercel dev` is running
- Check that `api/db.ts` exists in `packages/webapp/api/`
- Verify the API route is accessible at `http://127.0.0.1:3000/api/db`

### "DATABASE_URL not set"
- Create `.env.local` in `packages/webapp/` with your Neon connection string
- Restart `vercel dev` after adding environment variables

### "sql is not a function"
- This should be fixed now - refresh your browser
- Make sure you're using the latest code

