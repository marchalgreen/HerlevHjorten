# How to Apply Database Migrations

This project uses raw SQL migrations (not Prisma). Migrations are located in `supabase/migrations/` and need to be run manually in your database SQL editor.

## New Migrations to Apply

After implementing the multi-tenant architecture, you need to apply these migrations:

1. **008_update_clubs_for_multi_tenant.sql** - Adds roles, PIN support, and multi-tenant constraints
2. **010_rename_default_tenant.sql** - Renames default tenant to herlev-hjorten

## Step-by-Step Instructions

### Option 1: Neon Database (Recommended)

1. **Open Neon Dashboard**
   - Go to [console.neon.tech](https://console.neon.tech)
   - Select your project
   - Click **SQL Editor** in the left sidebar

2. **Run Migration 008**
   - Click **New Query**
   - Open `supabase/migrations/008_update_clubs_for_multi_tenant.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click **Run** (or press Cmd/Ctrl + Enter)
   - Wait for "Success" message

3. **Run Migration 010**
   - Click **New Query** again
   - Open `supabase/migrations/010_rename_default_tenant.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click **Run**
   - Wait for "Success" message

### Option 2: Supabase Database

1. **Open Supabase Dashboard**
   - Go to [supabase.com](https://supabase.com)
   - Select your project
   - Click **SQL Editor** in the left sidebar

2. **Run Migrations**
   - Follow the same steps as Neon (above)
   - Copy and paste each migration file
   - Run them in order (008 first, then 010)

### Option 3: psql Command Line

If you have `psql` installed and your database connection string:

```bash
# Set your database URL
export DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Run migration 008
psql "$DATABASE_URL" -f supabase/migrations/008_update_clubs_for_multi_tenant.sql

# Run migration 010
psql "$DATABASE_URL" -f supabase/migrations/010_rename_default_tenant.sql
```

## Verify Migrations

After running the migrations, verify they worked:

```sql
-- Check that role column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clubs' AND column_name = 'role';

-- Check that username column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clubs' AND column_name = 'username';

-- Check that PIN columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clubs' AND column_name IN ('pin_hash', 'pin_reset_token', 'pin_reset_expires');

-- Check that default tenant was renamed (should return 0)
SELECT COUNT(*) FROM clubs WHERE tenant_id = 'default';

-- Check that herlev-hjorten tenant exists (should return > 0)
SELECT COUNT(*) FROM clubs WHERE tenant_id = 'herlev-hjorten';
```

## Troubleshooting

### Error: "constraint does not exist"
- This is normal if the constraint was never created
- The migration uses `DROP CONSTRAINT IF EXISTS` so it's safe

### Error: "column already exists"
- This means the migration was partially run before
- Check which columns already exist and skip those statements

### Error: "relation does not exist"
- Make sure migration `007_add_club_auth.sql` was run first
- The `clubs` table must exist before running migration 008

### Error: "permission denied"
- Make sure you're using a database user with sufficient permissions
- For Neon/Supabase, use the SQL Editor (it has admin permissions)

## Migration Order

Make sure migrations are run in this order:

1. `001_initial_schema.sql` (or `000_complete_schema_for_new_db.sql`)
2. `007_add_club_auth.sql` (creates clubs table)
3. `008_update_clubs_for_multi_tenant.sql` (adds roles, PIN, etc.)
4. `010_rename_default_tenant.sql` (renames default to herlev-hjorten)

## After Migrations

Once migrations are applied:

1. **Update existing admin users**: Set their role to 'admin' if not already set
   ```sql
   UPDATE clubs SET role = 'admin' WHERE role IS NULL OR role = '';
   ```

2. **Create a super admin** (if needed):
   ```sql
   -- First, create a user with email/password (use your password hashing)
   -- Then update role:
   UPDATE clubs SET role = 'super_admin' WHERE email = 'your-email@example.com';
   ```

3. **Test the system**:
   - Try logging in with PIN (coaches)
   - Try logging in with email/password (admins)
   - Verify admin module is accessible

## Need Help?

If you encounter issues:

1. Check the migration file comments for specific requirements
2. Verify your database connection is working
3. Check that previous migrations were applied successfully
4. Review error messages carefully - they often indicate what's missing

