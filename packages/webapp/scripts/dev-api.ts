#!/usr/bin/env tsx
/// <reference types="node" />
/**
 * Simple Express server to proxy Postgres queries during development
 * This runs the API route locally without needing Vercel CLI
 * 
 * Usage: pnpm exec tsx scripts/dev-api.ts
 */

import express from 'express'
import postgres from 'postgres'
import cors from 'cors'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local
// Try multiple possible locations
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
}

const app = express()
const PORT = 3000

// Enable CORS and JSON parsing
app.use(cors())
app.use(express.json())

// Initialize Postgres client
let sql: ReturnType<typeof postgres> | null = null

function getPostgresClient() {
  if (!sql) {
    const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set. Create .env.local with DATABASE_URL=...')
    }

    console.log('🔌 Connecting to Neon database...')
    sql = postgres(connectionString, {
      ssl: 'require',
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10
    })
    console.log('✅ Connected to Neon database')
  }
  
  return sql
}

// API route handler (same as Vercel serverless function)
app.post('/api/db', async (req, res) => {
  try {
    const { query, params = [], tenantId } = req.body

    if (!query) {
      return res.status(400).json({ error: 'Query is required' })
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for security' })
    }

    const db = getPostgresClient()
    // Note: tenant_id filtering is handled at the application layer (postgres.ts)
    const result = await db.unsafe(query, params)

    return res.status(200).json({ data: result })
  } catch (error) {
    console.error('Database error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Database query failed'
    console.error('Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      query: req.body.query?.substring(0, 100),
      tenantId: req.body.tenantId
    })
    return res.status(500).json({ 
      error: errorMessage 
    })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://127.0.0.1:${PORT}`)
  console.log(`📡 API endpoint: http://127.0.0.1:${PORT}/api/db`)
  console.log(`\n💡 Keep this running while developing`)
  console.log(`💡 Start frontend in another terminal: pnpm dev\n`)
})

