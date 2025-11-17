-- Migration: Normalize all coach usernames to lowercase
-- This ensures case-insensitive username matching works correctly
-- Run this AFTER 008_update_clubs_for_multi_tenant.sql

-- Update all coach usernames to lowercase
UPDATE clubs
SET username = LOWER(username)
WHERE role = 'coach' 
  AND username IS NOT NULL
  AND username != LOWER(username);

-- Add comment for documentation
COMMENT ON COLUMN clubs.username IS 'Username for coaches (stored in lowercase for case-insensitive matching)';

