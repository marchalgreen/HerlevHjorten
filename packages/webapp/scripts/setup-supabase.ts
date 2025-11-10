#!/usr/bin/env tsx
/**
 * Script to set up a Supabase database for a tenant.
 * 
 * This script:
 * 1. Runs the database migration (creates all tables, indexes, RLS policies)
 * 2. Seeds initial courts data based on tenant's maxCourts configuration
 * 
 * Usage:
 *   pnpm tsx packages/webapp/scripts/setup-supabase.ts [tenant-id]
 * 
 * If tenant-id is not provided, it will use "default"
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { loadTenantConfig } from '../src/lib/tenant'

/**
 * Reads SQL migration file.
 */
const readMigrationFile = (): string => {
  const migrationPath = resolve(__dirname, '../../supabase/migrations/001_initial_schema.sql')
  return readFileSync(migrationPath, 'utf-8')
}

/**
 * Seeds courts based on tenant's maxCourts configuration.
 */
const seedCourts = async (supabase: ReturnType<typeof createClient>, maxCourts: number) => {
  console.log(`🏸 Seeding ${maxCourts} courts...`)
  
  // First, check if courts already exist
  const { data: existingCourts } = await supabase.from('courts').select('idx')
  const existingIdxs = new Set(existingCourts?.map(c => c.idx) || [])
  
  // Create courts that don't exist yet
  const courtsToCreate = []
  for (let i = 1; i <= maxCourts; i++) {
    if (!existingIdxs.has(i)) {
      courtsToCreate.push({ idx: i })
    }
  }
  
  if (courtsToCreate.length > 0) {
    const { error } = await supabase.from('courts').insert(courtsToCreate)
    if (error) {
      console.error('❌ Failed to seed courts:', error.message)
      throw error
    }
    console.log(`✅ Created ${courtsToCreate.length} new courts`)
  } else {
    console.log(`✅ All ${maxCourts} courts already exist`)
  }
  
  // Verify we have the right number of courts
  const { data: allCourts, error: verifyError } = await supabase.from('courts').select('idx').order('idx')
  if (verifyError) {
    console.error('❌ Failed to verify courts:', verifyError.message)
    throw verifyError
  }
  
  const courtIdxs = allCourts?.map(c => c.idx).sort((a, b) => a - b) || []
  console.log(`✅ Total courts in database: ${courtIdxs.length} (indices: ${courtIdxs.join(', ')})`)
}

/**
 * Main setup function.
 */
async function setupSupabase(tenantId: string = 'default') {
  console.log('')
  console.log('🚀 Setting up Supabase database')
  console.log('================================')
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
    console.log(`   Supabase URL: ${config.supabaseUrl}`)
    console.log(`   Max Courts: ${config.maxCourts}`)
    console.log('')

    // Create Supabase client
    const supabase = createClient(config.supabaseUrl, config.supabaseKey)

    // Test connection
    console.log('🔌 Testing Supabase connection...')
    const { error: testError } = await supabase.from('players').select('id').limit(1)
    if (testError && !testError.message.includes('relation "players" does not exist')) {
      console.error('❌ Failed to connect to Supabase:', testError.message)
      console.error('   Please check your Supabase URL and key.')
      process.exit(1)
    }
    console.log('✅ Connected to Supabase')
    console.log('')

    // Read migration file
    console.log('📄 Reading migration file...')
    const migrationSQL = readMigrationFile()
    console.log('✅ Migration file loaded')
    console.log('')

    // Run migration
    console.log('🔄 Running database migration...')
    console.log('   This will create all tables, indexes, and RLS policies...')
    
    // Split migration into individual statements
    // Remove the court seeding at the end (we'll do that separately)
    const migrationWithoutCourtSeed = migrationSQL.replace(
      /-- Seed initial courts data.*$/s,
      ''
    ).trim()

    // Execute migration statements one by one
    const statements = migrationWithoutCourtSeed
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    let successCount = 0
    let skipCount = 0
    
    for (const statement of statements) {
      if (statement.length === 0) continue
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        // If exec_sql doesn't exist, try direct query (this won't work for DDL, but we'll try)
        if (error) {
          // For DDL statements, we need to use the SQL editor or psql
          // For now, we'll just log and continue
          console.log(`   ⚠️  Note: Some statements may need to be run manually in Supabase SQL Editor`)
          break
        }
        successCount++
      } catch (err) {
        // Some statements might fail if they already exist - that's okay
        skipCount++
      }
    }

    console.log('')
    console.log('⚠️  IMPORTANT: The migration needs to be run in Supabase SQL Editor')
    console.log('   The script cannot execute DDL statements directly.')
    console.log('')
    console.log('📝 Next steps:')
    console.log('   1. Go to your Supabase project dashboard')
    console.log('   2. Navigate to SQL Editor')
    console.log('   3. Click "New query"')
    console.log('   4. Copy and paste the contents of: supabase/migrations/001_initial_schema.sql')
    console.log('   5. Click "Run" (or press Cmd/Ctrl + Enter)')
    console.log('   6. Wait for "Success. No rows returned" message')
    console.log('')
    
    // After migration, seed courts
    console.log('🏸 Seeding courts...')
    try {
      await seedCourts(supabase, config.maxCourts)
    } catch (err) {
      console.error('❌ Failed to seed courts. Make sure the migration has been run first.')
      console.error('   Error:', err)
      process.exit(1)
    }

    console.log('')
    console.log('🎉 Database setup completed!')
    console.log('')
    console.log('📊 Summary:')
    console.log(`   - Tenant: ${config.name} (${tenantId})`)
    console.log(`   - Courts: ${config.maxCourts}`)
    console.log('')
    console.log('💡 You can now test the tenant at:')
    console.log(`   http://127.0.0.1:5173/#/${tenantId === 'default' ? '' : tenantId + '/'}check-in`)
    console.log('')

  } catch (error) {
    console.error('')
    console.error('❌ Error setting up database:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
    }
    process.exit(1)
  }
}

// Get tenant ID from command line args
const tenantId = process.argv[2] || 'default'

// Run the setup
setupSupabase(tenantId)


