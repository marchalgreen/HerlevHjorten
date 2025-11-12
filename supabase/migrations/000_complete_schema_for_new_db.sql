-- Complete schema for Herlev Hjorten / RundeManager app
-- This migration creates all tables, indexes, and RLS policies
-- Use this for setting up a NEW database (like RundeManagerDemoDB)
-- 
-- To apply this to your Supabase project:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to SQL Editor
-- 3. Paste this entire file and run it

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  alias TEXT,
  level_single INTEGER,
  level_double INTEGER,
  level_mix INTEGER,
  gender TEXT CHECK (gender IN ('Herre', 'Dame')),
  primary_category TEXT CHECK (primary_category IN ('Single', 'Double', 'Begge')),
  active BOOLEAN NOT NULL DEFAULT true,
  preferred_doubles_partners UUID[] DEFAULT '{}',
  preferred_mixed_partners UUID[] DEFAULT '{}',
  training_group TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Training sessions table
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Courts table
-- Note: Court limit is now enforced at application level via tenant config
CREATE TABLE courts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idx INTEGER NOT NULL UNIQUE CHECK (idx >= 1)
);

-- Check-ins table
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  max_rounds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);

-- Matches table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  round INTEGER CHECK (round >= 1 AND round <= 4)
);

-- Match players table (junction table for players in matches)
CREATE TABLE match_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK (slot >= 0 AND slot <= 7),
  UNIQUE(match_id, slot)
);

-- Statistics snapshots table (stores historical session data as JSONB)
CREATE TABLE statistics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  session_date TIMESTAMPTZ NOT NULL,
  season TEXT NOT NULL,
  matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  match_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  check_ins JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id)
);

-- Create indexes for common queries
CREATE INDEX idx_players_active ON players(active);
CREATE INDEX idx_players_name ON players(name);
CREATE INDEX idx_players_preferred_doubles_partners ON players USING GIN(preferred_doubles_partners);
CREATE INDEX idx_players_preferred_mixed_partners ON players USING GIN(preferred_mixed_partners);
CREATE INDEX idx_training_sessions_status ON training_sessions(status);
CREATE INDEX idx_training_sessions_date ON training_sessions(date);
CREATE INDEX idx_check_ins_session_id ON check_ins(session_id);
CREATE INDEX idx_check_ins_player_id ON check_ins(player_id);
CREATE INDEX idx_matches_session_id ON matches(session_id);
CREATE INDEX idx_matches_court_id ON matches(court_id);
CREATE INDEX idx_match_players_match_id ON match_players(match_id);
CREATE INDEX idx_match_players_player_id ON match_players(player_id);
CREATE INDEX idx_statistics_snapshots_session_id ON statistics_snapshots(session_id);
CREATE INDEX idx_statistics_snapshots_season ON statistics_snapshots(season);
CREATE INDEX idx_statistics_snapshots_session_date ON statistics_snapshots(session_date);

-- Enable Row Level Security (RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE statistics_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read/write access (no auth yet)
-- These policies allow anyone to read and write data
-- In the future, you can add authentication and restrict these policies

-- Players policies
CREATE POLICY "Allow public read access on players" ON players
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on players" ON players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on players" ON players
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on players" ON players
  FOR DELETE USING (true);

-- Training sessions policies
CREATE POLICY "Allow public read access on training_sessions" ON training_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on training_sessions" ON training_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on training_sessions" ON training_sessions
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on training_sessions" ON training_sessions
  FOR DELETE USING (true);

-- Courts policies
CREATE POLICY "Allow public read access on courts" ON courts
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on courts" ON courts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on courts" ON courts
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on courts" ON courts
  FOR DELETE USING (true);

-- Check-ins policies
CREATE POLICY "Allow public read access on check_ins" ON check_ins
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on check_ins" ON check_ins
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on check_ins" ON check_ins
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on check_ins" ON check_ins
  FOR DELETE USING (true);

-- Matches policies
CREATE POLICY "Allow public read access on matches" ON matches
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on matches" ON matches
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on matches" ON matches
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on matches" ON matches
  FOR DELETE USING (true);

-- Match players policies
CREATE POLICY "Allow public read access on match_players" ON match_players
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on match_players" ON match_players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on match_players" ON match_players
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on match_players" ON match_players
  FOR DELETE USING (true);

-- Statistics snapshots policies
CREATE POLICY "Allow public read access on statistics_snapshots" ON statistics_snapshots
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on statistics_snapshots" ON statistics_snapshots
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on statistics_snapshots" ON statistics_snapshots
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on statistics_snapshots" ON statistics_snapshots
  FOR DELETE USING (true);

-- Note: Courts are seeded via application scripts based on tenant's maxCourts configuration
-- Run the setup-supabase.ts script or seed courts manually based on your tenant's needs

