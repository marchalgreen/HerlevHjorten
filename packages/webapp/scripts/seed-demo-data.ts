#!/usr/bin/env tsx
/**
 * Demo data seeding script for demo tenant.
 * 
 * This script seeds the demo Supabase database with dummy data for sales demonstrations.
 * Run this script after setting up the demo tenant configuration.
 * 
 * Usage:
 *   pnpm tsx packages/webapp/scripts/seed-demo-data.ts
 */

import { createClient } from '@supabase/supabase-js'
import { loadTenantConfig } from '../src/lib/tenant'

/**
 * Generates a random date within the last 30 days.
 */
const randomDate = (): string => {
  const now = Date.now()
  const daysAgo = Math.floor(Math.random() * 30)
  return new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Generates a random date in the future (next 7 days).
 */
const randomFutureDate = (): string => {
  const now = Date.now()
  const daysAhead = Math.floor(Math.random() * 7) + 1
  return new Date(now + daysAhead * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Demo player names for seeding.
 */
const DEMO_PLAYER_NAMES = [
  'Anna Andersen', 'Bo Bertelsen', 'Clara Christensen', 'David Dahl', 'Emma Eriksen',
  'Frederik Frederiksen', 'Gitte Gade', 'Henrik Hansen', 'Ida Iversen', 'Jens Jensen',
  'Karen Knudsen', 'Lars Larsen', 'Maria Madsen', 'Niels Nielsen', 'Ole Olsen',
  'Pia Pedersen', 'Rasmus Rasmussen', 'Sofie Sørensen', 'Thomas Thomsen', 'Ulla Ulriksen',
  'Viktor Vestergaard', 'Winnie Winther', 'Xenia Xylophone', 'Yvonne Yde', 'Zacharias Zander'
]

/**
 * Demo player levels (1-10).
 */
const DEMO_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/**
 * Demo genders.
 */
const DEMO_GENDERS = ['Herre', 'Dame'] as const

/**
 * Demo categories.
 */
const DEMO_CATEGORIES = ['Single', 'Double', 'Begge'] as const

/**
 * Main seeding function.
 */
async function seedDemoData() {
  console.log('🌱 Starting demo data seeding...')

  try {
    // Load demo tenant config
    const config = await loadTenantConfig('demo')
    
    if (!config.supabaseUrl || !config.supabaseKey) {
      console.error('❌ Demo tenant config is missing Supabase credentials.')
      console.error('Please update packages/webapp/src/config/tenants/demo.json with your Supabase credentials.')
      process.exit(1)
    }

    const supabase = createClient(config.supabaseUrl, config.supabaseKey)

    // Test connection
    console.log('🔌 Testing Supabase connection...')
    const { error: testError } = await supabase.from('players').select('id').limit(1)
    if (testError) {
      console.error('❌ Failed to connect to Supabase:', testError.message)
      process.exit(1)
    }
    console.log('✅ Connected to Supabase')

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing data...')
    await supabase.from('match_players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('check_ins').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('training_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('courts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('✅ Cleared existing data')

    // Seed courts (based on tenant maxCourts)
    console.log(`🏸 Seeding ${config.maxCourts} courts...`)
    const courtData = Array.from({ length: config.maxCourts }, (_, i) => ({
      idx: i + 1
    }))
    const { error: courtsError } = await supabase.from('courts').insert(courtData)
    if (courtsError) {
      console.error('❌ Failed to seed courts:', courtsError.message)
      process.exit(1)
    }
    console.log(`✅ Seeded ${config.maxCourts} courts`)

    // Seed players
    console.log(`👥 Seeding ${DEMO_PLAYER_NAMES.length} players...`)
    const playerData = DEMO_PLAYER_NAMES.map((name, index) => ({
      name,
      alias: index % 3 === 0 ? name.split(' ')[0] : null,
      level: DEMO_LEVELS[Math.floor(Math.random() * DEMO_LEVELS.length)],
      gender: DEMO_GENDERS[Math.floor(Math.random() * DEMO_GENDERS.length)],
      primary_category: DEMO_CATEGORIES[Math.floor(Math.random() * DEMO_CATEGORIES.length)],
      active: Math.random() > 0.1 // 90% active
    }))
    const { data: players, error: playersError } = await supabase
      .from('players')
      .insert(playerData)
      .select()
    
    if (playersError) {
      console.error('❌ Failed to seed players:', playersError.message)
      process.exit(1)
    }
    console.log(`✅ Seeded ${players?.length || 0} players`)

    // Seed training sessions (last 10 days)
    console.log('📅 Seeding training sessions...')
    const sessionData = Array.from({ length: 10 }, (_, i) => ({
      date: randomDate(),
      status: i === 0 ? 'active' : 'ended' as const
    }))
    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .insert(sessionData)
      .select()
    
    if (sessionsError) {
      console.error('❌ Failed to seed sessions:', sessionsError.message)
      process.exit(1)
    }
    console.log(`✅ Seeded ${sessions?.length || 0} training sessions`)

    // Seed check-ins for active session
    if (sessions && sessions.length > 0) {
      const activeSession = sessions.find(s => s.status === 'active') || sessions[0]
      console.log(`✅ Seeding check-ins for active session...`)
      const checkInData = players?.slice(0, 15).map((player) => ({
        session_id: activeSession.id,
        player_id: player.id,
        max_rounds: Math.random() > 0.7 ? 1 : null // 30% want only 1 round
      })) || []
      
      const { error: checkInsError } = await supabase
        .from('check_ins')
        .insert(checkInData)
      
      if (checkInsError) {
        console.error('❌ Failed to seed check-ins:', checkInsError.message)
        process.exit(1)
      }
      console.log(`✅ Seeded ${checkInData.length} check-ins`)
    }

    console.log('')
    console.log('🎉 Demo data seeding completed successfully!')
    console.log('')
    console.log('📊 Summary:')
    console.log(`   - Courts: ${config.maxCourts}`)
    console.log(`   - Players: ${players?.length || 0}`)
    console.log(`   - Training Sessions: ${sessions?.length || 0}`)
    console.log(`   - Check-ins: ${sessions && sessions.length > 0 ? (players?.slice(0, 15).length || 0) : 0}`)
    console.log('')
    console.log('💡 You can now access the demo tenant at: /#/demo/check-in')
    
  } catch (error) {
    console.error('❌ Error seeding demo data:', error)
    process.exit(1)
  }
}

// Run the seeding
seedDemoData()


