import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { hashPassword, validatePasswordStrength } from '../../src/lib/auth/password'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
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
    const body = resetPasswordSchema.parse(req.body)

    // Validate password strength
    const passwordValidation = validatePasswordStrength(body.password)
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      })
    }

    const sql = getPostgresClient(getDatabaseUrl())

    // Find club with this token
    const clubs = await sql`
      SELECT id, password_reset_expires
      FROM clubs
      WHERE password_reset_token = ${body.token}
    `

    if (clubs.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired reset token'
      })
    }

    const club = clubs[0]

    // Check if token expired
    if (!club.password_reset_expires || new Date(club.password_reset_expires) < new Date()) {
      return res.status(400).json({
        error: 'Reset token has expired'
      })
    }

    // Hash new password
    const passwordHash = await hashPassword(body.password)

    // Update password and clear reset token
    await sql`
      UPDATE clubs
      SET password_hash = ${passwordHash},
          password_reset_token = NULL,
          password_reset_expires = NULL
      WHERE id = ${club.id}
    `

    // Invalidate all sessions
    await sql`
      DELETE FROM club_sessions
      WHERE club_id = ${club.id}
    `

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    logger.error('Password reset error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Password reset failed'
    })
  }
}

