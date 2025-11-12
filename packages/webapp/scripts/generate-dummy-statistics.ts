#!/usr/bin/env tsx
/// <reference types="node" />
/**
 * Generate dummy statistics data script.
 * 
 * This script generates realistic historical statistics data (sessions, matches, check-ins)
 * for a specified tenant. This is useful for demo purposes.
 * 
 * Usage:
 *   pnpm exec tsx packages/webapp/scripts/generate-dummy-statistics.ts [tenant-id]
 * 
 * Examples:
 *   pnpm exec tsx packages/webapp/scripts/generate-dummy-statistics.ts rundemanager
 *   pnpm exec tsx packages/webapp/scripts/generate-dummy-statistics.ts demo
 * 
 * WARNING: This will add historical data to the database. It does NOT clear existing data.
 */

import { createClient } from '@supabase/supabase-js'
import { loadTenantConfig } from '../src/lib/tenant'
import { setCurrentTenantSupabaseClient, setCurrentTenantConfig, createTenantSupabaseClient } from '../src/lib/supabase'
import { getStateCopy } from '../src/lib/supabase'
import { createId } from '../src/lib/supabase'
import type { Match, MatchPlayer, CheckIn } from '@herlev-hjorten/common'

/**
 * Determines season from a date string (August to July).
 */
const getSeasonFromDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1 // 1-12 (Jan=1, Dec=12)
  const year = date.getFullYear()
  
  if (month >= 8) {
    return `${year}-${year + 1}`
  } else {
    return `${year - 1}-${year}`
  }
}

/**
 * Generates dummy historical data for demo purposes.
 */
async function generateDummyHistoricalData() {
  const state = await getStateCopy()

  const players = state.players.filter((p) => p.active)
  if (players.length < 8) {
    throw new Error('Mindst 8 aktive spillere kræves for at generere dummy data')
  }

  const courts = state.courts
  const now = new Date()

  // Generate sessions for the past 1.5 seasons (about 18 months)
  const sessions: Array<{ date: string; season: string }> = []
  const monthsToGenerate = 18

  for (let i = monthsToGenerate; i >= 0; i--) {
    const sessionDate = new Date(now)
    sessionDate.setMonth(sessionDate.getMonth() - i)
    
    // Generate 8 sessions per month
    const sessionsThisMonth = 8
    
    for (let j = 0; j < sessionsThisMonth; j++) {
      const dayOfMonth = Math.floor(Math.random() * 28) + 1 // 1-28 to avoid month boundary issues
      const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), dayOfMonth)
      const hour = 18 + Math.floor(Math.random() * 3) // 18-20 (6-8 PM)
      const minute = Math.floor(Math.random() * 4) * 15 // 0, 15, 30, 45
      sessionDay.setHours(hour, minute, 0, 0)
      
      const season = getSeasonFromDate(sessionDay.toISOString())
      sessions.push({
        date: sessionDay.toISOString(),
        season
      })
    }
  }

  // Sort sessions by date
  sessions.sort((a, b) => a.date.localeCompare(b.date))

  console.log(`📅 Generating ${sessions.length} sessions...`)

  // Import Supabase functions
  const { createSession, createCheckIn, createStatisticsSnapshot } = await import('../src/lib/supabase')

  // Process each session and create in Supabase
  let sessionCount = 0
  for (const sessionInfo of sessions) {
    sessionCount++
    if (sessionCount % 10 === 0) {
      console.log(`   Progress: ${sessionCount}/${sessions.length} sessions...`)
    }

    const sessionDate = new Date(sessionInfo.date)
      
    // Create ended session in Supabase
    const session = await createSession({
      date: sessionInfo.date,
      status: 'ended'
    })
    const sessionId = session.id

    // Randomly select ~26 players to check in on average
    const checkInCount = Math.min(
      Math.floor(Math.random() * 10) + 22, // 22-32 players, average ~26
      players.length
    )
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5)
    const checkedInPlayers = shuffledPlayers.slice(0, checkInCount)

    // Create check-ins in Supabase
    const checkIns: CheckIn[] = []
    for (const player of checkedInPlayers) {
      const checkIn = await createCheckIn({
        sessionId,
        playerId: player.id,
        maxRounds: null
      })
      checkIns.push(checkIn)
    }

    // Generate 2 rounds on average (1-3 rounds per session)
    const roundsPerSession = Math.floor(Math.random() * 3) + 1 // 1-3 rounds, average ~2
    const allMatches: Match[] = []
    const allMatchPlayers: MatchPlayer[] = []
    
    // Track how many matches each player has been assigned to in this session
    const playerMatchCount = new Map<string, number>()
    checkedInPlayers.forEach((p) => playerMatchCount.set(p.id, 0))
    
    // Target: ~1.7 matches per player per session
    const targetPlayerSlots = Math.round(checkedInPlayers.length * 1.7)
    const avgPlayersPerMatch = 3 // Mix of 1v1 and 2v2 averages to ~3
    const neededMatches = Math.ceil(targetPlayerSlots / avgPlayersPerMatch)
    const courtsPerRound = Math.ceil(neededMatches / roundsPerSession)

    for (let roundNum = 1; roundNum <= roundsPerSession; roundNum++) {
      const courtCount = Math.min(
        Math.max(courtsPerRound, Math.floor(Math.random() * 3) + 5), // At least courtsPerRound, but 5-7 if possible
        courts.length,
        Math.floor(checkedInPlayers.length / 2)
      )
      const usedCourts = courts.slice(0, courtCount)
      const matches: Match[] = []
      const matchPlayers: MatchPlayer[] = []
      
      // Sort players by match count (fewer matches first) to ensure fair distribution
      const sortedPlayers = [...checkedInPlayers].sort((a, b) => {
        const countA = playerMatchCount.get(a.id) ?? 0
        const countB = playerMatchCount.get(b.id) ?? 0
        return countA - countB
      })

      usedCourts.forEach((court, courtIndex) => {
        const matchId = createId()
        const matchStart = new Date(sessionDate)
        matchStart.setMinutes(matchStart.getMinutes() + (roundNum - 1) * 45 + courtIndex * 5)
        
        matches.push({
          id: matchId,
          sessionId,
          courtId: court.id,
          startedAt: matchStart.toISOString(),
          endedAt: new Date(matchStart.getTime() + 45 * 60000).toISOString(),
          round: roundNum
        })

        // Re-sort players before each court
        sortedPlayers.sort((a, b) => {
          const countA = playerMatchCount.get(a.id) ?? 0
          const countB = playerMatchCount.get(b.id) ?? 0
          return countA - countB
        })

        if (sortedPlayers.length < 2) return

        const currentAvgMatches = Array.from(playerMatchCount.values()).reduce((a, b) => a + b, 0) / checkedInPlayers.length
        const needsMoreMatches = currentAvgMatches < 1.7
        const isDoubles = sortedPlayers.length >= 4 && (needsMoreMatches || Math.random() > 0.3)
        
        if (isDoubles && sortedPlayers.length >= 4) {
          // 2v2 match
          const selectedPlayers = sortedPlayers.slice(0, 4)
          
          selectedPlayers.forEach((player, index) => {
            playerMatchCount.set(player.id, (playerMatchCount.get(player.id) ?? 0) + 1)
            matchPlayers.push({
              id: createId(),
              matchId,
              playerId: player.id,
              slot: index
            })
          })
        } else {
          // 1v1 match
          const selectedPlayers = sortedPlayers.slice(0, 2)
          
          selectedPlayers.forEach((player) => {
            playerMatchCount.set(player.id, (playerMatchCount.get(player.id) ?? 0) + 1)
          })
          matchPlayers.push({
            id: createId(),
            matchId,
            playerId: selectedPlayers[0].id,
            slot: 1
          })
          matchPlayers.push({
            id: createId(),
            matchId,
            playerId: selectedPlayers[1].id,
            slot: 2
          })
        }
      })

      allMatches.push(...matches)
      allMatchPlayers.push(...matchPlayers)
    }

    // Create snapshot in Supabase
    await createStatisticsSnapshot({
      sessionId,
      sessionDate: sessionInfo.date,
      season: sessionInfo.season,
      matches: allMatches.map((m) => ({ ...m })),
      matchPlayers: allMatchPlayers.map((mp) => ({ ...mp })),
      checkIns: checkIns.map((c) => ({ ...c }))
    })
  }

  console.log('')
  console.log('🎉 Dummy statistics data generation completed!')
  console.log('')
  console.log('📊 Summary:')
  console.log(`   - Sessions created: ${sessions.length}`)
  console.log(`   - Active players used: ${players.length}`)
  console.log('')
}

