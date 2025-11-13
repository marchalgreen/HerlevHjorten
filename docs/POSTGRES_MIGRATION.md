# Migration from Supabase to Postgres (Vercel Neon)

This guide explains how to migrate from Supabase to Vercel Neon Postgres database.

## Overview

The application has been migrated from using Supabase client (`@supabase/supabase-js`) to using direct Postgres client (`postgres.js`). This allows you to use any Postgres-compatible database, including Vercel Neon.

## What Changed

### Core Changes

1. **Database Client**: Replaced `@supabase/supabase-js` with `postgres.js`
2. **Tenant Config**: Updated to use `postgresUrl` (Postgres connection string) instead of `supabaseUrl` and `supabaseKey`
3. **API Layer**: All database operations now use raw SQL queries instead of Supabase query builder
4. **Context**: `TenantContext` now provides `postgres` client instead of `supabase` client

### Files Modified

- `packages/common/src/index.ts` - Updated `TenantConfig` type
- `packages/webapp/src/lib/postgres.ts` - New Postgres client adapter (replaces `lib/supabase.ts`)
- `packages/webapp/src/api/postgres.ts` - New Postgres database operations (replaces `api/supabase.ts`)
- `packages/webapp/src/contexts/TenantContext.tsx` - Updated to use Postgres client
- `packages/webapp/src/api/index.ts` - Updated imports to use Postgres adapter
- `packages/webapp/src/api/stats.ts` - Updated imports and comments

### Files Still Using Supabase (Need Migration)

The following scripts still use Supabase client and need to be migrated:

- `packages/webapp/scripts/generate-dummy-statistics.ts`
- `packages/webapp/scripts/clear-statistics.ts`
- `packages/webapp/scripts/refresh-senior-a-players.ts`
- `packages/webapp/scripts/update-demo-players.ts`
- `packages/webapp/scripts/clear-rangliste.ts`
- `packages/webapp/scripts/seed-demo-data.ts`
- `packages/webapp/scripts/seed-courts.ts`
- `packages/webapp/scripts/setup-supabase.ts`
- `packages/webapp/scripts/create-tenant.ts`
- `packages/webapp/scripts/migrate-to-supabase.ts`
- `packages/webapp/scripts/run-migration.ts`

## Migration Steps

### Step 1: Set Up Vercel Neon Database

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Create a new Neon project or use an existing one
3. Get your Postgres connection string from the Neon dashboard
   - Format: `postgresql://user:password@host:port/database?sslmode=require`

### Step 2: Update Tenant Configuration

Update your tenant config files in `packages/webapp/src/config/tenants/`:

**Before (Supabase):**
```json
{
  "id": "default",
  "name": "HERLEV/HJORTEN",
  "logo": "logo.jpeg",
  "maxCourts": 8,
  "supabaseUrl": "https://xxxxx.supabase.co",
  "supabaseKey": "eyJhbGci..."
}
```

**After (Postgres/Neon):**
```json
{
  "id": "default",
  "name": "HERLEV/HJORTEN",
  "logo": "logo.jpeg",
  "maxCourts": 8,
  "postgresUrl": "postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/dbname?sslmode=require"
}
```

### Step 3: Apply Database Schema

Your existing SQL migrations in `supabase/migrations/` work with any Postgres database. Apply them to Neon:

1. Use the Neon SQL Editor in the dashboard
2. Copy the contents of `supabase/migrations/000_complete_schema_for_new_db.sql`
3. Paste and run it in the Neon SQL Editor

Alternatively, use `psql`:
```bash
psql "your-neon-connection-string" < supabase/migrations/000_complete_schema_for_new_db.sql
```

### Step 4: Migrate Data (Optional)

If you have existing data in Supabase that you want to migrate:

1. Export data from Supabase (using Supabase dashboard or `pg_dump`)
2. Import to Neon (using `psql` or Neon dashboard)

Or use a migration script (you'll need to update the scripts to use Postgres client).

### Step 5: Update Environment Variables (If Used)

If you're using environment variables for database connection, update them:

**Before:**
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**After:**
```
VITE_POSTGRES_URL=postgresql://user:password@host:port/database?sslmode=require
```

Note: The application currently reads from tenant config files, not environment variables, so this step may not be necessary.

### Step 6: Test the Application

1. Start the development server: `pnpm dev`
2. Verify that the application connects to Neon successfully
3. Test all database operations (create players, start sessions, etc.)

## Script Migration

Scripts that directly use Supabase client need to be updated. Here's an example of how to migrate a script:

**Before:**
```typescript
import { createClient } from '@supabase/supabase-js'
import { loadTenantConfig } from '../src/lib/tenant'

const config = await loadTenantConfig('default')
const supabase = createClient(config.supabaseUrl, config.supabaseKey)
const { data } = await supabase.from('players').select('*')
```

**After:**
```typescript
import postgres from 'postgres'
import { loadTenantConfig } from '../src/lib/tenant'

const config = await loadTenantConfig('default')
const sql = postgres(config.postgresUrl, { ssl: 'require' })
const players = await sql`SELECT * FROM players`
```

## Key Differences

### Query Syntax

**Supabase (Before):**
```typescript
const { data, error } = await supabase
  .from('players')
  .select('*')
  .eq('active', true)
  .order('name')
```

**Postgres (After):**
```typescript
const players = await sql`
  SELECT * FROM players 
  WHERE active = true 
  ORDER BY name
`
```

### Insert Operations

**Supabase (Before):**
```typescript
const { data, error } = await supabase
  .from('players')
  .insert({ name: 'John', active: true })
  .select()
  .single()
```

**Postgres (After):**
```typescript
const [player] = await sql`
  INSERT INTO players (name, active)
  VALUES (${'John'}, ${true})
  RETURNING *
`
```

### Update Operations

**Supabase (Before):**
```typescript
const { data, error } = await supabase
  .from('players')
  .update({ active: false })
  .eq('id', playerId)
  .select()
  .single()
```

**Postgres (After):**
```typescript
const [updated] = await sql`
  UPDATE players 
  SET active = ${false}
  WHERE id = ${playerId}
  RETURNING *
`
```

## Troubleshooting

### Connection Issues

- **SSL Required**: Ensure your connection string includes `?sslmode=require` for Neon
- **Connection Timeout**: Check that your Neon database is accessible and not paused
- **Authentication**: Verify your connection string credentials are correct

### Query Errors

- **Array Parameters**: Use `sql.array()` for array parameters:
  ```typescript
  await sql`UPDATE players SET training_group = ${sql.array(['Senior A'])}`
  ```
- **JSON Parameters**: Use `sql.json()` for JSON parameters:
  ```typescript
  await sql`INSERT INTO statistics_snapshots (matches) VALUES (${sql.json(matches)})`
  ```

### Type Errors

- Ensure you're importing from `./postgres` instead of `./supabase`
- Update `TenantContext` usage: `useTenant().postgres` instead of `useTenant().supabase`

## Backward Compatibility

The `TenantConfig` type still accepts `supabaseUrl` and `supabaseKey` for backward compatibility during migration, but `postgresUrl` is now required. You can migrate tenant configs one at a time.

## Next Steps

1. Update all tenant config files with `postgresUrl`
2. Migrate remaining scripts to use Postgres client
3. Remove `@supabase/supabase-js` dependency (after all scripts are migrated)
4. Update documentation references from Supabase to Postgres/Neon

