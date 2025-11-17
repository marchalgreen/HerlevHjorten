import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { sendPasswordResetEmail } from '../../src/lib/auth/email'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { randomBytes } from 'crypto'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  tenantId: z.string().min(1, 'Tenant ID is required')
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = forgotPasswordSchema.parse(req.body)

    const sql = getPostgresClient(getDatabaseUrl())

    // Find club
    const clubs = await sql`
      SELECT id, email
      FROM clubs
      WHERE email = ${body.email}
        AND tenant_id = ${body.tenantId}
    `

    // Always return success (don't reveal if email exists)
    if (clubs.length > 0) {
      const club = clubs[0]

      // Generate reset token
      const resetToken = randomBytes(32).toString('hex')
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      // Store reset token
      await sql`
        UPDATE clubs
        SET password_reset_token = ${resetToken},
            password_reset_expires = ${resetExpires}
        WHERE id = ${club.id}
      `

      // Send reset email
      try {
        await sendPasswordResetEmail(club.email, resetToken, body.tenantId)
      } catch (emailError) {
        logger.error('Failed to send password reset email', emailError)
        // Don't fail the request if email fails
      }
    }

    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    logger.error('Forgot password error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Password reset request failed'
    })
  }
}

