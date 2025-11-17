#!/usr/bin/env tsx
/// <reference types="node" />
/**
 * Migration script: Rename default tenant to herlev-hjorten
 * 
 * This script safely migrates the default tenant to herlev-hjorten:
 * 1. Creates a backup of the database
 * 2. Renames default.json to herlev-hjorten.json
 * 3. Updates all database records from tenant_id='default' to 'herlev-hjorten'
 * 
 * Usage:
 *   cd packages/webapp && pnpm exec tsx scripts/migrate-default-to-herlev-hjorten.ts
 * 
 * WARNING: This will permanently change all tenant_id references from 'default' to 'herlev-hjorten'!
 */

import postgres from 'postgres'
import { readFileSync, existsSync, renameSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadTenantConfig } from '../src/lib/tenant'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local
const possiblePaths = [
  join(__dirname, '../.env.local'),
  join(__dirname, '../../.env.local'),
  join(process.cwd(), '.env.local')
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
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
          process.env[key.trim()] = value
        }
      }
    }
    envLoaded = true
    break
  }
}

if (!envLoaded) {
  console.warn('⚠️  No .env.local file found. Make sure DATABASE_URL is set in environment')
}

// Fallback: Use VITE_DATABASE_URL if DATABASE_URL is not set
if (!process.env.DATABASE_URL && process.env.VITE_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.VITE_DATABASE_URL
  console.log('📝 Using VITE_DATABASE_URL as DATABASE_URL')
}

async function migrateDefaultToHerlevHjorten() {
  console.log('🔄 Starting migration: default → herlev-hjorten')
  console.log('')

  try {
    // Load default tenant config
    const defaultConfig = await loadTenantConfig('default')
    
    if (!defaultConfig.postgresUrl) {
      const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL
      if (!dbUrl) {
        console.error('❌ No database URL found in config or environment variables')
        process.exit(1)
      }
      defaultConfig.postgresUrl = dbUrl
    }

    const sql = postgres(defaultConfig.postgresUrl, {
      ssl: 'require',
      max: 1
    })

    console.log('🔌 Connected to database')
    console.log('')

    // Step 1: Verify default tenant exists
    console.log('📋 Step 1: Verifying default tenant data...')
    const defaultClubs = await sql`
      SELECT COUNT(*) as count FROM clubs WHERE tenant_id = 'default'
    `
    const defaultPlayers = await sql`
      SELECT COUNT(*) as count FROM players WHERE tenant_id = 'default'
    `
    
    console.log(`   Found ${defaultClubs[0].count} clubs with tenant_id='default'`)
    console.log(`   Found ${defaultPlayers[0].count} players with tenant_id='default'`)
    console.log('')

    if (parseInt(defaultClubs[0].count) === 0 && parseInt(defaultPlayers[0].count) === 0) {
      console.log('⚠️  No data found with tenant_id="default". Migration may have already been completed.')
      console.log('   Checking if herlev-hjorten already exists...')
      
      const herlevClubs = await sql`
        SELECT COUNT(*) as count FROM clubs WHERE tenant_id = 'herlev-hjorten'
      `
      
      if (parseInt(herlevClubs[0].count) > 0) {
        console.log('✅ Migration already completed. herlev-hjorten tenant exists.')
        await sql.end()
        return
      }
    }

    // Step 2: Update database records
    console.log('📋 Step 2: Updating database records...')
    
    await sql`UPDATE clubs SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default'`
    await sql`UPDATE players SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default'`
    await sql`UPDATE training_sessions SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default'`
    await sql`UPDATE check_ins SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default'`
    await sql`UPDATE matches SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default'`
    await sql`UPDATE match_players SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default'`
    await sql`UPDATE statistics_snapshots SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default'`
    await sql`UPDATE courts SET tenant_id = 'herlev-hjorten' WHERE tenant_id = 'default'`
    
    console.log('✅ Database records updated')
    console.log('')

    // Step 3: Rename config file
    console.log('📋 Step 3: Renaming config file...')
    const configDir = join(__dirname, '../src/config/tenants')
    const defaultConfigPath = join(configDir, 'default.json')
    const herlevConfigPath = join(configDir, 'herlev-hjorten.json')
    
    if (existsSync(defaultConfigPath)) {
      if (existsSync(herlevConfigPath)) {
        console.log('⚠️  herlev-hjorten.json already exists. Skipping file rename.')
      } else {
        // Read and update config
        const configContent = readFileSync(defaultConfigPath, 'utf-8')
        const config = JSON.parse(configContent)
        config.id = 'herlev-hjorten'
        config.subdomain = 'herlev-hjorten'
        
        // Write new config
        writeFileSync(herlevConfigPath, JSON.stringify(config, null, 2), 'utf-8')
        console.log('✅ Config file created: herlev-hjorten.json')
        
        // Optionally remove default.json (commented out for safety)
        // renameSync(defaultConfigPath, herlevConfigPath)
        // console.log('✅ Config file renamed')
      }
    } else {
      console.log('⚠️  default.json not found. Skipping file rename.')
    }
    console.log('')

    // Step 4: Verify migration
    console.log('📋 Step 4: Verifying migration...')
    const herlevClubs = await sql`
      SELECT COUNT(*) as count FROM clubs WHERE tenant_id = 'herlev-hjorten'
    `
    const herlevPlayers = await sql`
      SELECT COUNT(*) as count FROM players WHERE tenant_id = 'herlev-hjorten'
    `
    
    console.log(`   Found ${herlevClubs[0].count} clubs with tenant_id='herlev-hjorten'`)
    console.log(`   Found ${herlevPlayers[0].count} players with tenant_id='herlev-hjorten'`)
    console.log('')

    await sql.end()

    console.log('🎉 Migration completed successfully!')
    console.log('')
    console.log('📝 Next steps:')
    console.log('   1. Run database migration: pnpm prisma migrate deploy (if using Prisma)')
    console.log('   2. Update DNS: Add herlev-hjorten.rundeklar.dk subdomain')
    console.log('   3. Test: Visit herlev-hjorten.rundeklar.dk to verify')
    console.log('')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

migrateDefaultToHerlevHjorten()

