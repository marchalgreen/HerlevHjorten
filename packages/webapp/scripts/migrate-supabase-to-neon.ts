#!/usr/bin/env tsx
/**
 * Migration script to export data from Supabase databases and import to Neon with tenant_id
 * 
 * This script:
 * 1. Exports data from multiple Supabase databases (one per tenant)
 * 2. Imports all data into a single Neon database with tenant_id column
 * 3. Ensures data isolation by tenant
 * 
 * Usage:
 * 1. Set up your Supabase credentials in .env.local:
 *    - VITE_SUPABASE_URL_DEFAULT (for default tenant)
 *    - VITE_SUPABASE_ANON_KEY_DEFAULT
 *    - VITE_SUPABASE_URL_RUNDEMANAGER (for rundemanager tenant)
 *    - VITE_SUPABASE_ANON_KEY_RUNDEMANAGER
 * 2. Set up Neon DATABASE_URL in .env.local
 * 3. Run: pnpm tsx scripts/migrate-supabase-to-neon.ts
 */

import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
function loadEnv() {
  const envPath = join(__dirname, '../.env.local')
  const env: Record<string, string> = {}
  
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const equalIndex = trimmed.indexOf('=')
        if (equalIndex > 0) {
          const key = trimmed.substring(0, equalIndex).trim()
          const value = trimmed.substring(equalIndex + 1).trim().replace(/^["']|["']$/g, '')
          if (key && value) {
            env[key] = value
          }
        }
      }
    }
  }
  
  // Also check process.env for DATABASE_URL (might be set externally)
  if (process.env.DATABASE_URL && !env.DATABASE_URL) {
    env.DATABASE_URL = process.env.DATABASE_URL
  }
  if (process.env.DATABASE_URL_UNPOOLED && !env.DATABASE_URL_UNPOOLED) {
    env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL_UNPOOLED
  }
  
  return env
}

const env = loadEnv()

// Debug: Show what we loaded (only in verbose mode)
if (process.argv.includes('--verbose')) {
  console.log('Loaded environment variables:', {
    hasDATABASE_URL: !!env.DATABASE_URL,
    hasVITE_DATABASE_URL: !!env.VITE_DATABASE_URL,
    hasVITE_SUPABASE_URL: !!env.VITE_SUPABASE_URL,
    hasVITE_SUPABASE_URL_RUNDEMANAGER: !!env.VITE_SUPABASE_URL_RUNDEMANAGER,
    keys: Object.keys(env).filter(k => k.includes('DATABASE') || k.includes('SUPABASE'))
  })
}

// Tenant configurations
// Support both VITE_SUPABASE_URL and SUPABASE_URL (without VITE_ prefix)
const tenants = [
  {
    id: 'default',
    supabaseUrl: env.VITE_SUPABASE_URL_DEFAULT || env.SUPABASE_URL_DEFAULT || env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    supabaseKey: env.VITE_SUPABASE_ANON_KEY_DEFAULT || env.SUPABASE_ANON_KEY_DEFAULT || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY,
  },
  {
    id: 'rundemanager',
    supabaseUrl: env.VITE_SUPABASE_URL_RUNDEMANAGER || env.SUPABASE_URL_RUNDEMANAGER,
    supabaseKey: env.VITE_SUPABASE_ANON_KEY_RUNDEMANAGER || env.SUPABASE_ANON_KEY_RUNDEMANAGER,
  }
].filter(t => t.supabaseUrl && t.supabaseKey)

// Support both DATABASE_URL and VITE_DATABASE_URL (Vite prefixes client vars with VITE_)
const neonUrl = env.DATABASE_URL || 
                env.VITE_DATABASE_URL || 
                env.DATABASE_URL_UNPOOLED || 
                env.VITE_DATABASE_URL_UNPOOLED

if (!neonUrl) {
  console.error('Error: DATABASE_URL or VITE_DATABASE_URL must be set in .env.local')
  console.error('Available keys:', Object.keys(env).filter(k => k.includes('DATABASE')))
  process.exit(1)
}

if (tenants.length === 0) {
  console.error('Error: No Supabase tenants configured')
  process.exit(1)
}

console.log(`Found ${tenants.length} tenant(s) to migrate\n`)

