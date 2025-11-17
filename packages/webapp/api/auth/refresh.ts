import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { generateAccessToken } from '../../src/lib/auth/jwt'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
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
    const body = refreshSchema.parse(req.body)

    const sql = getPostgresClient(getDatabaseUrl())
    const { hashRefreshToken } = await import('../../src/lib/auth/jwt')
    const tokenHash = await hashRefreshToken(body.refreshToken)

    // Find session with club details
    const sessions = await sql`
      SELECT cs.id, cs.club_id, cs.expires_at, c.tenant_id, c.role, c.email
      FROM club_sessions cs
      JOIN clubs c ON cs.club_id = c.id
      WHERE cs.token_hash = ${tokenHash}
        AND cs.expires_at > NOW()
    `

    if (sessions.length === 0) {
      return res.status(401).json({
        error: 'Invalid or expired refresh token'
      })
    }

    const session = sessions[0]

    // Ensure we have required fields
    if (!session.role || !session.email) {
      logger.error('Missing required fields for token generation', { session })
      return res.status(500).json({
        error: 'User data incomplete',
        message: 'Missing role or email'
      })
    }

    // Generate new access token
    const accessToken = generateAccessToken(session.club_id, session.tenant_id, session.role, session.email)

    return res.status(200).json({
      success: true,
      accessToken
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    logger.error('Token refresh error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Token refresh failed'
    })
  }
}

