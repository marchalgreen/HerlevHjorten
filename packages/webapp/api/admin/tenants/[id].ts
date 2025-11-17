import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAuth, requireSuperAdmin, AuthenticatedRequest } from '../../../src/lib/auth/middleware'
import { getPostgresClient, getDatabaseUrl } from '../../auth/db-helper'
import { getTenantConfig } from '../../../src/lib/admin/tenant-utils'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { logger } from '../../../src/lib/utils/logger'
import { setCorsHeaders } from '../../../src/lib/utils/cors'

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  logo: z.string().optional(),
  maxCourts: z.number().int().min(1).max(20).optional(),
  features: z.record(z.unknown()).optional()
})

export default async function handler(
  req: AuthenticatedRequest & { query?: { id?: string }, params?: { id?: string } },
  res: VercelResponse
) {
  setCorsHeaders(res, req.headers.origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

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
      // Get tenant details
      logger.debug(`Fetching config for tenant: ${tenantId}`)
      const config = await getTenantConfig(tenantId)
      
      if (!config) {
        logger.warn(`Tenant config not found for: ${tenantId}`)
        return res.status(404).json({
          error: 'Tenant not found',
          tenantId
        })
      }
      
      // Get user counts
      const sql = getPostgresClient(getDatabaseUrl())
      const [userCount] = await sql`
        SELECT COUNT(*) as count
        FROM clubs
        WHERE tenant_id = ${tenantId}
      `
      
      return res.status(200).json({
        success: true,
        tenant: {
          ...config,
          userCount: parseInt(userCount.count)
        }
      })
    } else if (req.method === 'PUT') {
      // Update tenant
      const body = updateTenantSchema.parse(req.body)
      const config = await getTenantConfig(tenantId)
      
      if (!config) {
        return res.status(404).json({
          error: 'Tenant not found'
        })
      }
      
      // Update config
      const updatedConfig = {
        ...config,
        ...(body.name && { name: body.name }),
        ...(body.logo && { logo: body.logo }),
        ...(body.maxCourts && { maxCourts: body.maxCourts }),
        ...(body.features && { features: { ...config.features, ...body.features } })
      }
      
      // Write updated config
      const configPath = join(
        process.cwd(),
        'packages/webapp/src/config/tenants',
        `${tenantId}.json`
      )
      await writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8')
      
      return res.status(200).json({
        success: true,
        tenant: updatedConfig
      })
    } else if (req.method === 'DELETE') {
      // Soft delete tenant (mark as deleted in config, don't delete data)
      const config = await getTenantConfig(tenantId)
      
      if (!config) {
        return res.status(404).json({
          error: 'Tenant not found'
        })
      }
      
      // Add deleted flag to config
      const deletedConfig = {
        ...config,
        deleted: true,
        deletedAt: new Date().toISOString()
      }
      
      const configPath = join(
        process.cwd(),
        'packages/webapp/src/config/tenants',
        `${tenantId}.json`
      )
      await writeFile(configPath, JSON.stringify(deletedConfig, null, 2), 'utf-8')
      
      return res.status(200).json({
        success: true,
        message: `Tenant "${tenantId}" has been deleted`
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
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Tenant management failed'
    })
  }
}

