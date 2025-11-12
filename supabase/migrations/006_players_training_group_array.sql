-- Migrate players.training_group from TEXT to TEXT[] to support multiple groups
-- Safely converts existing single values into single-element arrays and sets an empty array as default
-- Important: drop the old TEXT default first to avoid cast errors

ALTER TABLE players
  ALTER COLUMN training_group DROP DEFAULT;

ALTER TABLE players
  ALTER COLUMN training_group TYPE TEXT[]
  USING (
    CASE
      WHEN training_group IS NULL OR training_group = '' THEN ARRAY[]::TEXT[]
      ELSE ARRAY[training_group]
    END
  );

ALTER TABLE players
  ALTER COLUMN training_group SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN training_group SET NOT NULL;


