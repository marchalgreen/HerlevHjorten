/**
 * Migration script to export data from localStorage and import to Supabase.
 * 
 * Usage:
 * 1. Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set in .env.local
 * 2. Run: pnpm tsx scripts/migrate-to-supabase.ts
 * 
 * This script will:
 * - Read all data from localStorage
 * - Import players, sessions, check-ins, courts, matches, match_players, and statistics_snapshots to Supabase
 * - Preserve all IDs and relationships
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local
// Note: In a real migration, you might want to use dotenv package
// For now, we'll read the file directly
const envPath = join(__dirname, '../.env.local')
let supabaseUrl: string | undefined
let supabaseAnonKey: string | undefined

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  const lines = envContent.split('\n')
  for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1]?.trim()
    } else if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      supabaseAnonKey = line.split('=')[1]?.trim()
    }
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Read from localStorage (in Node.js, we'll read from a JSON file)
// In the browser, you would use localStorage.getItem('herlev-hjorten-db')

interface DatabaseState {
  players: any[]
  sessions: any[]
  checkIns: any[]
  courts: any[]
  matches: any[]
  matchPlayers: any[]
  statistics?: any[]
}

async function migrateData() {
  console.log('Starting migration from localStorage to Supabase...\n')

  // In a real migration, you would:
  // 1. Export localStorage data to a JSON file from the browser console:
  //    localStorage.getItem('herlev-hjorten-db')
  // 2. Save it to a file like 'localStorage-export.json'
  // 3. Read it here

  const exportFilePath = join(__dirname, '../localStorage-export.json')
  
  if (!existsSync(exportFilePath)) {
    console.error(`Error: Export file not found at ${exportFilePath}`)
    console.log('\nTo export data from localStorage:')
    console.log('1. Open your browser console on the app')
    console.log('2. Run: JSON.stringify(JSON.parse(localStorage.getItem("herlev-hjorten-db")))')
    console.log('3. Copy the output and save it to packages/webapp/localStorage-export.json')
    process.exit(1)
  }

  const exportData: DatabaseState = JSON.parse(readFileSync(exportFilePath, 'utf-8'))

  console.log(`Found ${exportData.players?.length || 0} players`)
  console.log(`Found ${exportData.sessions?.length || 0} sessions`)
  console.log(`Found ${exportData.checkIns?.length || 0} check-ins`)
  console.log(`Found ${exportData.courts?.length || 0} courts`)
  console.log(`Found ${exportData.matches?.length || 0} matches`)
  console.log(`Found ${exportData.matchPlayers?.length || 0} match players`)
  console.log(`Found ${exportData.statistics?.length || 0} statistics snapshots\n`)

  // Migrate players
  if (exportData.players && exportData.players.length > 0) {
    console.log('Migrating players...')
    const playersToInsert = exportData.players.map((p) => ({
      id: p.id,
      name: p.name,
      alias: p.alias || null,
      level: p.level || null,
      gender: p.gender || null,
      primary_category: p.primaryCategory || null,
      active: p.active ?? true,
      created_at: p.createdAt || new Date().toISOString()
    }))

    const { error: playersError } = await supabase.from('players').upsert(playersToInsert, { onConflict: 'id' })
    if (playersError) {
      console.error('Error migrating players:', playersError)
    } else {
      console.log(`✓ Migrated ${playersToInsert.length} players`)
    }
  }

  // Migrate courts
  if (exportData.courts && exportData.courts.length > 0) {
    console.log('Migrating courts...')
    const courtsToInsert = exportData.courts.map((c) => ({
      id: c.id,
      idx: c.idx
    }))

    // Use insert with ignoreDuplicates to handle existing courts
    const { error: courtsError } = await supabase.from('courts').upsert(courtsToInsert, { onConflict: 'idx', ignoreDuplicates: true })
    if (courtsError) {
      console.error('Error migrating courts:', courtsError)
    } else {
      console.log(`✓ Migrated ${courtsToInsert.length} courts`)
    }
  }

  // Migrate sessions
  if (exportData.sessions && exportData.sessions.length > 0) {
    console.log('Migrating sessions...')
    const sessionsToInsert = exportData.sessions.map((s) => ({
      id: s.id,
      date: s.date,
      status: s.status,
      created_at: s.createdAt || s.date
    }))

    const { error: sessionsError } = await supabase.from('training_sessions').upsert(sessionsToInsert, { onConflict: 'id' })
    if (sessionsError) {
      console.error('Error migrating sessions:', sessionsError)
    } else {
      console.log(`✓ Migrated ${sessionsToInsert.length} sessions`)
    }
  }

  // Migrate check-ins
  if (exportData.checkIns && exportData.checkIns.length > 0) {
    console.log('Migrating check-ins...')
    const checkInsToInsert = exportData.checkIns.map((c) => ({
      id: c.id,
      session_id: c.sessionId,
      player_id: c.playerId,
      max_rounds: c.maxRounds || null,
      created_at: c.createdAt || new Date().toISOString()
    }))

    const { error: checkInsError } = await supabase.from('check_ins').upsert(checkInsToInsert, { onConflict: 'id' })
    if (checkInsError) {
      console.error('Error migrating check-ins:', checkInsError)
    } else {
      console.log(`✓ Migrated ${checkInsToInsert.length} check-ins`)
    }
  }

  // Migrate matches
  if (exportData.matches && exportData.matches.length > 0) {
    console.log('Migrating matches...')
    
    // Get valid court and session IDs from the database
    const { data: validCourts } = await supabase.from('courts').select('id')
    const { data: validSessions } = await supabase.from('training_sessions').select('id')
    const validCourtIds = new Set(validCourts?.map(c => c.id) || [])
    const validSessionIds = new Set(validSessions?.map(s => s.id) || [])
    
    const matchesToInsert = exportData.matches
      .filter((m) => validCourtIds.has(m.courtId) && validSessionIds.has(m.sessionId))
      .map((m) => ({
        id: m.id,
        session_id: m.sessionId,
        court_id: m.courtId,
        started_at: m.startedAt,
        ended_at: m.endedAt || null,
        round: m.round || null
      }))

    if (matchesToInsert.length > 0) {
      const { error: matchesError } = await supabase.from('matches').upsert(matchesToInsert, { onConflict: 'id' })
      if (matchesError) {
        console.error('Error migrating matches:', matchesError)
      } else {
        console.log(`✓ Migrated ${matchesToInsert.length} matches (skipped ${exportData.matches.length - matchesToInsert.length} with invalid foreign keys)`)
      }
    } else {
      console.log(`⚠ Skipped ${exportData.matches.length} matches (no valid foreign keys)`)
    }
  }

  // Migrate match players
  if (exportData.matchPlayers && exportData.matchPlayers.length > 0) {
    console.log('Migrating match players...')
    
    // Get valid match and player IDs from the database
    const { data: validMatches } = await supabase.from('matches').select('id')
    const { data: validPlayers } = await supabase.from('players').select('id')
    const validMatchIds = new Set(validMatches?.map(m => m.id) || [])
    const validPlayerIds = new Set(validPlayers?.map(p => p.id) || [])
    
    const matchPlayersToInsert = exportData.matchPlayers
      .filter((mp) => validMatchIds.has(mp.matchId) && validPlayerIds.has(mp.playerId))
      .map((mp) => ({
        id: mp.id,
        match_id: mp.matchId,
        player_id: mp.playerId,
        slot: mp.slot
      }))

    if (matchPlayersToInsert.length > 0) {
      const { error: matchPlayersError } = await supabase.from('match_players').upsert(matchPlayersToInsert, { onConflict: 'id' })
      if (matchPlayersError) {
        console.error('Error migrating match players:', matchPlayersError)
      } else {
        console.log(`✓ Migrated ${matchPlayersToInsert.length} match players (skipped ${exportData.matchPlayers.length - matchPlayersToInsert.length} with invalid foreign keys)`)
      }
    } else {
      console.log(`⚠ Skipped ${exportData.matchPlayers.length} match players (no valid foreign keys)`)
    }
  }

  // Migrate statistics snapshots
  if (exportData.statistics && exportData.statistics.length > 0) {
    console.log('Migrating statistics snapshots...')
    const snapshotsToInsert = exportData.statistics.map((s) => ({
      id: s.id,
      session_id: s.sessionId,
      session_date: s.sessionDate,
      season: s.season,
      matches: s.matches,
      match_players: s.matchPlayers,
      check_ins: s.checkIns,
      created_at: s.createdAt || new Date().toISOString()
    }))

    const { error: snapshotsError } = await supabase.from('statistics_snapshots').upsert(snapshotsToInsert, { onConflict: 'id' })
    if (snapshotsError) {
      console.error('Error migrating statistics snapshots:', snapshotsError)
    } else {
      console.log(`✓ Migrated ${snapshotsToInsert.length} statistics snapshots`)
    }
  }

  console.log('\n✓ Migration complete!')
}

migrateData().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})

