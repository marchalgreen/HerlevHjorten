#!/usr/bin/env tsx
/**
 * Demo data seeding script for any tenant.
 * 
 * This script seeds a Neon database with dummy data for sales demonstrations.
 * Run this script after setting up the tenant configuration.
 * 
 * Usage:
 *   cd packages/webapp && pnpm exec tsx scripts/seed-demo-data.ts [tenant-id]
 * 
 * If tenant-id is not provided, it will use "demo"
 */

import postgres from 'postgres'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadTenantConfig } from '../src/lib/tenant'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local
const possiblePaths = [
  join(__dirname, '../.env.local'),  // packages/webapp/.env.local
  join(__dirname, '../../.env.local'), // root/.env.local
  join(process.cwd(), '.env.local')  // current working directory
]

let envLoaded = false
for (const envPath of possiblePaths) {
  if (existsSync(envPath)) {
    console.log(`📄 Loading environment from: ${envPath}`)
    const envContent = readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '') // Remove quotes
          process.env[key.trim()] = value
        }
      }
    }
    envLoaded = true
    break
  }
}

if (!envLoaded) {
  console.warn('⚠️  No .env.local file found. Looking in:', possiblePaths)
  console.warn('⚠️  Make sure DATABASE_URL is set in environment or .env.local')
}

// Fallback: Use VITE_DATABASE_URL if DATABASE_URL is not set (for compatibility)
if (!process.env.DATABASE_URL && process.env.VITE_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.VITE_DATABASE_URL
  console.log('📝 Using VITE_DATABASE_URL as DATABASE_URL')
}

/**
 * Realistic Danish player names for seeding.
 * Total: 88 players distributed across 3 training groups (40, 22, 26).
 */
const DEMO_PLAYER_NAMES = [
  // Senior A players (40 players - older, more experienced)
  'Lars Andersen', 'Mette Hansen', 'Thomas Nielsen', 'Anne Pedersen', 'Michael Jensen',
  'Camilla Larsen', 'Anders Christensen', 'Louise Madsen', 'Martin Thomsen', 'Sara Rasmussen',
  'Peter Sørensen', 'Maria Eriksen', 'Jens Knudsen', 'Helle Dahl', 'Steen Bertelsen',
  'Lise Gade', 'Henrik Frederiksen', 'Nina Iversen', 'Kim Ulriksen', 'Mia Vestergaard',
  'Bo Andersen', 'Gitte Hansen', 'Claus Nielsen', 'Dorthe Pedersen', 'Jan Jensen',
  'Lene Larsen', 'Morten Christensen', 'Pia Madsen', 'Rasmus Thomsen', 'Signe Rasmussen',
  'Søren Sørensen', 'Tina Eriksen', 'Ulrik Knudsen', 'Vibeke Dahl', 'Willy Bertelsen',
  'Yvonne Gade', 'Zacharias Frederiksen', 'Ane Iversen', 'Bent Ulriksen', 'Cecilie Vestergaard',
  
  // U17 players (22 players - teenagers)
  'Emil Andersen', 'Emma Hansen', 'Noah Nielsen', 'Sofia Pedersen', 'Lucas Jensen',
  'Ida Larsen', 'Oliver Christensen', 'Freja Madsen', 'Viktor Thomsen', 'Alberte Rasmussen',
  'William Sørensen', 'Clara Eriksen', 'Malthe Knudsen', 'Nora Dahl', 'Magnus Bertelsen',
  'Luna Gade', 'Elias Frederiksen', 'Sofia Iversen', 'Aksel Ulriksen', 'Ellie Vestergaard',
  'Isabella Andersen', 'Jonas Hansen',
  
  // U15 players (26 players - younger)
  'Liam Andersen', 'Alma Hansen', 'Felix Nielsen', 'Lily Pedersen', 'Hugo Jensen',
  'Maja Larsen', 'Arthur Christensen', 'Ella Madsen', 'Alfred Thomsen', 'Olivia Rasmussen',
  'Karl Sørensen', 'Agnes Eriksen', 'Asta Knudsen', 'Viggo Dahl', 'Alma Bertelsen',
  'Storm Gade', 'Lauge Frederiksen', 'Frida Iversen', 'Storm Ulriksen', 'Liv Vestergaard',
  'Theo Andersen', 'Vera Hansen', 'Wilhelm Nielsen', 'Yasmin Pedersen', 'Zander Jensen',
  'Amalie Larsen'
]

/**
 * Determine gender based on first name (Danish standard).
 * Returns 'Herre' for male names, 'Dame' for female names.
 */
