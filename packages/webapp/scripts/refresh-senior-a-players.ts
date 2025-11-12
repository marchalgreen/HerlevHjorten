#!/usr/bin/env tsx
/**
 * Script to remove and re-add Senior A players with random Danish names.
 * 
 * - Removes all existing Senior A players
 * - Adds 25 new players to Senior A with random Danish names
 * - Ensures realistic gender matching with Danish names
 * - No rankings, no nicknames
 * 
 * Usage:
 *   pnpm --filter webapp exec tsx scripts/refresh-senior-a-players.ts [tenant-id]
 * 
 * If tenant-id is not provided, it will use "default"
 */

import { createClient } from '@supabase/supabase-js'
import { loadTenantConfig } from '../src/lib/tenant'

/**
 * Realistic Danish first names with gender mapping
 */
const DANISH_NAMES = {
  male: [
    'Anders', 'Benjamin', 'Christian', 'Daniel', 'Emil', 'Frederik', 'Gustav', 'Henrik',
    'Jakob', 'Kristian', 'Lucas', 'Magnus', 'Nikolaj', 'Oliver', 'Patrick', 'Rasmus',
    'Sebastian', 'Thomas', 'Victor', 'William', 'Alexander', 'Anton', 'Carl', 'David',
    'Erik', 'Felix', 'Gustav', 'Hugo', 'Isak', 'Jonas', 'Karl', 'Lars', 'Marcus',
    'Noah', 'Oscar', 'Philip', 'Simon', 'Tobias', 'Viktor', 'Adam', 'Bjørn', 'Casper',
    'Dennis', 'Elias', 'Finn', 'Gunnar', 'Hans', 'Ivan', 'Jesper', 'Kasper', 'Lasse',
    'Mads', 'Niels', 'Ole', 'Per', 'Rune', 'Steen', 'Torben', 'Ulrik', 'Vagn', 'Willy'
  ],
  female: [
    'Anna', 'Emma', 'Sofia', 'Ida', 'Freja', 'Clara', 'Laura', 'Alberte',
    'Mathilde', 'Olivia', 'Alma', 'Ella', 'Luna', 'Nora', 'Saga', 'Vilma',
    'Agnes', 'Ellen', 'Julie', 'Maja', 'Sara', 'Amalie', 'Caroline', 'Emilie',
    'Isabella', 'Lærke', 'Marie', 'Nanna', 'Rosa', 'Sofie', 'Victoria', 'Astrid',
    'Cecilie', 'Ditte', 'Frida', 'Hannah', 'Johanne', 'Kirsten', 'Line', 'Mette',
    'Pernille', 'Signe', 'Tine', 'Ulla', 'Vibeke', 'Yrsa', 'Zarah', 'Birgit',
    'Dorthe', 'Else', 'Grethe', 'Helle', 'Inger', 'Jytte', 'Karen', 'Lisbeth',
    'Merete', 'Nina', 'Pia', 'Rikke', 'Susanne', 'Tina', 'Vibeke', 'Winnie'
  ]
}

/**
 * Danish surnames
 */
const DANISH_SURNAMES = [
  'Andersen', 'Hansen', 'Jensen', 'Nielsen', 'Pedersen', 'Christensen', 'Larsen',
  'Sørensen', 'Rasmussen', 'Jørgensen', 'Petersen', 'Madsen', 'Kristensen',
  'Olsen', 'Thomsen', 'Christiansen', 'Poulsen', 'Johansen', 'Møller', 'Knudsen',
  'Mortensen', 'Holm', 'Mikkelsen', 'Jacobsen', 'Frederiksen', 'Schmidt', 'Andreasen',
  'Lund', 'Hedegaard', 'Dahl', 'Bertelsen', 'Eriksen', 'Vestergaard', 'Bak', 'Berg',
  'Bjerregaard', 'Bruun', 'Carlsen', 'Dalsgaard', 'Eskildsen', 'Frandsen', 'Gade',
  'Hjorth', 'Iversen', 'Kjær', 'Lassen', 'Mathiesen', 'Nørgaard', 'Overgaard',
  'Petersen', 'Ravn', 'Sand', 'Skov', 'Strøm', 'Tang', 'Vang', 'Winther', 'Østergaard'
]

/**
 * Generates a random Danish name with realistic gender matching
 */
function generateDanishName(gender: 'Herre' | 'Dame'): { name: string; gender: 'Herre' | 'Dame' } {
  const firstName = gender === 'Herre' 
    ? DANISH_NAMES.male[Math.floor(Math.random() * DANISH_NAMES.male.length)]
    : DANISH_NAMES.female[Math.floor(Math.random() * DANISH_NAMES.female.length)]
  
  const surname = DANISH_SURNAMES[Math.floor(Math.random() * DANISH_SURNAMES.length)]
  
  return {
    name: `${firstName} ${surname}`,
    gender
  }
}

/**
 * Main function
 */
