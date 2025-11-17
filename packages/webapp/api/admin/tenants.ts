import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAuth, requireSuperAdmin, AuthenticatedRequest } from '../../src/lib/auth/middleware'
import { isSuperAdmin } from '../../src/lib/auth/roles'
import { hashPassword } from '../../src/lib/auth/password'
import { getPostgresClient, getDatabaseUrl } from '../auth/db-helper'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'
import {
  nameToSubdomain,
  validateSubdomain,
  isSubdomainAvailable,
  createTenantConfig,
  getAllTenantConfigs,
  getTenantConfig
} from '../../src/lib/admin/tenant-utils'

const createTenantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  subdomain: z.string().optional(), // Auto-generated if not provided
  logo: z.string().optional(),
  maxCourts: z.number().int().min(1).max(20).optional(),
  adminEmail: z.string().email('Valid admin email is required'),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
  postgresUrl: z.string().url().optional() // Optional - uses default if not provided
})

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  logo: z.string().optional(),
  maxCourts: z.number().int().min(1).max(20).optional(),
  features: z.record(z.unknown()).optional()
})

export default async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin)
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // Require authentication and super admin role
    await requireAuth(req)
    requireSuperAdmin(req)

    if (req.method === 'GET') {
      // List all tenants
      const configs = await getAllTenantConfigs()
      
      // Get user counts for each tenant
      const sql = getPostgresClient(getDatabaseUrl())
      const tenantIds = configs.map(c => c.id)
      
      let userCounts: Array<{ tenant_id: string; count: number }> = []
      if (tenantIds.length > 0) {
        const result = await sql`
          SELECT tenant_id, COUNT(*)::int as count
          FROM clubs
          WHERE tenant_id = ANY(${tenantIds})
          GROUP BY tenant_id
        `
        userCounts = result as Array<{ tenant_id: string; count: number }>
      }
      
      const countsMap = new Map(userCounts.map((r) => [r.tenant_id, r.count]))
      
      const tenants = configs.map(config => ({
        id: config.id,
        name: config.name,
        subdomain: config.subdomain,
        userCount: countsMap.get(config.id) || 0
      }))
      
      return res.status(200).json({
        success: true,
        tenants
      })
    } else if (req.method === 'POST') {
      // Create new tenant
      const body = createTenantSchema.parse(req.body)
      
      // Generate subdomain if not provided
      let subdomain = body.subdomain || nameToSubdomain(body.name)
      
      // Validate subdomain
      const subdomainValidation = validateSubdomain(subdomain)
      if (!subdomainValidation.isValid) {
        return res.status(400).json({
          error: 'Invalid subdomain',
          details: subdomainValidation.errors
        })
      }
      
      // Check if subdomain is available
      const available = await isSubdomainAvailable(subdomain)
      if (!available) {
        return res.status(400).json({
          error: `Subdomain "${subdomain}" is already in use`
        })
      }
      
      // Use subdomain as tenant ID
      const tenantId = subdomain
      
      // Create tenant config file
      const tenantConfig = await createTenantConfig({
        id: tenantId,
        name: body.name,
        subdomain,
        logo: body.logo,
        maxCourts: body.maxCourts,
        postgresUrl: body.postgresUrl
      })
      
      // Create admin user in database
      const sql = getPostgresClient(getDatabaseUrl())
      const passwordHash = await hashPassword(body.adminPassword)
      
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
          ${body.adminEmail},
          ${passwordHash},
          'admin',
          true
        )
        RETURNING id, email, tenant_id, role
      `
      
      return res.status(201).json({
        success: true,
        tenant: tenantConfig,
        admin: {
          id: admin.id,
          email: admin.email,
          tenantId: admin.tenant_id,
          role: admin.role
        },
        message: `Tenant "${body.name}" created successfully. Admin user created.`
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

    logger.error('Tenant management error', error)
    const errorMessage = error instanceof Error ? error.message : 'Tenant management failed'
    const errorStack = error instanceof Error ? error.stack : undefined
    return res.status(500).json({
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
    })
  }
}

