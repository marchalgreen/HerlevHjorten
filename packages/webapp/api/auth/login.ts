import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { verifyPassword } from '../../src/lib/auth/password'
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from '../../src/lib/auth/jwt'
import { checkLoginAttempts, recordLoginAttempt } from '../../src/lib/auth/rateLimit'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { verifyTOTP } from '../../src/lib/auth/totp'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  tenantId: z.string().min(1, 'Tenant ID is required'),
  totpCode: z.string().optional()
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Ensure we always return JSON, even on errors
  try {
    // Parse body safely
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
    const ipAddress = req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || 'unknown'

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
      return res.status(500).json({
        error: 'Database connection failed',
        message: dbError instanceof Error ? dbError.message : 'Unknown database error'
      })
    }

    // Check rate limiting
    const rateLimit = await checkLoginAttempts(sql, body.email, ipAddress)
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many login attempts',
        lockoutUntil: rateLimit.lockoutUntil
      })
    }

    // Find club
    const clubs = await sql`
      SELECT id, email, password_hash, tenant_id, email_verified, two_factor_enabled, two_factor_secret
      FROM clubs
      WHERE email = ${body.email}
        AND tenant_id = ${body.tenantId}
    `

    if (clubs.length === 0) {
      await recordLoginAttempt(sql, null, body.email, ipAddress, false)
      return res.status(401).json({
        error: 'Invalid email or password'
      })
    }

    const club = clubs[0]

    // Verify password
    const passwordValid = await verifyPassword(body.password, club.password_hash)
    if (!passwordValid) {
      await recordLoginAttempt(sql, club.id, body.email, ipAddress, false)
      return res.status(401).json({
        error: 'Invalid email or password'
      })
    }

    // Check email verification
    if (!club.email_verified) {
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

    // Generate tokens
    const accessToken = generateAccessToken(club.id, club.tenant_id)
    const refreshToken = generateRefreshToken()
    const refreshTokenHash = hashRefreshToken(refreshToken)

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
    await recordLoginAttempt(sql, club.id, body.email, ipAddress, true)

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      club: {
        id: club.id,
        email: club.email,
        tenantId: club.tenant_id,
        emailVerified: club.email_verified,
        twoFactorEnabled: club.two_factor_enabled
      }
    })
  } catch (error) {
    // Log error but don't expose internal details
    console.error('Login error:', error)
    
    // Always return JSON, never HTML
    return res.status(500).json({
      error: 'Login failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    })
  }
}

