import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { verifyTOTP, generateBackupCodes, hashBackupCodes } from '../../src/lib/auth/totp'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { verifyAccessToken } from '../../src/lib/auth/jwt'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

const verify2FASetupSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits')
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

    const body = verify2FASetupSchema.parse(req.body)

    const sql = getPostgresClient(getDatabaseUrl())

    // Get club
    const clubs = await sql`
      SELECT id, two_factor_secret, two_factor_enabled
      FROM clubs
      WHERE id = ${payload.clubId}
        AND tenant_id = ${payload.tenantId}
    `

    if (clubs.length === 0) {
      return res.status(404).json({ error: 'Club not found' })
    }

    const club = clubs[0]

    if (club.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' })
    }

    if (!club.two_factor_secret) {
      return res.status(400).json({ error: '2FA secret not found. Please run setup-2fa first.' })
    }

    // Verify TOTP code
    const totpValid = verifyTOTP(club.two_factor_secret, body.code)
    if (!totpValid) {
      return res.status(401).json({ error: 'Invalid verification code' })
    }

    // Generate backup codes
    const backupCodes = await generateBackupCodes(10)
    const hashedBackupCodes = await hashBackupCodes(backupCodes)

    // Enable 2FA
    await sql`
      UPDATE clubs
      SET two_factor_enabled = true,
          two_factor_backup_codes = ${hashedBackupCodes}
      WHERE id = ${club.id}
    `

    return res.status(200).json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes // Return plain codes once - user must save them
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    logger.error('2FA verification error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : '2FA verification failed'
    })
  }
}

