# Diagnose Migration Issues

## Step 1: Check if migrations ran successfully

Run these queries to diagnose:

### 1. Check if clubs table exists and has the new columns
```sql
-- Check if role column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'clubs' 
  AND column_name IN ('role', 'username', 'pin_hash', 'pin_reset_token', 'pin_reset_expires')
ORDER BY column_name;
```

**Expected:** Should show all 5 columns (role, username, pin_hash, pin_reset_token, pin_reset_expires)

### 2. Check if there are ANY clubs/users in database
```sql
SELECT COUNT(*) as total_clubs FROM clubs;
```

**Expected:** 
- If 0: Database is empty, need to create first user
- If > 0: Check tenant_id values

### 3. Check all tenant IDs in clubs table
```sql
SELECT tenant_id, COUNT(*) as count 
FROM clubs 
GROUP BY tenant_id;
```

**Expected:**
- If empty: No users exist
- If shows 'default': Migration 010 hasn't run or failed
- If shows 'herlev-hjorten': Migration worked!

### 4. Check if constraints were updated
```sql
-- Check unique constraints on clubs table
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'clubs'::regclass
  AND contype = 'u'; -- 'u' = unique constraint
```

**Expected:** Should see `clubs_email_tenant_unique` and `clubs_username_tenant_unique` constraints

## Step 2: Common Issues and Solutions

### Issue 1: Migration 008 failed silently

**Symptom:** Role column doesn't exist

**Solution:** Run migration 008 again, check for errors:
```sql
-- Try adding role column manually
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'coach' 
  CHECK (role IN ('super_admin', 'admin', 'coach'));
```

### Issue 2: Migration 010 ran but no data to migrate

**Symptom:** Count is 0 for both 'default' and 'herlev-hjorten'

**Solution:** Database is empty. You need to create first admin user.

### Issue 3: Constraints preventing migration

**Symptom:** Migration fails with constraint errors

**Solution:** Check existing constraints and drop if needed:
```sql
-- List all constraints
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'clubs'::regclass;
```

## Step 3: Create First Admin User

If database is empty (count = 0), create your first admin user:

### Option A: Use the API (recommended)

1. Start the app:
```bash
cd packages/webapp
pnpm dev
```

2. Use the register endpoint or create admin via super admin API

### Option B: Create manually with SQL (requires password hash)

You'll need to hash a password first. Use Node.js:

```bash
cd packages/webapp
node -e "
const argon2 = require('@node-rs/argon2');
argon2.hash('your-password-here').then(hash => {
  console.log('Password hash:', hash);
});
"
```

Then insert:
```sql
INSERT INTO clubs (
  tenant_id,
  email,
  password_hash,
  role,
  email_verified
) VALUES (
  'herlev-hjorten',
  'admin@example.com',
  'PASTE_HASH_HERE',
  'admin',
  true
);
```

### Option C: Use migration script

```bash
cd packages/webapp
pnpm exec tsx scripts/migrate-default-to-herlev-hjorten.ts
```

## Step 4: Verify Everything Works

After creating admin user:

```sql
-- Should return 1 or more
SELECT COUNT(*) FROM clubs WHERE tenant_id = 'herlev-hjorten';

-- Should show admin user
SELECT id, email, role, tenant_id FROM clubs WHERE tenant_id = 'herlev-hjorten';
```

