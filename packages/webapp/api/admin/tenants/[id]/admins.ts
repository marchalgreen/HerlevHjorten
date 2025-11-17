import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAuth, requireSuperAdmin, AuthenticatedRequest } from '../../../../src/lib/auth/middleware'
import { hashPassword } from '../../../../src/lib/auth/password'
import { getPostgresClient, getDatabaseUrl } from '../../../auth/db-helper'
import { logger } from '../../../../src/lib/utils/logger'
import { setCorsHeaders } from '../../../../src/lib/utils/cors'

const createAdminSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
})

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
      // List admin users for tenant
      const sql = getPostgresClient(getDatabaseUrl())
      
      const admins = await sql`
        SELECT id, email, role, email_verified, created_at, last_login
        FROM clubs
        WHERE tenant_id = ${tenantId}
          AND role IN ('admin', 'super_admin')
        ORDER BY created_at DESC
      `
      
      return res.status(200).json({
        success: true,
        admins: admins.map((admin) => ({
          id: admin.id,
          email: admin.email,
          role: admin.role,
          emailVerified: admin.email_verified,
          createdAt: admin.created_at,
          lastLogin: admin.last_login
        }))
      })
    } else if (req.method === 'POST') {
      // Create admin user for tenant
      const body = createAdminSchema.parse(req.body)
      
      const sql = getPostgresClient(getDatabaseUrl())
      
      // Check if email already exists for this tenant
      const existing = await sql`
        SELECT id
        FROM clubs
        WHERE email = ${body.email}
          AND tenant_id = ${tenantId}
      `
      
      if (existing.length > 0) {
        return res.status(400).json({
          error: 'Email already exists for this tenant'
        })
      }
      
      // Create admin user
      const passwordHash = await hashPassword(body.password)
      
      const [admin] = await sql`
        INSERT INTO clubs (
          tenant_id,
          email,
          password_hash,
          role,
          email_verified
        )
        VALUES (
          ${tenantId},
          ${body.email},
          ${passwordHash},
          'admin',
          true
        )
        RETURNING id, email, tenant_id, role, email_verified
      `
      
      return res.status(201).json({
        success: true,
        admin: {
          id: admin.id,
          email: admin.email,
          tenantId: admin.tenant_id,
          role: admin.role,
          emailVerified: admin.email_verified
        },
        message: `Admin user created successfully for tenant "${tenantId}"`
      })
    } else {
      return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return res.status(401).json({ error: error.message })
    }

    if (error instanceof Error && error.message.includes('Super admin access required')) {
      return res.status(403).json({ error: error.message })
    }

    logger.error('Admin management error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Admin management failed'
    })
  }
}

