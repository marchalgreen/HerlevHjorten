#!/usr/bin/env tsx
/// <reference types="node" />
/**
 * Create first admin user script
 * 
 * This script creates the first admin user for herlev-hjorten tenant.
 * Use this if your database is empty after running migrations.
 * 
 * Usage:
 *   cd packages/webapp && pnpm exec tsx scripts/create-first-admin.ts [email] [password]
 * 
 * Example:
 *   cd packages/webapp && pnpm exec tsx scripts/create-first-admin.ts admin@example.com MySecurePassword123!
 */

import postgres from 'postgres'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadTenantConfig } from '../src/lib/tenant'
import { hashPassword } from '../src/lib/auth/password'

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

async function createFirstAdmin() {
  const email = process.argv[2]
  const password = process.argv[3]

  if (!email || !password) {
    console.error('❌ Usage: pnpm exec tsx scripts/create-first-admin.ts [email] [password]')
    console.error('')
    console.error('Example:')
    console.error('  pnpm exec tsx scripts/create-first-admin.ts admin@example.com MySecurePassword123!')
    process.exit(1)
  }

  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters')
    process.exit(1)
  }

  console.log('🔐 Creating first admin user...')
  console.log(`📧 Email: ${email}`)
  console.log(`🏢 Tenant: herlev-hjorten`)
  console.log('')

  try {
    // Load tenant config
    const config = await loadTenantConfig('herlev-hjorten')
    
    if (!config.postgresUrl) {
      const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL
      if (!dbUrl) {
        console.error('❌ No database URL found in config or environment variables')
        process.exit(1)
      }
      config.postgresUrl = dbUrl
    }

    const sql = postgres(config.postgresUrl, {
      ssl: 'require',
      max: 1
    })

    console.log('🔌 Connected to database')
    console.log('')

    // Check if user already exists
    const existing = await sql`
      SELECT id, email, role
      FROM clubs
      WHERE email = ${email}
        AND tenant_id = 'herlev-hjorten'
    `

    if (existing.length > 0) {
      console.log('⚠️  User already exists:')
      console.log(`   ID: ${existing[0].id}`)
      console.log(`   Email: ${existing[0].email}`)
      console.log(`   Role: ${existing[0].role}`)
      console.log('')
      console.log('To update role to admin, run:')
      console.log(`   UPDATE clubs SET role = 'admin' WHERE email = '${email}';`)
      await sql.end()
      return
    }

    // Check if any users exist
    const allUsers = await sql`
      SELECT COUNT(*) as count FROM clubs WHERE tenant_id = 'herlev-hjorten'
    `
    
    if (parseInt(allUsers[0].count) > 0) {
      console.log(`⚠️  Found ${allUsers[0].count} existing user(s) for herlev-hjorten tenant`)
      console.log('   Creating additional admin user...')
      console.log('')
    }

    // Hash password
    console.log('🔒 Hashing password...')
    const passwordHash = await hashPassword(password)

    // Create admin user
    console.log('👤 Creating admin user...')
    const [admin] = await sql`
      INSERT INTO clubs (
        tenant_id,
        email,
        password_hash,
        role,
        email_verified
      )
      VALUES (
        'herlev-hjorten',
        ${email},
        ${passwordHash},
        'admin',
        true
      )
      RETURNING id, email, role, tenant_id, created_at
    `

    console.log('')
    console.log('✅ Admin user created successfully!')
    console.log('')
    console.log('📋 User details:')
    console.log(`   ID: ${admin.id}`)
    console.log(`   Email: ${admin.email}`)
    console.log(`   Role: ${admin.role}`)
    console.log(`   Tenant: ${admin.tenant_id}`)
    console.log(`   Created: ${admin.created_at}`)
    console.log('')
    console.log('🔑 You can now log in with:')
    console.log(`   Email: ${email}`)
    console.log(`   Password: [the password you provided]`)
    console.log('')
    console.log('📝 Next steps:')
    console.log('   1. Start the app: pnpm dev')
    console.log('   2. Go to login page')
    console.log('   3. Select "Administrator" tab')
    console.log('   4. Log in with the credentials above')
    console.log('')

    await sql.end()
  } catch (error) {
    console.error('❌ Error creating admin user:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('relation "clubs" does not exist')) {
        console.error('')
        console.error('⚠️  The clubs table does not exist!')
        console.error('   Make sure you have run migration 007_add_club_auth.sql first')
        console.error('   Then run migration 008_update_clubs_for_multi_tenant.sql')
      } else if (error.message.includes('column "role" does not exist')) {
        console.error('')
        console.error('⚠️  The role column does not exist!')
        console.error('   Make sure you have run migration 008_update_clubs_for_multi_tenant.sql')
      } else if (error.message.includes('violates check constraint')) {
        console.error('')
        console.error('⚠️  Constraint violation!')
        console.error('   Check that migrations 007 and 008 have been run successfully')
      }
    }
    
    process.exit(1)
  }
}

createFirstAdmin()

