import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { hashPIN, verifyPIN, validatePIN } from '../../src/lib/auth/pin'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { verifyAccessToken } from '../../src/lib/auth/jwt'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

const changePINSchema = z.object({
  currentPIN: z.string().min(6, 'Current PIN must be 6 digits').max(6, 'Current PIN must be 6 digits'),
  newPIN: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits')
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

    const body = changePINSchema.parse(req.body)

    // Validate new PIN format
    const pinValidation = validatePIN(body.newPIN)
    if (!pinValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid PIN format',
        details: pinValidation.errors
      })
    }

    const sql = getPostgresClient(getDatabaseUrl())

    // Get club - must be a coach
    const clubs = await sql`
      SELECT id, pin_hash, role
      FROM clubs
      WHERE id = ${payload.clubId}
        AND tenant_id = ${payload.tenantId}
        AND role = 'coach'
    `

    if (clubs.length === 0) {
      return res.status(404).json({ error: 'Coach not found' })
    }

    const club = clubs[0]

    if (!club.pin_hash) {
      return res.status(400).json({ error: 'PIN not set for this account' })
    }

    // Verify current PIN
    const pinValid = await verifyPIN(body.currentPIN, club.pin_hash)
    if (!pinValid) {
      return res.status(401).json({ error: 'Current PIN is incorrect' })
    }

    // Hash new PIN
    const pinHash = await hashPIN(body.newPIN)

    // Update PIN
    await sql`
      UPDATE clubs
      SET pin_hash = ${pinHash}
      WHERE id = ${club.id}
    `

    // Invalidate all sessions except current
    await sql`
      DELETE FROM club_sessions
      WHERE club_id = ${club.id}
    `

    return res.status(200).json({
      success: true,
      message: 'PIN changed successfully'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    logger.error('Change PIN error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'PIN change failed'
    })
  }
}

