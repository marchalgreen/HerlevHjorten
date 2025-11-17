import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { verifyPassword } from '../../src/lib/auth/password'
import { verifyPIN } from '../../src/lib/auth/pin'
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from '../../src/lib/auth/jwt'
import { checkLoginAttempts, recordLoginAttempt } from '../../src/lib/auth/rateLimit'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { verifyTOTP } from '../../src/lib/auth/totp'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

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
  setCorsHeaders(res, req.headers.origin)
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = loginSchema.parse(req.body)
    // Safely get IP address - handle both Express and Vercel formats
    const forwardedFor = req.headers?.['x-forwarded-for'] as string | undefined
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || 'unknown'

    const sql = getPostgresClient(getDatabaseUrl())

    // Determine login method
    const isPINLogin = !!(body.username && body.pin)
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
      await recordLoginAttempt(sql, null, rateLimitIdentifier, ipAddress, false)
      return res.status(401).json({
        error: isPINLogin ? 'Invalid username or PIN' : 'Invalid email or password'
      })
    }

    const club = clubs[0]

    // Verify credentials based on login method
    let credentialsValid = false
    if (isPINLogin) {
      if (!club.pin_hash) {
        await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, false)
        return res.status(401).json({
          error: 'PIN not set for this user'
        })
      }
      credentialsValid = await verifyPIN(body.pin!, club.pin_hash)
    } else if (isEmailLogin) {
      credentialsValid = await verifyPassword(body.password!, club.password_hash)
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
        await recordLoginAttempt(sql, club.id, body.email, ipAddress, false)
        return res.status(401).json({
          error: 'Invalid 2FA code'
        })
      }
    }

    // Generate tokens (include role and email)
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

    logger.error('Login error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Login failed'
    })
  }
}

