import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { verifyAccessToken } from '../../src/lib/auth/jwt'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
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

    const sql = getPostgresClient(getDatabaseUrl())

    // Get club info (no sensitive data)
    const clubs = await sql`
      SELECT id, email, username, role, tenant_id, email_verified, two_factor_enabled, created_at, last_login
      FROM clubs
      WHERE id = ${payload.clubId}
        AND tenant_id = ${payload.tenantId}
    `

    if (clubs.length === 0) {
      return res.status(404).json({ error: 'Club not found' })
    }

    const club = clubs[0]

    return res.status(200).json({
      success: true,
      club: {
        id: club.id,
        email: club.email,
        username: club.username,
        role: club.role,
        tenantId: club.tenant_id,
        emailVerified: club.email_verified,
        twoFactorEnabled: club.two_factor_enabled,
        createdAt: club.created_at,
        lastLogin: club.last_login
      }
    })
  } catch (error) {
    logger.error('Get club info error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get club info'
    })
  }
}

