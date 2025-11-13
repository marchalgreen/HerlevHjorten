# Tenant Isolation Setup - Complete Guide

## ✅ What's Been Done

### 1. Database Schema (`supabase/migrations/001_add_tenant_isolation.sql`)
- ✅ Added `tenant_id TEXT NOT NULL DEFAULT 'default'` column to all tables:
  - `players`
  - `training_sessions`
  - `courts`
  - `check_ins`
  - `matches`
  - `match_players`
  - `statistics_snapshots`
- ✅ Created indexes on `tenant_id` for performance
- ✅ Updated unique constraints to include `tenant_id` (prevents conflicts between tenants)
- ✅ Updated RLS policies (application layer enforces tenant isolation)

### 2. Application Layer (`packages/webapp/src/api/postgres.ts`)
- ✅ All SELECT queries filter by `WHERE tenant_id = ${tenantId}`
- ✅ All INSERT queries include `tenant_id` in VALUES
- ✅ All UPDATE queries filter by `WHERE tenant_id = ${tenantId} AND id = ${id}`
- ✅ All DELETE queries filter by `WHERE tenant_id = ${tenantId} AND id = ${id}`
- ✅ Added `getTenantId()` helper function that gets tenant ID from context

### 3. API Proxy (`packages/webapp/api/db.ts` & `scripts/dev-api.ts`)
- ✅ Requires `tenantId` in request body for security
- ✅ Validates tenant ID is present before executing queries

### 4. Migration Script (`packages/webapp/scripts/migrate-supabase-to-neon.ts`)
- ✅ Exports data from multiple Supabase databases (one per tenant)
- ✅ Imports all data into single Neon database with `tenant_id` column
- ✅ Handles conflicts with `ON CONFLICT` clauses

## 📋 Next Steps

### Step 1: Apply Database Migration

Run the tenant isolation migration on your Neon database:

```sql
-- Run this in Neon SQL Editor
-- File: supabase/migrations/001_add_tenant_isolation.sql
```

This adds `tenant_id` columns and updates constraints.

### Step 2: Migrate Data from Supabase

If you have existing data in Supabase databases:

1. **Set up environment variables** in `.env.local`:
   ```bash
   # Supabase credentials (for migration)
   VITE_SUPABASE_URL_DEFAULT=https://your-default-project.supabase.co
   VITE_SUPABASE_ANON_KEY_DEFAULT=your-anon-key
   
   VITE_SUPABASE_URL_RUNDEMANAGER=https://your-rundemanager-project.supabase.co
   VITE_SUPABASE_ANON_KEY_RUNDEMANAGER=your-anon-key
   
   # Neon database (target)
   DATABASE_URL=postgresql://user:password@host/database?sslmode=require
   ```

2. **Run migration script**:
   ```bash
   cd packages/webapp
   pnpm tsx scripts/migrate-supabase-to-neon.ts
   ```

   This will:
   - Export all data from each Supabase database
   - Import into Neon with correct `tenant_id` values
   - Preserve all relationships and IDs

### Step 3: Update Tenant Configs

Update tenant configuration files to use Neon database:

**`packages/webapp/src/config/tenants/default.json`**:
```json
{
  "id": "default",
  "name": "HERLEV/HJORTEN",
  "logo": "logo.jpeg",
  "maxCourts": 8,
  "postgresUrl": "postgresql://user:password@host/database?sslmode=require",
  "features": {}
}
```

**`packages/webapp/src/config/tenants/rundemanager.json`**:
```json
{
  "id": "rundemanager",
  "name": "RundeManager",
  "logo": "rundemanagerlogo2.png",
  "maxCourts": 8,
  "postgresUrl": "postgresql://user:password@host/database?sslmode=require",
  "features": {}
}
```

**Note**: Both tenants can use the same `postgresUrl` (same Neon database) because tenant isolation is handled by `tenant_id` column.

### Step 4: Test Tenant Isolation

1. **Start the app**:
   ```bash
   # Terminal 1: API server
   cd packages/webapp
   pnpm dev:api
   
   # Terminal 2: Frontend
   cd packages/webapp
   pnpm dev
   ```

2. **Test default tenant** (`http://127.0.0.1:5173/#/check-in`):
   - Create a player
   - Start a session
   - Verify data appears correctly

3. **Test rundemanager tenant** (`http://127.0.0.1:5173/#/rundemanager/check-in`):
   - Should see different data (or empty if no data migrated)
   - Create a player
   - Verify it doesn't appear in default tenant

4. **Verify isolation**:
   - Check Neon database directly:
     ```sql
     SELECT tenant_id, COUNT(*) FROM players GROUP BY tenant_id;
     ```
   - Should show separate counts for each tenant

## 🔒 Security Notes

1. **Application-Level Filtering**: All queries automatically filter by `tenant_id` from the tenant context. This ensures:
   - Users can only see/modify their own tenant's data
   - No cross-tenant data leakage
   - Tenant ID is set from URL path (e.g., `/#/default/` vs `/#/rundemanager/`)

2. **API Proxy Validation**: The API proxy (`api/db.ts`) requires `tenantId` in the request body. This prevents:
   - Queries without tenant context
   - Malicious queries that bypass tenant filtering

3. **Database-Level Constraints**: Unique constraints include `tenant_id`, so:
   - Same IDs can exist for different tenants (e.g., player ID `abc-123` can exist for both `default` and `rundemanager`)
   - No conflicts between tenants

## 🐛 Troubleshooting

### "tenantId is required for security"
- **Cause**: API proxy is rejecting queries without tenant ID
- **Fix**: Make sure `TenantProvider` is mounted and tenant context is initialized

### "Tenant context not initialized"
- **Cause**: `getTenantId()` called before `TenantProvider` sets context
- **Fix**: Ensure `TenantProvider` wraps your app and tenant ID is extracted from URL

### Data from wrong tenant showing
- **Cause**: Queries not filtering by `tenant_id`
- **Fix**: Check that all queries in `postgres.ts` include `WHERE tenant_id = ${tenantId}`

### Migration script fails
- **Cause**: Missing environment variables or connection issues
- **Fix**: 
  1. Verify all Supabase URLs/keys are correct
  2. Verify Neon `DATABASE_URL` is correct
  3. Check that migration SQL has been applied first

## 📚 Related Files

- **Schema Migration**: `supabase/migrations/001_add_tenant_isolation.sql`
- **Database Adapter**: `packages/webapp/src/api/postgres.ts`
- **API Proxy**: `packages/webapp/api/db.ts`
- **Dev API Server**: `packages/webapp/scripts/dev-api.ts`
- **Migration Script**: `packages/webapp/scripts/migrate-supabase-to-neon.ts`
- **Tenant Context**: `packages/webapp/src/contexts/TenantContext.tsx`

## 🎯 Summary

You now have:
- ✅ Single Neon database shared by all tenants
- ✅ Complete tenant isolation via `tenant_id` column
- ✅ Automatic filtering in all queries
- ✅ Secure API proxy that validates tenant context
- ✅ Migration script to move data from Supabase

All tenants share the same database but are completely isolated from each other! 🔒