const getGenderFromName = (fullName: string): 'Herre' | 'Dame' => {
  const firstName = fullName.split(' ')[0].toLowerCase()
  
  // Common Danish male first names
  const maleNames = [
    'lars', 'thomas', 'michael', 'anders', 'martin', 'peter', 'jens', 'steen', 'henrik', 'kim',
    'bo', 'claus', 'jan', 'morten', 'rasmus', 'søren', 'ulrik', 'willy', 'zacharias', 'bent',
    'emil', 'noah', 'lucas', 'oliver', 'viktor', 'william', 'malthe', 'magnus', 'elias', 'aksel',
    'jonas', 'liam', 'felix', 'hugo', 'alfred', 'karl', 'viggo', 'storm', 'lauge', 'theo',
    'wilhelm', 'zander'
  ]
  
  // Common Danish female first names
  const femaleNames = [
    'mette', 'anne', 'camilla', 'louise', 'sara', 'maria', 'helle', 'lise', 'nina', 'mia',
    'gitte', 'dorthe', 'lene', 'pia', 'signe', 'tina', 'vibeke', 'yvonne', 'ane', 'cecilie',
    'emma', 'sofia', 'ida', 'freja', 'alberte', 'clara', 'nora', 'luna', 'ellie', 'isabella',
    'alma', 'lily', 'maja', 'ella', 'olivia', 'agnes', 'asta', 'frida', 'liv', 'vera',
    'yasmin', 'amalie'
  ]
  
  if (maleNames.includes(firstName)) {
    return 'Herre'
  } else if (femaleNames.includes(firstName)) {
    return 'Dame'
  }
  
  // Fallback: if name not recognized, use a simple heuristic
  // Most Danish names ending in 'a', 'e', 'i' are female
  if (firstName.endsWith('a') || firstName.endsWith('e') || firstName.endsWith('i')) {
    return 'Dame'
  }
  
  // Default to male for unrecognized names (more common in Danish)
  return 'Herre'
}

/**
 * Demo categories - random selection.
 */
const DEMO_CATEGORIES = ['Single', 'Double', 'Begge'] as const

/**
 * Get random category.
 */
const getRandomCategory = (): string => {
  return DEMO_CATEGORIES[Math.floor(Math.random() * DEMO_CATEGORIES.length)]
}

/**
 * Main seeding function.
 */
