import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { verifyPassword } from '../../src/lib/auth/password'
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from '../../src/lib/auth/jwt'
import { checkLoginAttempts, recordLoginAttempt } from '../../src/lib/auth/rateLimit'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { verifyTOTP } from '../../src/lib/auth/totp'

// Import optional utilities with fallbacks
let verifyPIN: ((pin: string, hash: string) => Promise<boolean>) | null = null
let logger: { error: (msg: string, error?: unknown) => void } = {
  error: (msg: string, error?: unknown) => console.error(msg, error)
}
let setCorsHeaders: ((res: { setHeader: (name: string, value: string) => void }, origin?: string) => void) = (res, origin) => {
  // In development, allow the requesting origin or all origins
  const isDev = origin && (
    origin.includes('localhost') || 
    origin.includes('127.0.0.1') ||
    !process.env.VERCEL_ENV
  )
  res.setHeader('Access-Control-Allow-Origin', isDev ? (origin || '*') : '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// Try to load optional modules (will fail gracefully if not available)
try {
  const pinModule = require('../../src/lib/auth/pin')
  verifyPIN = pinModule.verifyPIN
} catch {
  // PIN support not available - will disable PIN login
}

try {
  const loggerModule = require('../../src/lib/utils/logger')
  logger = loggerModule.logger
} catch {
  // Use console.error fallback
}

try {
  const corsModule = require('../../src/lib/utils/cors')
  setCorsHeaders = corsModule.setCorsHeaders
} catch {
  // Use basic CORS fallback
}

// Support both email/password (admins) and username/PIN (coaches)
const loginSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  // Email/password login (for admins)
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(1, 'Password is required').optional(),
  // Username/PIN login (for coaches)
  username: z.string().min(1, 'Username is required').optional(),
  pin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits').optional(),
  // 2FA
  totpCode: z.string().optional()
}).refine(
  (data) => (data.email && data.password) || (data.username && data.pin),
  {
    message: 'Either email/password or username/PIN must be provided',
    path: ['email']
  }
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers and ensure JSON content type
  setCorsHeaders(res, req.headers.origin)
  res.setHeader('Content-Type', 'application/json')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Ensure we always return JSON, even on errors
  try {
    // Parse body safely with proper error handling
    let body
    try {
      body = loginSchema.parse(req.body)
    } catch (parseError) {
      if (parseError instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: parseError.errors
        })
      }
      return res.status(400).json({
        error: 'Invalid request body'
      })
    }

    // Safely get IP address - handle both Express and Vercel formats
    const forwardedFor = req.headers?.['x-forwarded-for'] as string | undefined
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || 'unknown'

    // Get database connection safely
    let sql
    try {
      const databaseUrl = getDatabaseUrl()
      if (!databaseUrl) {
        return res.status(500).json({
          error: 'Database configuration error'
        })
      }
      sql = getPostgresClient(databaseUrl)
    } catch (dbError) {
      logger.error('Database connection failed', dbError)
      return res.status(500).json({
        error: 'Database connection failed',
        message: dbError instanceof Error ? dbError.message : 'Unknown database error'
      })
    }

    // Determine login method
    // Only allow PIN login if verifyPIN is available
    const isPINLogin = !!(body.username && body.pin && verifyPIN)
    const isEmailLogin = !!(body.email && body.password)

    // Check rate limiting (use email or username as identifier)
    const rateLimitIdentifier = body.email || body.username || ''
    const rateLimit = await checkLoginAttempts(sql, rateLimitIdentifier, ipAddress)
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many login attempts',
        lockoutUntil: rateLimit.lockoutUntil
      })
    }

    // Find club based on login method
    let clubs
    if (isPINLogin) {
      // PIN login: find by username and tenant_id (case-insensitive)
      clubs = await sql`
        SELECT id, email, username, pin_hash, tenant_id, role, email_verified, two_factor_enabled, two_factor_secret
        FROM clubs
        WHERE LOWER(username) = LOWER(${body.username})
          AND tenant_id = ${body.tenantId}
          AND role = 'coach'
      `
    } else if (isEmailLogin) {
      // Email/password login: find by email and tenant_id (admins)
      clubs = await sql`
        SELECT id, email, username, password_hash, tenant_id, role, email_verified, two_factor_enabled, two_factor_secret
        FROM clubs
        WHERE email = ${body.email}
          AND tenant_id = ${body.tenantId}
          AND role IN ('admin', 'super_admin')
      `
    } else {
      return res.status(400).json({
        error: 'Invalid login credentials'
      })
    }

    if (clubs.length === 0) {
      // Debug: Check what users exist for this tenant
      const debugUsers = await sql`
        SELECT id, email, username, role, tenant_id, 
               password_hash IS NOT NULL as has_password,
               pin_hash IS NOT NULL as has_pin,
               email_verified
        FROM clubs
        WHERE tenant_id = ${body.tenantId}
        LIMIT 10
      `
      
      await recordLoginAttempt(sql, null, rateLimitIdentifier, ipAddress, false)
      return res.status(401).json({
        error: isPINLogin ? 'Invalid username or PIN' : 'Invalid email or password',
        debug: {
          searched_email: body.email,
          searched_username: body.username,
          tenant_id: body.tenantId,
          login_method: isPINLogin ? 'PIN' : 'email',
          available_users: debugUsers.map(u => ({
            email: u.email,
            username: u.username,
            role: u.role,
            has_password: u.has_password,
            has_pin: u.has_pin,
            email_verified: u.email_verified
          }))
        }
      })
    }

    const club = clubs[0]

    // Verify credentials based on login method
    let credentialsValid = false
    if (isPINLogin && verifyPIN) {
      if (!club.pin_hash) {
        await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, false)
        return res.status(401).json({
          error: 'PIN not set for this user'
        })
      }
      credentialsValid = await verifyPIN(body.pin!, club.pin_hash)
    } else if (isEmailLogin) {
      if (!club.password_hash) {
        await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, false)
        return res.status(401).json({
          error: 'Password not set for this user'
        })
      }
      credentialsValid = await verifyPassword(body.password!, club.password_hash)
    } else {
      await recordLoginAttempt(sql, null, rateLimitIdentifier, ipAddress, false)
      return res.status(400).json({
        error: 'Invalid login method',
        message: verifyPIN ? 'Either email/password or username/PIN required' : 'Email/password login required'
      })
    }

    if (!credentialsValid) {
      await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, false)
      return res.status(401).json({
        error: isPINLogin ? 'Invalid username or PIN' : 'Invalid email or password'
      })
    }

    // Check email verification (only required for email/password login, not PIN)
    if (isEmailLogin && !club.email_verified) {
      return res.status(403).json({
        error: 'Email not verified. Please check your email for verification link.'
      })
    }

    // Check 2FA
    if (club.two_factor_enabled) {
      if (!body.totpCode) {
        return res.status(200).json({
          requires2FA: true,
          message: 'Two-factor authentication required'
        })
      }

      if (!club.two_factor_secret) {
        return res.status(500).json({
          error: '2FA enabled but secret not found'
        })
      }

      const totpValid = verifyTOTP(club.two_factor_secret, body.totpCode)
      if (!totpValid) {
        await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, false)
        return res.status(401).json({
          error: 'Invalid 2FA code'
        })
      }
    }

    // Generate tokens (include role and email)
    // Ensure we have required fields
    if (!club.role || !club.email) {
      logger.error('Missing required fields for token generation', { club })
      return res.status(500).json({
        error: 'User data incomplete',
        message: 'Missing role or email'
      })
    }
    
    const accessToken = generateAccessToken(club.id, club.tenant_id, club.role, club.email)
    const refreshToken = await generateRefreshToken()
    const refreshTokenHash = await hashRefreshToken(refreshToken)

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    await sql`
      INSERT INTO club_sessions (club_id, token_hash, expires_at)
      VALUES (${club.id}, ${refreshTokenHash}, ${expiresAt})
    `

    // Update last login
    await sql`
      UPDATE clubs
      SET last_login = NOW()
      WHERE id = ${club.id}
    `

    // Record successful login
    await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, true)

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      club: {
        id: club.id,
        email: club.email,
        username: club.username,
        role: club.role,
        tenantId: club.tenant_id,
        emailVerified: club.email_verified,
        twoFactorEnabled: club.two_factor_enabled
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    // Log error but don't expose internal details
    logger.error('Login error', error)
    
    // Always return JSON, never HTML
    return res.status(500).json({
      error: 'Login failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    })
  }
}
