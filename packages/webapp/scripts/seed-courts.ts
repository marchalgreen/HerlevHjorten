#!/usr/bin/env tsx
/**
 * Script to seed courts for a tenant based on their maxCourts configuration.
 * 
 * Run this AFTER running the database migration in Supabase SQL Editor.
 * 
 * Usage:
 *   pnpm tsx packages/webapp/scripts/seed-courts.ts [tenant-id]
 * 
 * If tenant-id is not provided, it will use "default"
 */

import { createClient } from '@supabase/supabase-js'
import { loadTenantConfig } from '../src/lib/tenant'

/**
 * Seeds courts based on tenant's maxCourts configuration.
 */
async function seedCourts(tenantId: string = 'default') {
  console.log('')
  console.log('🏸 Seeding Courts')
  console.log('================')
  console.log('')

  try {
    // Load tenant config
    console.log(`📋 Loading tenant config for "${tenantId}"...`)
    const config = await loadTenantConfig(tenantId)
    
    if (!config.supabaseUrl || !config.supabaseKey) {
      console.error('❌ Tenant config is missing Supabase credentials.')
      console.error(`Please update packages/webapp/src/config/tenants/${tenantId}.json with your Supabase credentials.`)
      process.exit(1)
    }

    console.log(`✅ Loaded config for "${config.name}"`)
    console.log(`   Max Courts: ${config.maxCourts}`)
    console.log('')

    // Create Supabase client
    const supabase = createClient(config.supabaseUrl, config.supabaseKey)

    // Test connection
    console.log('🔌 Testing Supabase connection...')
    const { error: testError } = await supabase.from('courts').select('id').limit(1)
    if (testError) {
      console.error('❌ Failed to connect to Supabase:', testError.message)
      if (testError.message.includes('relation "courts" does not exist')) {
        console.error('')
        console.error('⚠️  The database migration has not been run yet!')
        console.error('   Please run the migration in Supabase SQL Editor first.')
        console.error('   See instructions in the setup guide.')
      }
      process.exit(1)
    }
    console.log('✅ Connected to Supabase')
    console.log('')

    // Check existing courts
    console.log('📊 Checking existing courts...')
    const { data: existingCourts, error: fetchError } = await supabase
      .from('courts')
      .select('idx')
      .order('idx')
    
    if (fetchError) {
      console.error('❌ Failed to fetch existing courts:', fetchError.message)
      process.exit(1)
    }

    const existingIdxs = new Set(existingCourts?.map(c => c.idx) || [])
    console.log(`   Found ${existingIdxs.size} existing courts: ${Array.from(existingIdxs).sort((a, b) => a - b).join(', ')}`)
    console.log('')

    // Create missing courts
    const courtsToCreate = []
    for (let i = 1; i <= config.maxCourts; i++) {
      if (!existingIdxs.has(i)) {
        courtsToCreate.push({ idx: i })
      }
    }

    if (courtsToCreate.length === 0) {
      console.log(`✅ All ${config.maxCourts} courts already exist. Nothing to do!`)
      console.log('')
      return
    }

    console.log(`🏸 Creating ${courtsToCreate.length} new courts...`)
    const { error: insertError } = await supabase
      .from('courts')
      .insert(courtsToCreate)
    
    if (insertError) {
      console.error('❌ Failed to create courts:', insertError.message)
      process.exit(1)
    }

    console.log(`✅ Successfully created courts: ${courtsToCreate.map(c => c.idx).join(', ')}`)
    console.log('')

    // Verify final state
    const { data: allCourts, error: verifyError } = await supabase
      .from('courts')
      .select('idx')
      .order('idx')
    
    if (verifyError) {
      console.error('❌ Failed to verify courts:', verifyError.message)
      process.exit(1)
    }

    const courtIdxs = allCourts?.map(c => c.idx).sort((a, b) => a - b) || []
    console.log('📊 Final state:')
    console.log(`   Total courts: ${courtIdxs.length}`)
    console.log(`   Court indices: ${courtIdxs.join(', ')}`)
    console.log('')
    console.log('🎉 Courts seeding completed!')
    console.log('')

  } catch (error) {
    console.error('')
    console.error('❌ Error seeding courts:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
    }
    process.exit(1)
  }
}

// Get tenant ID from command line args
const tenantId = process.argv[2] || 'default'

// Run the seeding
seedCourts(tenantId)


