-- Migration to add new columns to existing database
-- Run this in your ORIGINAL database first, then use the updated 001_initial_schema.sql for new databases

-- Add preferred partner columns to players table
-- These store arrays of player IDs for preferred doubles and mixed partners
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS preferred_doubles_partners UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_mixed_partners UUID[] DEFAULT '{}';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_preferred_doubles_partners ON players USING GIN(preferred_doubles_partners);
CREATE INDEX IF NOT EXISTS idx_players_preferred_mixed_partners ON players USING GIN(preferred_mixed_partners);

-- Split level into three separate ranking fields
-- Add new ranking columns
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS level_single INTEGER,
  ADD COLUMN IF NOT EXISTS level_double INTEGER,
  ADD COLUMN IF NOT EXISTS level_mix INTEGER;

-- Note: The old 'level' column will remain for backward compatibility
-- You can drop it later if needed with: ALTER TABLE players DROP COLUMN IF EXISTS level;

-- Example: Add new columns to training_sessions table
-- ALTER TABLE training_sessions
--   ADD COLUMN IF NOT EXISTS new_column_name TEXT;

-- Example: Add new columns to courts table
-- ALTER TABLE courts
--   ADD COLUMN IF NOT EXISTS new_column_name TEXT;

-- Example: Add new columns to check_ins table
-- ALTER TABLE check_ins
--   ADD COLUMN IF NOT EXISTS new_column_name TEXT;

-- Example: Add new columns to matches table
-- ALTER TABLE matches
--   ADD COLUMN IF NOT EXISTS new_column_name TEXT;

-- Example: Add new columns to match_players table
-- ALTER TABLE match_players
--   ADD COLUMN IF NOT EXISTS new_column_name TEXT;

-- Example: Add new columns to statistics_snapshots table
-- ALTER TABLE statistics_snapshots
--   ADD COLUMN IF NOT EXISTS new_column_name TEXT;

-- After adding columns, you may want to create indexes:
-- CREATE INDEX IF NOT EXISTS idx_table_name_column_name ON table_name(column_name);