async function seedDemoData(tenantId: string = 'demo') {
  console.log('🌱 Starting demo data seeding...')
  console.log(`📋 Using tenant: ${tenantId}`)
  console.log('')

  try {
    // Load tenant config
    const config = await loadTenantConfig(tenantId)
    
    if (!config.postgresUrl) {
      console.error(`❌ Tenant config for "${tenantId}" is missing postgresUrl.`)
      console.error(`Please update packages/webapp/src/config/tenants/${tenantId}.json with your Neon postgresUrl,`)
      console.error(`or set DATABASE_URL environment variable.`)
      process.exit(1)
    }

    // Create Postgres client
    const sql = postgres(config.postgresUrl, {
      ssl: 'require',
      max: 1
    })

    // Test connection
    console.log('🔌 Testing Neon database connection...')
    await sql`SELECT 1`
    console.log('✅ Connected to Neon database')

    // Clear existing data for this tenant only (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing data for tenant...')
    await sql`DELETE FROM match_players WHERE tenant_id = ${tenantId}`
    await sql`DELETE FROM matches WHERE tenant_id = ${tenantId}`
    await sql`DELETE FROM check_ins WHERE tenant_id = ${tenantId}`
    await sql`DELETE FROM training_sessions WHERE tenant_id = ${tenantId}`
    await sql`DELETE FROM players WHERE tenant_id = ${tenantId}`
    await sql`DELETE FROM courts WHERE tenant_id = ${tenantId}`
    console.log('✅ Cleared existing data')

    // Seed courts (based on tenant maxCourts)
    console.log(`🏸 Seeding ${config.maxCourts} courts...`)
    const courtData = Array.from({ length: config.maxCourts }, (_, i) => ({
      idx: i + 1,
      tenant_id: tenantId
    }))
    await sql`INSERT INTO courts ${sql(courtData)}`
    console.log(`✅ Seeded ${config.maxCourts} courts`)

    // Seed players with 3 training groups: Senior A (40), U17 (22), U15 (26)
    console.log(`👥 Seeding players with 3 training groups...`)
    
    // Exact distribution: 40, 22, 26
    const seniorACount = 40
    const u17Count = 22
    const u15Count = 26
    const totalPlayers = seniorACount + u17Count + u15Count
    
    if (DEMO_PLAYER_NAMES.length !== totalPlayers) {
      console.error(`❌ Error: Expected ${totalPlayers} player names, but got ${DEMO_PLAYER_NAMES.length}`)
      process.exit(1)
    }
    
    const playerData = DEMO_PLAYER_NAMES.map((name, index) => {
      let trainingGroup: string[] = []
      
      // Assign to training groups with exact counts
      if (index < seniorACount) {
        trainingGroup = ['Senior A']
      } else if (index < seniorACount + u17Count) {
        trainingGroup = ['U17']
      } else {
        trainingGroup = ['U15']
      }
      
      // Determine gender based on first name (Danish standard)
      const gender = getGenderFromName(name)
      
      // Most players are active (85%)
      const active = Math.random() > 0.15
      
      return {
        name,
        alias: null, // No aliases/nicknames
        level_single: null, // No ranking points
        level_double: null,  // No ranking points
        level_mix: null,     // No ranking points
        gender,
        primary_category: getRandomCategory(), // Random category
        active,
        training_group: trainingGroup,
        tenant_id: tenantId
      }
    })
    const players = await sql`
      INSERT INTO players ${sql(playerData)}
      RETURNING id, name, training_group
    `
    
    const seniorACountActual = players.filter(p => p.training_group?.includes('Senior A')).length || 0
    const u17CountActual = players.filter(p => p.training_group?.includes('U17')).length || 0
    const u15CountActual = players.filter(p => p.training_group?.includes('U15')).length || 0
    
    console.log(`✅ Seeded ${players.length} players`)
    console.log(`   - Senior A: ${seniorACountActual} players`)
    console.log(`   - U17: ${u17CountActual} players`)
    console.log(`   - U15: ${u15CountActual} players`)

    // Seed training sessions (last 14 days, with one active session today)
    console.log('📅 Seeding training sessions...')
    const now = new Date()
    const sessionData = Array.from({ length: 14 }, (_, i) => {
      const sessionDate = new Date(now)
      sessionDate.setDate(sessionDate.getDate() - i)
      // Set realistic time (evening training: 18:00-20:00)
      const hour = 18 + Math.floor(Math.random() * 3) // 18, 19, or 20
      const minute = Math.floor(Math.random() * 4) * 15 // 0, 15, 30, or 45
      sessionDate.setHours(hour, minute, 0, 0)
      
      return {
        date: sessionDate.toISOString(),
        status: i === 0 ? 'active' : 'ended' as const,
        tenant_id: tenantId
      }
    })
    const sessions = await sql`
      INSERT INTO training_sessions ${sql(sessionData)}
      RETURNING id, status
    `
    console.log(`✅ Seeded ${sessions.length} training sessions`)

    // Seed check-ins for active session (realistic: 60-75% of active players check in)
    if (sessions && sessions.length > 0) {
      const activeSession = sessions.find(s => s.status === 'active') || sessions[0]
      const activePlayers = players.filter(p => p.active)
      const checkInCount = Math.floor(activePlayers.length * (0.6 + Math.random() * 0.15)) // 60-75% check in
      
      console.log(`✅ Seeding check-ins for active session...`)
      
      // Shuffle and take random players for check-ins
      const shuffledPlayers = [...activePlayers].sort(() => Math.random() - 0.5)
      const checkInData = shuffledPlayers.slice(0, checkInCount).map((player) => ({
        session_id: activeSession.id,
        player_id: player.id,
        // Realistic: 20% want only 1 round, rest have no limit
        max_rounds: Math.random() < 0.2 ? 1 : null,
        tenant_id: tenantId
      }))
      
      await sql`INSERT INTO check_ins ${sql(checkInData)}`
      console.log(`✅ Seeded ${checkInData.length} check-ins (${Math.round(checkInCount / activePlayers.length * 100)}% of active players)`)
    }
    
    // Close connection
    await sql.end()

    console.log('')
    console.log('🎉 Demo data seeding completed successfully!')
    console.log('')
    console.log('📊 Summary:')
    console.log(`   - Courts: ${config.maxCourts}`)
    console.log(`   - Players: ${players.length}`)
    console.log(`   - Training Groups: Senior A, U17, U15`)
    console.log(`   - Training Sessions: ${sessions.length}`)
    console.log(`   - Check-ins: ${sessions && sessions.length > 0 ? players.slice(0, 15).length : 0}`)
    console.log('')
    console.log(`💡 You can now access the ${tenantId} tenant`)
    
  } catch (error) {
    console.error('❌ Error seeding demo data:', error)
    process.exit(1)
  }
}

// Get tenant ID from command line args
const tenantId = process.argv[2] || 'demo'

// Run the seeding
seedDemoData(tenantId)


