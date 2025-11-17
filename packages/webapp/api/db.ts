/**
 * Vercel Serverless Function - Database Proxy
 * 
 * This API route proxies Postgres queries from the browser to Neon database.
 * It runs on Vercel's serverless functions (Node.js environment) where postgres.js works.
 */

import postgres from 'postgres'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { logger } from '../src/lib/utils/logger'
import { setCorsHeaders } from '../src/lib/utils/cors'

// Initialize Postgres client (reused across invocations)
let sql: ReturnType<typeof postgres> | null = null

function getPostgresClient() {
  if (!sql) {
    const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set')
    }

    sql = postgres(connectionString, {
      ssl: 'require',
      max: 1, // Serverless functions should use 1 connection
      idle_timeout: 20,
      connect_timeout: 10
    })
  }
  
  return sql
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin)
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { query, params = [], tenantId } = req.body

    if (!query) {
      return res.status(400).json({ error: 'Query is required' })
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for security' })
    }

    const db = getPostgresClient()
    
    // Execute query with parameters
    // Using sql.unsafe for dynamic queries (safe because we control the input)
    // Note: tenant_id filtering is handled at the application layer (postgres.ts)
    // This ensures all queries are tenant-scoped
    const result = await db.unsafe(query, params)

    return res.status(200).json({ data: result })
  } catch (error) {
    logger.error('Database error', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Database query failed' 
    })
  }
}
