import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { hashPassword, verifyPassword, validatePasswordStrength } from '../../src/lib/auth/password'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { verifyAccessToken } from '../../src/lib/auth/jwt'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
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

    const body = changePasswordSchema.parse(req.body)

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(body.newPassword)
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      })
    }

    const sql = getPostgresClient(getDatabaseUrl())

    // Get club - must be admin or super_admin (coaches use PIN, not password)
    const clubs = await sql`
      SELECT id, password_hash, role
      FROM clubs
      WHERE id = ${payload.clubId}
        AND tenant_id = ${payload.tenantId}
        AND role IN ('admin', 'super_admin')
    `

    if (clubs.length === 0) {
      return res.status(403).json({ error: 'Password change is only available for administrators. Coaches should use PIN change instead.' })
    }

    const club = clubs[0]

    if (!club.password_hash) {
      return res.status(400).json({ error: 'Password not set for this account' })
    }

    // Verify current password
    const passwordValid = await verifyPassword(body.currentPassword, club.password_hash)
    if (!passwordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    // Hash new password
    const passwordHash = await hashPassword(body.newPassword)

    // Update password
    await sql`
      UPDATE clubs
      SET password_hash = ${passwordHash}
      WHERE id = ${club.id}
    `

    // Invalidate all sessions except current (by keeping current refresh token)
    // Note: We don't have the refresh token here, so we invalidate all
    // The client will need to re-authenticate
    await sql`
      DELETE FROM club_sessions
      WHERE club_id = ${club.id}
    `

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    logger.error('Change password error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Password change failed'
    })
  }
}

