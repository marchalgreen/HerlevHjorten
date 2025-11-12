-- Explicitly backfill training_group for all existing players
-- Ensures rows created before the column existed are set to 'Senior A'

UPDATE players
SET training_group = 'Senior A'
WHERE training_group IS NULL OR training_group = '';


