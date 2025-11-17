import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { verifyPassword } from '../../src/lib/auth/password'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { verifyAccessToken } from '../../src/lib/auth/jwt'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

const disable2FASchema = z.object({
  password: z.string().min(1, 'Password is required')
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

    const body = disable2FASchema.parse(req.body)

    const sql = getPostgresClient(getDatabaseUrl())

    // Get club
    const clubs = await sql`
      SELECT id, password_hash, two_factor_enabled
      FROM clubs
      WHERE id = ${payload.clubId}
        AND tenant_id = ${payload.tenantId}
    `

    if (clubs.length === 0) {
      return res.status(404).json({ error: 'Club not found' })
    }

    const club = clubs[0]

    if (!club.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is not enabled' })
    }

    // Verify password
    const passwordValid = await verifyPassword(body.password, club.password_hash)
    if (!passwordValid) {
      return res.status(401).json({ error: 'Password is incorrect' })
    }

    // Disable 2FA
    await sql`
      UPDATE clubs
      SET two_factor_enabled = false,
          two_factor_secret = NULL,
          two_factor_backup_codes = NULL
      WHERE id = ${club.id}
    `

    return res.status(200).json({
      success: true,
      message: '2FA disabled successfully'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    logger.error('Disable 2FA error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Disable 2FA failed'
    })
  }
}