/**
 * Main function to generate dummy statistics for a tenant.
 */
async function generateDummyStatistics() {
  const tenantId = process.argv[2] || 'rundemanager'
  
  if (tenantId === 'default') {
    console.error('❌ Error: Cannot generate dummy data for "default" tenant (HerlevHjorten)')
    console.error('   This script is intended for demo tenants only.')
    console.error('   Use: pnpm exec tsx packages/webapp/scripts/generate-dummy-statistics.ts rundemanager')
    process.exit(1)
  }
  
  console.log(`📊 Starting dummy statistics generation for tenant: ${tenantId}...`)

  try {
    // Load tenant config
    const config = await loadTenantConfig(tenantId)
    
    if (!config.supabaseUrl || !config.supabaseKey) {
      console.error('❌ Tenant config is missing Supabase credentials.')
      console.error(`Please update packages/webapp/src/config/tenants/${tenantId}.json with your Supabase credentials.`)
      process.exit(1)
    }

    // Create Supabase client and set it as the current tenant client
    const supabase = createTenantSupabaseClient(config)
    setCurrentTenantSupabaseClient(supabase)
    setCurrentTenantConfig(config)

    // Test connection
    console.log('🔌 Testing Supabase connection...')
    const { error: testError } = await supabase.from('players').select('id').limit(1)
    if (testError) {
      console.error('❌ Failed to connect to Supabase:', testError.message)
      process.exit(1)
    }
    console.log('✅ Connected to Supabase')

    // Check active players
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('id')
      .eq('active', true)
    
    if (playersError) {
      console.error('❌ Failed to fetch players:', playersError.message)
      process.exit(1)
    }

    const activePlayerCount = playersData?.length || 0
    console.log(`👥 Found ${activePlayerCount} active players`)

    if (activePlayerCount < 8) {
      console.error('❌ Error: At least 8 active players are required to generate dummy data')
      console.error(`   Current active players: ${activePlayerCount}`)
      process.exit(1)
    }

    // Generate dummy data
    await generateDummyHistoricalData()
    
  } catch (error) {
    console.error('❌ Error generating dummy statistics:', error)
    process.exit(1)
  }
}

// Run the generation
generateDummyStatistics()

