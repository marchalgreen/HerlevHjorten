# RundeManager Demo Setup Guide

This guide will help you set up RundeManagerDemoDB as a replica of HerlevHjortenDB for demonstration and sales purposes.

## Prerequisites

- Access to your Supabase dashboard
- RundeManagerDemoDB project created in Supabase
- GitHub repository access (for deploying the demo)

## Step 1: Apply Database Schema to RundeManagerDemoDB

1. **Open your Supabase dashboard**
   - Go to https://supabase.com/dashboard
   - Select your **RundeManagerDemoDB** project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and run the complete schema**
   - Open `supabase/migrations/000_complete_schema_for_new_db.sql` from this repo
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" (or press Ctrl/Cmd + Enter)

4. **Verify the schema was created**
   - Go to "Table Editor" in the left sidebar
   - You should see these tables:
     - `players`
     - `training_sessions`
     - `courts`
     - `check_ins`
     - `matches`
     - `match_players`
     - `statistics_snapshots`

## Step 2: Get Your Supabase Credentials

1. **Get your project URL**
   - In Supabase dashboard, go to "Settings" → "API"
   - Copy the "Project URL" (looks like `https://xxxxx.supabase.co`)

2. **Get your anon/public key**
   - In the same "Settings" → "API" page
   - Copy the "anon public" key (starts with `eyJhbGci...`)

## Step 3: Configure the Tenant

1. **Update the tenant config file**
   - Open `packages/webapp/src/config/tenants/rundemanager.json`
   - Replace the empty `supabaseUrl` with your RundeManagerDemoDB project URL
   - Replace the empty `supabaseKey` with your anon/public key

   Example:
   ```json
   {
     "id": "rundemanager",
     "name": "RundeManager Demo",
     "logo": "logo.jpeg",
     "maxCourts": 8,
     "supabaseUrl": "https://your-project-id.supabase.co",
     "supabaseKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "features": {}
   }
   ```

## Step 4: Seed Initial Data (Optional but Recommended)

You can seed the database with demo data using the existing seed scripts:

1. **Seed courts** (required for the app to work):
   ```bash
   pnpm exec tsx packages/webapp/scripts/seed-courts.ts rundemanager
   ```

2. **Seed demo players and data** (optional):
   ```bash
   pnpm exec tsx packages/webapp/scripts/seed-demo-data.ts rundemanager
   ```

## Step 5: Test Locally

1. **Start the dev server**:
   ```bash
   pnpm dev
   ```

2. **Access the demo tenant**:
   - Navigate to `http://127.0.0.1:5173/#/rundemanager/coach`
   - Or use any route with `/rundemanager/` prefix:
     - `/#/rundemanager/check-in`
     - `/#/rundemanager/match-program`
     - `/#/rundemanager/players`
     - `/#/rundemanager/statistics`

## Step 6: Deploy to GitHub Pages (Separate Deployment)

For a separate GitHub Pages deployment:

### Option A: Same Repository, Different Branch/Path

1. **Create a new GitHub Pages site** pointing to a different branch or path
2. **Update build configuration** to use the `rundemanager` tenant by default

### Option B: Separate Repository (Recommended for Sales/Demo)

1. **Create a new GitHub repository** (e.g., `RundeManagerDemo`)
2. **Copy the webapp code** to the new repo
3. **Update the default tenant** in the app to use `rundemanager`
4. **Set up GitHub Pages** for the new repository
5. **Configure environment variables** in GitHub Actions (if needed)

### Option C: Use Subdomain/Domain Routing

If you want both apps accessible from the same domain:
- Main app: `herlevhjorten.yourdomain.com`
- Demo app: `demo.yourdomain.com` or `rundemanager.yourdomain.com`

## Step 7: Access the Demo App

Once deployed, access the demo tenant via:
- `https://your-github-pages-url.com/#/rundemanager/coach`
- Or configure routing to make `rundemanager` the default tenant

## Troubleshooting

### Database connection issues
- Verify your Supabase URL and key are correct in `rundemanager.json`
- Check that RLS policies are set correctly (they should allow public access for demo)
- Ensure the schema was applied successfully

### Tenant not found
- Make sure `rundemanager.json` exists in `packages/webapp/src/config/tenants/`
- Verify the tenant ID matches the URL path (`/rundemanager/...`)

### Courts not showing
- Run the seed-courts script: `pnpm exec tsx packages/webapp/scripts/seed-courts.ts rundemanager`
- Check that courts were created in the Supabase table editor

## Next Steps

- Add demo data (players, sessions, matches) for realistic demonstrations
- Customize branding (logo, name) in the tenant config
- Set up automated demo data refresh if needed
- Configure analytics/tracking for demo usage

## Notes

- The demo database is completely separate from your production HerlevHjortenDB
- All data changes in the demo won't affect production
- You can reset the demo database anytime by re-running the schema migration
- Consider setting up automated demo data seeding for fresh demos

