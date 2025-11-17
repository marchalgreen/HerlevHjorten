import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { verifyAccessToken } from '../../src/lib/auth/jwt'
import { randomBytes } from 'crypto'
import { sendVerificationEmail } from '../../src/lib/auth/email'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

const updateProfileSchema = z.object({
  email: z.string().email('Invalid email address').optional()
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Require authentication
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const token = authHeader.substring(7)
    const payload = verifyAccessToken(token)
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    const body = updateProfileSchema.parse(req.body)

    const sql = getPostgresClient(getDatabaseUrl())

    // Get current club
    const clubs = await sql`
      SELECT id, email, tenant_id
      FROM clubs
      WHERE id = ${payload.clubId}
        AND tenant_id = ${payload.tenantId}
    `

    if (clubs.length === 0) {
      return res.status(404).json({ error: 'Club not found' })
    }

    const club = clubs[0]

    // Update email if provided
    if (body.email && body.email !== club.email) {
      // Check if email is already taken
      const existing = await sql`
        SELECT id FROM clubs
        WHERE email = ${body.email}
          AND id != ${club.id}
      `

      if (existing.length > 0) {
        return res.status(409).json({ error: 'Email already in use' })
      }

      // Generate verification token
      const verificationToken = randomBytes(32).toString('hex')
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      // Update email and require verification
      await sql`
        UPDATE clubs
        SET email = ${body.email},
            email_verified = false,
            email_verification_token = ${verificationToken},
            email_verification_expires = ${verificationExpires}
        WHERE id = ${club.id}
      `

      // Send verification email
      try {
        await sendVerificationEmail(body.email, verificationToken, club.tenant_id)
      } catch (emailError) {
        logger.error('Failed to send verification email', emailError)
        // Don't fail the request if email fails
      }
    }

    // Get updated club info
    const updated = await sql`
      SELECT id, email, tenant_id, email_verified, two_factor_enabled, created_at, last_login
      FROM clubs
      WHERE id = ${club.id}
    `

    return res.status(200).json({
      success: true,
      message: body.email && body.email !== club.email 
        ? 'Email updated. Please check your email to verify the new address.'
        : 'Profile updated successfully',
      club: {
        id: updated[0].id,
        email: updated[0].email,
        tenantId: updated[0].tenant_id,
        emailVerified: updated[0].email_verified,
        twoFactorEnabled: updated[0].two_factor_enabled,
        createdAt: updated[0].created_at,
        lastLogin: updated[0].last_login
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    logger.error('Update profile error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Profile update failed'
    })
  }
}