// Initialize Neon client
const sql = postgres(neonUrl, {
  ssl: 'require',
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10
})

async function migrateTenant(tenant: { id: string; supabaseUrl: string; supabaseKey: string }) {
  console.log(`\n📦 Migrating tenant: ${tenant.id}`)
  console.log(`   Supabase URL: ${tenant.supabaseUrl}`)
  
  const supabase = createClient(tenant.supabaseUrl, tenant.supabaseKey)
  
  // Export all data from Supabase
  const [playersResult, sessionsResult, checkInsResult, courtsResult, matchesResult, matchPlayersResult, statisticsResult] = await Promise.all([
    supabase.from('players').select('*'),
    supabase.from('training_sessions').select('*'),
    supabase.from('check_ins').select('*'),
    supabase.from('courts').select('*'),
    supabase.from('matches').select('*'),
    supabase.from('match_players').select('*'),
    supabase.from('statistics_snapshots').select('*')
  ])
  
  if (playersResult.error) throw new Error(`Failed to fetch players: ${playersResult.error.message}`)
  if (sessionsResult.error) throw new Error(`Failed to fetch sessions: ${sessionsResult.error.message}`)
  if (checkInsResult.error) throw new Error(`Failed to fetch check-ins: ${checkInsResult.error.message}`)
  if (courtsResult.error) throw new Error(`Failed to fetch courts: ${courtsResult.error.message}`)
  if (matchesResult.error) throw new Error(`Failed to fetch matches: ${matchesResult.error.message}`)
  if (matchPlayersResult.error) throw new Error(`Failed to fetch match players: ${matchPlayersResult.error.message}`)
  if (statisticsResult.error) throw new Error(`Failed to fetch statistics: ${statisticsResult.error.message}`)
  
  const players = playersResult.data || []
  const sessions = sessionsResult.data || []
  const checkIns = checkInsResult.data || []
  const courts = courtsResult.data || []
  const matches = matchesResult.data || []
  const matchPlayers = matchPlayersResult.data || []
  const statistics = statisticsResult.data || []
  
  console.log(`   Found: ${players.length} players, ${sessions.length} sessions, ${checkIns.length} check-ins, ${courts.length} courts, ${matches.length} matches, ${matchPlayers.length} match players, ${statistics.length} statistics`)
  
  // Import to Neon with tenant_id
  if (players.length > 0) {
    console.log(`   Importing ${players.length} players...`)
    for (const player of players) {
      await sql`
        INSERT INTO players (
          id, name, alias, level_single, level_double, level_mix, gender,
          primary_category, training_group, active,
          preferred_doubles_partners, preferred_mixed_partners, tenant_id, created_at
        )
        VALUES (
          ${player.id},
          ${player.name},
          ${player.alias || null},
          ${player.level_single || null},
          ${player.level_double || null},
          ${player.level_mix || null},
          ${player.gender || null},
          ${player.primary_category || null},
          ${player.training_group || []},
          ${player.active ?? true},
          ${player.preferred_doubles_partners || []},
          ${player.preferred_mixed_partners || []},
          ${tenant.id},
          ${player.created_at || new Date().toISOString()}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          alias = EXCLUDED.alias,
          level_single = EXCLUDED.level_single,
          level_double = EXCLUDED.level_double,
          level_mix = EXCLUDED.level_mix,
          gender = EXCLUDED.gender,
          primary_category = EXCLUDED.primary_category,
          training_group = EXCLUDED.training_group,
          active = EXCLUDED.active,
          preferred_doubles_partners = EXCLUDED.preferred_doubles_partners,
          preferred_mixed_partners = EXCLUDED.preferred_mixed_partners,
          tenant_id = EXCLUDED.tenant_id
      `
    }
  }
  
  if (sessions.length > 0) {
    console.log(`   Importing ${sessions.length} sessions...`)
    for (const session of sessions) {
      await sql`
        INSERT INTO training_sessions (id, date, status, tenant_id, created_at)
        VALUES (${session.id}, ${session.date}, ${session.status}, ${tenant.id}, ${session.created_at || new Date().toISOString()})
        ON CONFLICT (id) DO UPDATE SET
          date = EXCLUDED.date,
          status = EXCLUDED.status,
          tenant_id = EXCLUDED.tenant_id
      `
    }
  }
  
  if (courts.length > 0) {
    console.log(`   Importing ${courts.length} courts...`)
    for (const court of courts) {
      await sql`
        INSERT INTO courts (id, idx, tenant_id)
        VALUES (${court.id}, ${court.idx}, ${tenant.id})
        ON CONFLICT (idx, tenant_id) DO UPDATE SET idx = EXCLUDED.idx
      `
    }
  }
  
  if (checkIns.length > 0) {
    console.log(`   Importing ${checkIns.length} check-ins...`)
    for (const checkIn of checkIns) {
      await sql`
        INSERT INTO check_ins (id, session_id, player_id, max_rounds, tenant_id, created_at)
        VALUES (${checkIn.id}, ${checkIn.session_id}, ${checkIn.player_id}, ${checkIn.max_rounds || null}, ${tenant.id}, ${checkIn.created_at || new Date().toISOString()})
        ON CONFLICT (session_id, player_id, tenant_id) DO UPDATE SET
          max_rounds = EXCLUDED.max_rounds
      `
    }
  }
  
  if (matches.length > 0) {
    console.log(`   Importing ${matches.length} matches...`)
    for (const match of matches) {
      await sql`
        INSERT INTO matches (id, session_id, court_id, started_at, ended_at, round, tenant_id)
        VALUES (${match.id}, ${match.session_id}, ${match.court_id}, ${match.started_at}, ${match.ended_at || null}, ${match.round || null}, ${tenant.id})
        ON CONFLICT (id) DO UPDATE SET
          session_id = EXCLUDED.session_id,
          court_id = EXCLUDED.court_id,
          started_at = EXCLUDED.started_at,
          ended_at = EXCLUDED.ended_at,
          round = EXCLUDED.round,
          tenant_id = EXCLUDED.tenant_id
      `
    }
  }
  
  if (matchPlayers.length > 0) {
    console.log(`   Importing ${matchPlayers.length} match players...`)
    for (const mp of matchPlayers) {
      await sql`
        INSERT INTO match_players (id, match_id, player_id, slot, tenant_id)
        VALUES (${mp.id}, ${mp.match_id}, ${mp.player_id}, ${mp.slot}, ${tenant.id})
        ON CONFLICT (match_id, slot, tenant_id) DO UPDATE SET
          player_id = EXCLUDED.player_id
      `
    }
  }
  
  if (statistics.length > 0) {
    console.log(`   Importing ${statistics.length} statistics snapshots...`)
    for (const stat of statistics) {
      await sql`
        INSERT INTO statistics_snapshots (
          id, session_id, session_date, season, matches, match_players, check_ins, tenant_id, created_at
        )
        VALUES (
          ${stat.id},
          ${stat.session_id},
          ${stat.session_date},
          ${stat.season},
          ${JSON.stringify(stat.matches || [])},
          ${JSON.stringify(stat.match_players || [])},
          ${JSON.stringify(stat.check_ins || [])},
          ${tenant.id},
          ${stat.created_at || new Date().toISOString()}
        )
        ON CONFLICT (session_id, tenant_id) DO UPDATE SET
          session_date = EXCLUDED.session_date,
          season = EXCLUDED.season,
          matches = EXCLUDED.matches,
          match_players = EXCLUDED.match_players,
          check_ins = EXCLUDED.check_ins
      `
    }
  }
  
  console.log(`   ✅ Tenant ${tenant.id} migrated successfully`)
}

async function main() {
  console.log('🚀 Starting migration from Supabase to Neon...\n')
  
  try {
    // Test Neon connection
    await sql`SELECT 1`
    console.log('✅ Connected to Neon database\n')
    
    // Migrate each tenant
    for (const tenant of tenants) {
      await migrateTenant(tenant)
    }
    
    console.log('\n✅ Migration completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Apply the tenant isolation migration: supabase/migrations/001_add_tenant_isolation.sql')
    console.log('2. Update all queries in packages/webapp/src/api/postgres.ts to include tenant_id')
    console.log('3. Test the application to ensure tenant isolation works correctly')
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()

