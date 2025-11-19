#!/usr/bin/env tsx
/**
 * Clear all analytics data (page_views)
 * WARNING: This will delete ALL page views data
 * 
 * Usage: pnpm exec tsx scripts/clear-analytics-data.ts
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import postgres from 'postgres'
import { getDatabaseUrl } from '../api/auth/db-helper.js'

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
    const envContent = readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
          process.env[key.trim()] = value
        }
      }
    })
    envLoaded = true
    break
  }
}

if (!envLoaded) {
  console.warn('⚠️  No .env.local file found.')
}

if (!process.env.DATABASE_URL && process.env.VITE_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.VITE_DATABASE_URL
}

async function clearAnalyticsData() {
  try {
    const databaseUrl = getDatabaseUrl()
    const sql = postgres(databaseUrl, {
      ssl: 'require',
      max: 1
    })

    console.log('🔍 Checking current page views count...')
    const countResult = await sql`SELECT COUNT(*)::int as count FROM page_views`
    const currentCount = countResult[0]?.count || 0

    console.log(`📊 Found ${currentCount} page views in database`)

    if (currentCount === 0) {
      console.log('✅ No data to clear')
      await sql.end()
      return
    }

    console.log('\n⚠️  WARNING: This will delete ALL page views data!')
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n')
    
    await new Promise(resolve => setTimeout(resolve, 3000))

    console.log('🗑️  Deleting all page views...')
    const deleteResult = await sql`DELETE FROM page_views`
    console.log('✅ All page views deleted successfully')

    // Verify deletion
    const verifyResult = await sql`SELECT COUNT(*)::int as count FROM page_views`
    const remainingCount = verifyResult[0]?.count || 0
    console.log(`✅ Verification: ${remainingCount} page views remaining`)

    await sql.end()
    console.log('\n🎉 Analytics data cleared successfully!')
  } catch (error) {
    console.error('❌ Error clearing analytics data:', error)
    process.exit(1)
  }
}

clearAnalyticsData()

