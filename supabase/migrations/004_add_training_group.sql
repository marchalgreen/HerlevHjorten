-- Add training group support to players
-- Adds a new column for grouping players into training groups
-- All existing players will be assigned to 'Senior A' via DEFAULT backfill

ALTER TABLE players
ADD COLUMN IF NOT EXISTS training_group TEXT NOT NULL DEFAULT 'Senior A';


