-- Migration: Rename default tenant to herlev-hjorten
-- Updates all tenant_id references from 'default' to 'herlev-hjorten'
-- Run this AFTER 008_update_clubs_for_multi_tenant.sql

-- Update clubs table
UPDATE clubs SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default';

-- Update all data tables
UPDATE players SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default';
UPDATE training_sessions SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default';
UPDATE check_ins SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default';
UPDATE matches SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default';
UPDATE match_players SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default';
UPDATE statistics_snapshots SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default';
UPDATE courts SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default';

-- Verify migration (optional - can be run manually to check)
-- SELECT COUNT(*) FROM clubs WHERE tenant_id = 'default';
-- Should return 0 if migration successful

