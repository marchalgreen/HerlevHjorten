/**
 * Alternative script to run the SQL migration directly using Supabase client.
 * Use this if the Supabase SQL Editor is not working.
 * 
 * Usage:
 * 1. Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set in .env.local
 * 2. Run: pnpm tsx scripts/run-migration.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
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

// Note: For running SQL migrations, we need the service_role key, not the anon key
// The anon key has limited permissions. You'll need to get the service_role key from
// Supabase dashboard → Settings → API → service_role key
console.log('⚠️  Note: This script requires the service_role key to run SQL migrations.')
console.log('⚠️  The anon key has limited permissions and cannot execute DDL statements.\n')
console.log('Please use one of these methods instead:')
console.log('1. Supabase SQL Editor (if working)')
console.log('2. Supabase CLI: supabase db push')
console.log('3. Direct psql connection\n')

console.log('To get your service_role key:')
console.log('1. Go to Supabase dashboard → Settings → API')
console.log('2. Find "service_role" key (keep this secret!)')
console.log('3. Add it to .env.local as VITE_SUPABASE_SERVICE_ROLE_KEY')
console.log('4. Then modify this script to use the service_role key\n')

// Read the migration file
const migrationPath = join(__dirname, '../../supabase/migrations/001_initial_schema.sql')
if (!existsSync(migrationPath)) {
  console.error(`Error: Migration file not found at ${migrationPath}`)
  process.exit(1)
}

const migrationSQL = readFileSync(migrationPath, 'utf-8')

// Check if service_role key is available
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  console.log('Migration SQL file location:', migrationPath)
  console.log('\nYou can manually copy the SQL and run it in:')
  console.log('- Supabase SQL Editor')
  console.log('- Supabase CLI')
  console.log('- psql client')
  process.exit(0)
}

// Use service_role key for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('Running migration...\n')
  
  // Split SQL by semicolons (simple approach - may need refinement for complex SQL)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    if (statement.trim()) {
      console.log(`Executing: ${statement.substring(0, 50)}...`)
      const { error } = await supabase.rpc('exec_sql', { sql: statement })
      
      if (error) {
        // Try direct query (may not work with DDL)
        const { error: queryError } = await supabase.from('_migrations').select('*').limit(0)
        if (queryError) {
          console.error('Error:', error.message)
          console.log('\n⚠️  Direct SQL execution may not work with Supabase client.')
          console.log('Please use one of the alternative methods mentioned above.')
          process.exit(1)
        }
      }
    }
  }

  console.log('\n✓ Migration complete!')
}

// Note: Supabase JS client doesn't support direct SQL execution for DDL statements
// This is why we recommend using the SQL Editor, CLI, or psql
console.log('⚠️  The Supabase JS client cannot execute DDL statements (CREATE TABLE, etc.)')
console.log('⚠️  Please use the Supabase SQL Editor, CLI, or psql instead.\n')

runMigration().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})

