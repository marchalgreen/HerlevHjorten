-- Migration: Rename super_admin role to sysadmin
-- This makes the role name more accurate and professional

-- 1. First, drop constraints to allow data updates
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_role_check;
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_role_auth_requirements;

-- 2. Check for any super_admin users that don't have password_hash
-- These would violate the constraint, so we need to handle them
-- For now, we'll only update super_admin users that have password_hash
-- (which should be all of them, as super_admin requires password authentication)

-- 3. Update existing data: Change all 'super_admin' roles to 'sysadmin'
-- Only update users that have password_hash (required for admin/sysadmin roles)
UPDATE clubs 
SET role = 'sysadmin' 
WHERE role = 'super_admin' 
  AND password_hash IS NOT NULL;

-- 4. If there are any super_admin users without password_hash, 
-- they should be coaches, not admins. Convert them to coaches.
-- (This is a safety measure - should not happen in practice)
UPDATE clubs 
SET role = 'coach'
WHERE role = 'super_admin' 
  AND password_hash IS NULL
  AND username IS NOT NULL
  AND pin_hash IS NOT NULL;

-- 5. Add new CHECK constraint with 'sysadmin' instead of 'super_admin'
ALTER TABLE clubs ADD CONSTRAINT clubs_role_check 
  CHECK (role IN ('sysadmin', 'admin', 'coach'));

-- 6. Re-add role_auth_requirements constraint with 'sysadmin'
ALTER TABLE clubs ADD CONSTRAINT clubs_role_auth_requirements 
  CHECK (
    (role = 'coach' AND username IS NOT NULL AND pin_hash IS NOT NULL AND password_hash IS NULL) OR
    (role IN ('admin', 'sysadmin') AND password_hash IS NOT NULL)
  );

