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
import type { VercelRequest, VercelResponse } from '@vercel/node'

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

// Fallback: Use VITE_DATABASE_URL if DATABASE_URL is not set (for compatibility)
if (!process.env.DATABASE_URL && process.env.VITE_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.VITE_DATABASE_URL
  console.log('📝 Using VITE_DATABASE_URL as DATABASE_URL')
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
    const connectionString = 
      process.env.DATABASE_URL || 
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.VITE_DATABASE_URL ||
      process.env.VITE_DATABASE_URL_UNPOOLED
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set. Create .env.local with DATABASE_URL=... or VITE_DATABASE_URL=...')
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

// Wrapper to convert Vercel handler to Express handler
const wrapHandler = (handler: (req: VercelRequest, res: VercelResponse) => Promise<VercelResponse | void>) => {
  return async (req: express.Request, res: express.Response) => {
    // Convert Express req/res to Vercel format
    // Map Express params to both params and query for compatibility
    // Ensure headers and socket are properly preserved
    const vercelReq = {
      ...req,
      headers: req.headers || {},
      socket: req.socket || undefined,
      params: req.params || {},
      query: {
        ...req.query,
        ...req.params // Include path parameters in query for Vercel compatibility
      }
    } as unknown as VercelRequest
    const vercelRes = res as unknown as VercelResponse
    await handler(vercelReq, vercelRes)
  }
}

// Load auth route handlers
async function setupAuthRoutes() {
  const registerHandler = (await import('../api/auth/register.js')).default
  const verifyEmailHandler = (await import('../api/auth/verify-email.js')).default
  const loginHandler = (await import('../api/auth/login.js')).default
  const refreshHandler = (await import('../api/auth/refresh.js')).default
  const logoutHandler = (await import('../api/auth/logout.js')).default
  const forgotPasswordHandler = (await import('../api/auth/forgot-password.js')).default
  const resetPasswordHandler = (await import('../api/auth/reset-password.js')).default
  const resetPinHandler = (await import('../api/auth/reset-pin.js')).default
  const changePasswordHandler = (await import('../api/auth/change-password.js')).default
  const setup2FAHandler = (await import('../api/auth/setup-2fa.js')).default
  const verify2FASetupHandler = (await import('../api/auth/verify-2fa-setup.js')).default
  const disable2FAHandler = (await import('../api/auth/disable-2fa.js')).default
  const meHandler = (await import('../api/auth/me.js')).default
  const updateProfileHandler = (await import('../api/auth/update-profile.js')).default

  // Auth routes
  app.post('/api/auth/register', wrapHandler(registerHandler))
  app.post('/api/auth/verify-email', wrapHandler(verifyEmailHandler))
  app.post('/api/auth/login', wrapHandler(loginHandler))
  app.post('/api/auth/refresh', wrapHandler(refreshHandler))
  app.post('/api/auth/logout', wrapHandler(logoutHandler))
  app.post('/api/auth/forgot-password', wrapHandler(forgotPasswordHandler))
  app.post('/api/auth/reset-password', wrapHandler(resetPasswordHandler))
  app.post('/api/auth/reset-pin', wrapHandler(resetPinHandler))
  app.post('/api/auth/change-password', wrapHandler(changePasswordHandler))
  app.post('/api/auth/setup-2fa', wrapHandler(setup2FAHandler))
  app.post('/api/auth/verify-2fa-setup', wrapHandler(verify2FASetupHandler))
  app.post('/api/auth/disable-2fa', wrapHandler(disable2FAHandler))
  app.get('/api/auth/me', wrapHandler(meHandler))
  app.put('/api/auth/update-profile', wrapHandler(updateProfileHandler))
  app.post('/api/auth/update-profile', wrapHandler(updateProfileHandler))
}

// Load admin route handlers
async function setupAdminRoutes() {
  const tenantsHandler = (await import('../api/admin/tenants.js')).default
  const tenantByIdHandler = (await import('../api/admin/tenants/[id].js')).default
  const tenantAdminsHandler = (await import('../api/admin/tenants/[id]/admins.js')).default
  
  // Admin routes
  app.get('/api/admin/tenants', wrapHandler(tenantsHandler))
  app.post('/api/admin/tenants', wrapHandler(tenantsHandler))
  app.get('/api/admin/tenants/:id', wrapHandler(tenantByIdHandler))
  app.put('/api/admin/tenants/:id', wrapHandler(tenantByIdHandler))
  app.delete('/api/admin/tenants/:id', wrapHandler(tenantByIdHandler))
  app.get('/api/admin/tenants/:id/admins', wrapHandler(tenantAdminsHandler))
  app.post('/api/admin/tenants/:id/admins', wrapHandler(tenantAdminsHandler))
}

// Load tenant admin route handlers
async function setupTenantAdminRoutes() {
  const coachesHandler = (await import('../api/[tenantId]/admin/coaches.js')).default
  const coachByIdHandler = (await import('../api/[tenantId]/admin/coaches/[id].js')).default
  
  // Tenant admin routes (dynamically handle tenantId)
  app.get('/api/:tenantId/admin/coaches', wrapHandler(coachesHandler))
  app.post('/api/:tenantId/admin/coaches', wrapHandler(coachesHandler))
  app.get('/api/:tenantId/admin/coaches/:id', wrapHandler(coachByIdHandler))
  app.put('/api/:tenantId/admin/coaches/:id', wrapHandler(coachByIdHandler))
  app.delete('/api/:tenantId/admin/coaches/:id', wrapHandler(coachByIdHandler))
  app.post('/api/:tenantId/admin/coaches/:id', wrapHandler(coachByIdHandler)) // For PIN reset
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
    console.error('❌ Database error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Database query failed'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      query: req.body.query?.substring(0, 200),
      params: req.body.params?.slice(0, 5),
      tenantId: req.body.tenantId
    })
    return res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    })
  }
})

// Setup all routes and start server
Promise.all([
  setupAuthRoutes(),
  setupAdminRoutes(),
  setupTenantAdminRoutes()
]).then(() => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 API server running on http://127.0.0.1:${PORT}`)
    console.log(`📡 API endpoints:`)
    console.log(`   - POST /api/db`)
    console.log(`   - POST /api/auth/register`)
    console.log(`   - POST /api/auth/login`)
    console.log(`   - GET /api/admin/tenants`)
    console.log(`   - GET /api/:tenantId/admin/coaches`)
    console.log(`   - ... and other routes`)
    console.log(`\n💡 Keep this running while developing`)
    console.log(`💡 Frontend will start automatically via concurrently\n`)
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Shutting down API server...')
    server.close(() => {
      console.log('✅ API server closed')
      // Close database connections
      if (sql) {
        sql.end()
        console.log('✅ Database connections closed')
      }
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}).catch((error) => {
  console.error('Failed to load routes:', error)
  process.exit(1)
})

