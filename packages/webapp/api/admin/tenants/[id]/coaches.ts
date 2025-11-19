import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, requireSuperAdmin, AuthenticatedRequest } from '../../../../src/lib/auth/middleware.js'
import { getPostgresClient, getDatabaseUrl } from '../../../auth/db-helper.js'
import { logger } from '../../../../src/lib/utils/logger.js'
import { setCorsHeaders } from '../../../../src/lib/utils/cors.js'

export default async function handler(
  req: AuthenticatedRequest & { query?: { id?: string }, params?: { id?: string } },
  res: VercelResponse
) {
  setCorsHeaders(res, req.headers.origin)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // Require authentication and super admin role
    await requireAuth(req)
    requireSuperAdmin(req)

    // Get tenantId from params (Express) or query (Vercel)
    const tenantId = (req.params?.id || req.query?.id) as string
    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant ID is required'
      })
    }

    if (req.method === 'GET') {
      // List coach users for tenant
      const sql = getPostgresClient(getDatabaseUrl())
      
      const coaches = await sql`
        SELECT id, email, username, role, email_verified, created_at, last_login
        FROM clubs
        WHERE tenant_id = ${tenantId}
          AND role = 'coach'
        ORDER BY created_at DESC
      `
      
      return res.status(200).json({
        success: true,
        coaches: coaches.map((coach) => ({
          id: coach.id,
          email: coach.email,
          username: coach.username,
          role: coach.role,
          emailVerified: coach.email_verified,
          createdAt: coach.created_at,
          lastLogin: coach.last_login
        }))
      })
    } else {
      return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return res.status(401).json({ error: error.message })
    }

    if (error instanceof Error && error.message.includes('Super admin access required')) {
      return res.status(403).json({ error: error.message })
    }

    logger.error('Coach listing error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch coaches'
    })
  }
}

