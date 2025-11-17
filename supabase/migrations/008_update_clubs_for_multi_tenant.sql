-- Migration: Update clubs table for multi-tenant support
-- Adds role-based access control, PIN authentication for coaches, and username support
-- Run this AFTER 007_add_club_auth.sql

-- 1. Remove UNIQUE constraint from tenant_id (en tenant kan have mange clubs)
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_tenant_id_key;

-- 2. Remove UNIQUE constraint from email (samme email kan bruges i forskellige tenants)
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_email_key;

-- 3. Make password_hash nullable (coaches use pin_hash instead)
ALTER TABLE clubs ALTER COLUMN password_hash DROP NOT NULL;

-- 4. Add role column
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'coach' 
  CHECK (role IN ('super_admin', 'admin', 'coach'));

-- 5. Add username column (nullable for admins, required for coaches)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS username TEXT;

-- 6. Add PIN code support columns for coaches
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS pin_reset_token TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS pin_reset_expires TIMESTAMPTZ;

-- 7. Add composite unique constraint (email, tenant_id) - samme email kan bruges i forskellige tenants
ALTER TABLE clubs ADD CONSTRAINT IF NOT EXISTS clubs_email_tenant_unique UNIQUE (email, tenant_id);

-- 8. Add composite unique constraint (username, tenant_id) - username skal være unik per tenant
ALTER TABLE clubs ADD CONSTRAINT IF NOT EXISTS clubs_username_tenant_unique UNIQUE (username, tenant_id);

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clubs_role ON clubs(role);
CREATE INDEX IF NOT EXISTS idx_clubs_tenant_role ON clubs(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_clubs_username_tenant ON clubs(username, tenant_id) WHERE username IS NOT NULL;

-- 10. Migrate existing clubs to 'admin' role (de er tenant admins)
-- Only migrate clubs that don't have a role set AND have password_hash (existing admins)
-- Do NOT migrate coaches (they should have pin_hash, not password_hash)
UPDATE clubs 
SET role = 'admin' 
WHERE role IS NULL 
  AND password_hash IS NOT NULL 
  AND pin_hash IS NULL;

-- 11. Drop old constraint if it exists
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_coach_requires_username_pin;

-- 12. Add constraint: coaches must have username and PIN, admins must have password_hash
-- Note: This is enforced at application level, but we add a check constraint for data integrity
ALTER TABLE clubs ADD CONSTRAINT IF NOT EXISTS clubs_role_auth_requirements 
  CHECK (
    (role = 'coach' AND username IS NOT NULL AND pin_hash IS NOT NULL AND password_hash IS NULL) OR
    (role IN ('admin', 'super_admin') AND password_hash IS NOT NULL)
  );