async function refreshSeniorAPlayers(tenantId: string = 'default') {
  console.log('')
  console.log('🔄 Refreshing Senior A Players')
  console.log('===============================')
  console.log('')

  try {
    // Load tenant config
    console.log(`📋 Loading tenant config for "${tenantId}"...`)
    const config = await loadTenantConfig(tenantId)
    
    if (!config.supabaseUrl || !config.supabaseKey) {
      console.error(`❌ Tenant config for "${tenantId}" is missing Supabase credentials.`)
      console.error(`Please update packages/webapp/src/config/tenants/${tenantId}.json with your Supabase credentials.`)
      process.exit(1)
    }

    console.log(`✅ Loaded config for "${config.name}"`)
    console.log('')

    // Create Supabase client
    const supabase = createClient(config.supabaseUrl, config.supabaseKey)

    // Test connection
    console.log('🔌 Testing Supabase connection...')
    const { error: testError } = await supabase.from('players').select('id').limit(1)
    if (testError) {
      console.error('❌ Failed to connect to Supabase:', testError.message)
      process.exit(1)
    }
    console.log('✅ Connected to Supabase')
    console.log('')

    // Step 1: Find and delete Senior A players
    console.log('🗑️  Step 1: Finding Senior A players...')
    const { data: seniorAPlayers, error: fetchError } = await supabase
      .from('players')
      .select('id')
      .contains('training_group', ['Senior A'])
    
    if (fetchError) {
      console.error('❌ Failed to fetch Senior A players:', fetchError.message)
      process.exit(1)
    }

    const seniorACount = seniorAPlayers?.length || 0
    console.log(`   Found ${seniorACount} Senior A players`)

    if (seniorACount > 0) {
      const seniorAIds = seniorAPlayers.map(p => p.id)
      
      // First, delete related data (check-ins, match_players, matches)
      console.log('   Deleting related data (check-ins, match players)...')
      
      // Delete check-ins
      const { error: checkInsError } = await supabase
        .from('check_ins')
        .delete()
        .in('player_id', seniorAIds)
      
      if (checkInsError) {
        console.warn('   Warning: Failed to delete some check-ins:', checkInsError.message)
      }

      // Delete match_players
      const { data: matchPlayers, error: mpFetchError } = await supabase
        .from('match_players')
        .select('match_id')
        .in('player_id', seniorAIds)
      
      if (!mpFetchError && matchPlayers) {
        const matchIds = [...new Set(matchPlayers.map(mp => mp.match_id))]
        
        // Delete match_players
        await supabase
          .from('match_players')
          .delete()
          .in('player_id', seniorAIds)
        
        // Delete matches (if they have no other players)
        if (matchIds.length > 0) {
          for (const matchId of matchIds) {
            const { data: remainingPlayers } = await supabase
              .from('match_players')
              .select('id')
              .eq('match_id', matchId)
              .limit(1)
            
            if (!remainingPlayers || remainingPlayers.length === 0) {
              await supabase.from('matches').delete().eq('id', matchId)
            }
          }
        }
      }

      // Delete players
      console.log('   Deleting Senior A players...')
      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .in('id', seniorAIds)
      
      if (deleteError) {
        console.error('❌ Failed to delete Senior A players:', deleteError.message)
        process.exit(1)
      }
      console.log(`✅ Deleted ${seniorACount} Senior A players`)
    } else {
      console.log('   No Senior A players found to delete')
    }
    console.log('')

    // Step 2: Add 25 new Senior A players with random names
    console.log('➕ Step 2: Adding 25 new Senior A players...')
    const newSeniorAPlayers = []
    for (let i = 0; i < 25; i++) {
      // Mix of genders (roughly 50/50)
      const gender: 'Herre' | 'Dame' = Math.random() > 0.5 ? 'Herre' : 'Dame'
      const { name } = generateDanishName(gender)
      
      newSeniorAPlayers.push({
        name,
        alias: null,
        level_single: null,
        level_double: null,
        level_mix: null,
        gender,
        primary_category: ['Single', 'Double', 'Begge'][Math.floor(Math.random() * 3)] as 'Single' | 'Double' | 'Begge',
        active: true,
        training_group: ['Senior A'],
        preferred_doubles_partners: [],
        preferred_mixed_partners: []
      })
    }

    const { error: insertError } = await supabase
      .from('players')
      .insert(newSeniorAPlayers)
    
    if (insertError) {
      console.error('❌ Failed to add Senior A players:', insertError.message)
      process.exit(1)
    }
    console.log(`✅ Added 25 new players to Senior A training group`)
    console.log('')

    // Verify final state
    console.log('📊 Verifying final state...')
    const { data: allSeniorA, error: verifyError } = await supabase
      .from('players')
      .select('id, name, gender, training_group')
      .contains('training_group', ['Senior A'])
    
    if (verifyError) {
      console.error('❌ Failed to verify:', verifyError.message)
      process.exit(1)
    }

    const maleCount = allSeniorA?.filter(p => p.gender === 'Herre').length || 0
    const femaleCount = allSeniorA?.filter(p => p.gender === 'Dame').length || 0

    console.log('')
    console.log('📊 Final Summary:')
    console.log(`   Total Senior A players: ${allSeniorA?.length || 0}`)
    console.log(`   Male players: ${maleCount}`)
    console.log(`   Female players: ${femaleCount}`)
    console.log('')
    console.log('🎉 Senior A players refresh completed!')
    console.log('')

  } catch (error) {
    console.error('')
    console.error('❌ Error refreshing Senior A players:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
    }
    process.exit(1)
  }
}

// Get tenant ID from command line args
const tenantId = process.argv[2] || 'default'

// Run the refresh
refreshSeniorAPlayers(tenantId)

