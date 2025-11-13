-- Migration: Add tenant_id column to all tables for multi-tenancy
-- This allows multiple clubs/tenants to share the same database securely
-- Run this AFTER the initial schema migration (000_complete_schema_for_new_db.sql)

-- Add tenant_id column to all tables
ALTER TABLE players ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE courts ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE statistics_snapshots ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- Create indexes on tenant_id for performance
CREATE INDEX IF NOT EXISTS idx_players_tenant_id ON players(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_tenant_id ON training_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courts_tenant_id ON courts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_tenant_id ON check_ins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_matches_tenant_id ON matches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_match_players_tenant_id ON match_players(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statistics_snapshots_tenant_id ON statistics_snapshots(tenant_id);

-- Update unique constraints to include tenant_id
-- Drop old unique constraints first
ALTER TABLE check_ins DROP CONSTRAINT IF EXISTS check_ins_session_id_player_id_key;
ALTER TABLE match_players DROP CONSTRAINT IF EXISTS match_players_match_id_slot_key;
ALTER TABLE statistics_snapshots DROP CONSTRAINT IF EXISTS statistics_snapshots_session_id_key;
ALTER TABLE courts DROP CONSTRAINT IF EXISTS courts_idx_key;

-- Add new unique constraints with tenant_id
ALTER TABLE check_ins ADD CONSTRAINT check_ins_session_id_player_id_tenant_id_key UNIQUE(session_id, player_id, tenant_id);
ALTER TABLE match_players ADD CONSTRAINT match_players_match_id_slot_tenant_id_key UNIQUE(match_id, slot, tenant_id);
ALTER TABLE statistics_snapshots ADD CONSTRAINT statistics_snapshots_session_id_tenant_id_key UNIQUE(session_id, tenant_id);
ALTER TABLE courts ADD CONSTRAINT courts_idx_tenant_id_key UNIQUE(idx, tenant_id);

-- Update RLS policies to filter by tenant_id
-- Drop old policies
DROP POLICY IF EXISTS "Allow public read access on players" ON players;
DROP POLICY IF EXISTS "Allow public insert access on players" ON players;
DROP POLICY IF EXISTS "Allow public update access on players" ON players;
DROP POLICY IF EXISTS "Allow public delete access on players" ON players;

DROP POLICY IF EXISTS "Allow public read access on training_sessions" ON training_sessions;
DROP POLICY IF EXISTS "Allow public insert access on training_sessions" ON training_sessions;
DROP POLICY IF EXISTS "Allow public update access on training_sessions" ON training_sessions;
DROP POLICY IF EXISTS "Allow public delete access on training_sessions" ON training_sessions;

DROP POLICY IF EXISTS "Allow public read access on courts" ON courts;
DROP POLICY IF EXISTS "Allow public insert access on courts" ON courts;
DROP POLICY IF EXISTS "Allow public update access on courts" ON courts;
DROP POLICY IF EXISTS "Allow public delete access on courts" ON courts;

DROP POLICY IF EXISTS "Allow public read access on check_ins" ON check_ins;
DROP POLICY IF EXISTS "Allow public insert access on check_ins" ON check_ins;
DROP POLICY IF EXISTS "Allow public update access on check_ins" ON check_ins;
DROP POLICY IF EXISTS "Allow public delete access on check_ins" ON check_ins;

DROP POLICY IF EXISTS "Allow public read access on matches" ON matches;
DROP POLICY IF EXISTS "Allow public insert access on matches" ON matches;
DROP POLICY IF EXISTS "Allow public update access on matches" ON matches;
DROP POLICY IF EXISTS "Allow public delete access on matches" ON matches;

DROP POLICY IF EXISTS "Allow public read access on match_players" ON match_players;
DROP POLICY IF EXISTS "Allow public insert access on match_players" ON match_players;
DROP POLICY IF EXISTS "Allow public update access on match_players" ON match_players;
DROP POLICY IF EXISTS "Allow public delete access on match_players" ON match_players;

DROP POLICY IF EXISTS "Allow public read access on statistics_snapshots" ON statistics_snapshots;
DROP POLICY IF EXISTS "Allow public insert access on statistics_snapshots" ON statistics_snapshots;
DROP POLICY IF EXISTS "Allow public update access on statistics_snapshots" ON statistics_snapshots;
DROP POLICY IF EXISTS "Allow public delete access on statistics_snapshots" ON statistics_snapshots;

-- Create new tenant-aware RLS policies
-- Note: These policies use a function to get the current tenant_id from the request context
-- For now, we'll use a simpler approach: the application layer filters by tenant_id
-- RLS policies will be enforced at the application level via query filters

-- Players policies (tenant-aware)
CREATE POLICY "Allow tenant read access on players" ON players
  FOR SELECT USING (true); -- Application layer filters by tenant_id

CREATE POLICY "Allow tenant insert access on players" ON players
  FOR INSERT WITH CHECK (true); -- Application layer sets tenant_id

CREATE POLICY "Allow tenant update access on players" ON players
  FOR UPDATE USING (true); -- Application layer filters by tenant_id

CREATE POLICY "Allow tenant delete access on players" ON players
  FOR DELETE USING (true); -- Application layer filters by tenant_id

-- Training sessions policies
CREATE POLICY "Allow tenant read access on training_sessions" ON training_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow tenant insert access on training_sessions" ON training_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow tenant update access on training_sessions" ON training_sessions
  FOR UPDATE USING (true);

CREATE POLICY "Allow tenant delete access on training_sessions" ON training_sessions
  FOR DELETE USING (true);

-- Courts policies
CREATE POLICY "Allow tenant read access on courts" ON courts
  FOR SELECT USING (true);

CREATE POLICY "Allow tenant insert access on courts" ON courts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow tenant update access on courts" ON courts
  FOR UPDATE USING (true);

CREATE POLICY "Allow tenant delete access on courts" ON courts
  FOR DELETE USING (true);

-- Check-ins policies
CREATE POLICY "Allow tenant read access on check_ins" ON check_ins
  FOR SELECT USING (true);

CREATE POLICY "Allow tenant insert access on check_ins" ON check_ins
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow tenant update access on check_ins" ON check_ins
  FOR UPDATE USING (true);

CREATE POLICY "Allow tenant delete access on check_ins" ON check_ins
  FOR DELETE USING (true);

-- Matches policies
CREATE POLICY "Allow tenant read access on matches" ON matches
  FOR SELECT USING (true);

CREATE POLICY "Allow tenant insert access on matches" ON matches
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow tenant update access on matches" ON matches
  FOR UPDATE USING (true);

CREATE POLICY "Allow tenant delete access on matches" ON matches
  FOR DELETE USING (true);

-- Match players policies
CREATE POLICY "Allow tenant read access on match_players" ON match_players
  FOR SELECT USING (true);

CREATE POLICY "Allow tenant insert access on match_players" ON match_players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow tenant update access on match_players" ON match_players
  FOR UPDATE USING (true);

CREATE POLICY "Allow tenant delete access on match_players" ON match_players
  FOR DELETE USING (true);

-- Statistics snapshots policies
CREATE POLICY "Allow tenant read access on statistics_snapshots" ON statistics_snapshots
  FOR SELECT USING (true);

CREATE POLICY "Allow tenant insert access on statistics_snapshots" ON statistics_snapshots
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow tenant update access on statistics_snapshots" ON statistics_snapshots
  FOR UPDATE USING (true);

CREATE POLICY "Allow tenant delete access on statistics_snapshots" ON statistics_snapshots
  FOR DELETE USING (true);

-- Note: Application-level filtering ensures tenant isolation
-- All queries must include WHERE tenant_id = ? clause
-- The API proxy (api/db.ts) automatically adds tenant_id to all queries

