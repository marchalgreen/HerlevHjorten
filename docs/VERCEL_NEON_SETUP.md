# Vercel + Neon Setup Guide

This guide walks you through setting up your project on Vercel with Neon database.

## Step 1: Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository (`HerlevHjorten`)
4. Vercel will auto-detect it's a monorepo - configure:
   - **Root Directory**: Leave as root (or set to `packages/webapp` if needed)
   - **Framework Preset**: Vite
   - **Build Command**: `cd packages/webapp && pnpm build`
   - **Output Directory**: `packages/webapp/dist`
   - **Install Command**: `pnpm install`

## Step 2: Create Neon Database

1. In your Vercel project dashboard, go to the **Storage** tab
2. Click "Create Database" → Select **Neon**
3. Choose a database name (e.g., `herlevhjorten` or `rundemanager`)
4. Select a region (choose closest to your users)
5. Click "Create"

## Step 3: Get Neon Connection String

After creating the Neon database:

1. In Vercel project → **Storage** tab → Click on your Neon database
2. Go to the **.env.local** tab or **Connection String** section
3. Copy the connection string - it will look like:
   ```
   postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```

**Important**: You'll need this connection string for each tenant config.

## Step 4: Apply Database Schema

1. In Vercel project → **Storage** tab → Click on your Neon database
2. Click "Open in Neon Dashboard" or use the SQL Editor
3. Copy the contents of `supabase/migrations/000_complete_schema_for_new_db.sql`
4. Paste and run it in the Neon SQL Editor
5. Verify tables were created (you should see: `players`, `training_sessions`, `courts`, `check_ins`, `matches`, `match_players`, `statistics_snapshots`)

## Step 5: Update Tenant Configs

Update your tenant configuration files with the Neon connection string:

### For Default Tenant (`packages/webapp/src/config/tenants/default.json`):

```json
{
  "id": "default",
  "name": "HERLEV/HJORTEN",
  "logo": "logo.jpeg",
  "maxCourts": 8,
  "postgresUrl": "postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/dbname?sslmode=require"
}
```

### For Demo Tenant (`packages/webapp/src/config/tenants/rundemanager.json`):

If you want a separate database for the demo:
1. Create another Neon database in Vercel
2. Apply the schema to it
3. Update `rundemanager.json` with the new connection string

Or use the same database with different data (they'll share the same tables).

## Step 6: Set Up Environment Variables (Optional)

If you want to use environment variables instead of hardcoding in tenant configs:

1. In Vercel project → **Settings** → **Environment Variables**
2. Add:
   - `POSTGRES_URL` = your Neon connection string
   - (Add for each environment: Production, Preview, Development)

Then update the code to read from env vars if needed (currently reads from tenant configs).

## Step 7: Deploy and Test

1. Push your changes (with updated tenant configs) to GitHub
2. Vercel will automatically deploy
3. Visit your deployed site
4. Test database operations:
   - Create a player
   - Start a training session
   - Check in players
   - Create matches

## Step 8: Seed Initial Data (Optional)

After deployment, you may want to seed some initial data:

1. Use the Neon SQL Editor or connect via `psql`
2. Run seed scripts (you'll need to update them to use Postgres first):
   ```bash
   pnpm exec tsx packages/webapp/scripts/seed-courts.ts default
   ```

## Troubleshooting

### Connection Issues

- **"Connection refused"**: Check that your Neon database is not paused (Neon pauses inactive databases)
- **"SSL required"**: Ensure connection string includes `?sslmode=require`
- **"Authentication failed"**: Verify connection string credentials are correct

### Build Issues

- **"Module not found"**: Ensure `pnpm install` runs correctly in Vercel
- **"Type errors"**: Check that TypeScript compilation passes locally first

### Database Issues

- **"Table does not exist"**: Run the migration SQL in Neon SQL Editor
- **"Permission denied"**: Check Neon database permissions in Vercel dashboard

## Multiple Tenants / Databases

If you need separate databases for different tenants:

1. Create multiple Neon databases in Vercel (one per tenant)
2. Apply schema to each database
3. Update each tenant config with its respective connection string

## Security Notes

- **Never commit connection strings to Git**: Consider using Vercel environment variables
- **Use different databases for production/demo**: Keeps data isolated
- **Rotate credentials regularly**: Update connection strings in tenant configs

## Next Steps

After setup:
1. ✅ Test all database operations
2. ✅ Migrate existing data from Supabase (if needed)
3. ✅ Update remaining scripts to use Postgres
4. ✅ Remove `@supabase/supabase-js` dependency (after scripts are migrated)

