import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { getPostgresClient, getDatabaseUrl } from '../auth/db-helper.js'
import { setCorsHeaders } from '../../src/lib/utils/cors.js'
import { logger } from '../../src/lib/utils/logger.js'

const trackSchema = z.object({
  tenant_id: z.string().min(1, 'Tenant ID is required'),
  path: z.string().min(1, 'Path is required'),
  referrer: z.string().optional().nullable(),
  user_agent: z.string().optional().nullable(),
  utm_source: z.string().optional().nullable(),
  utm_medium: z.string().optional().nullable(),
  utm_campaign: z.string().optional().nullable(),
  session_id: z.string().min(1, 'Session ID is required'),
  is_admin: z.boolean().optional().default(false) // true if viewed by admin/sysadmin
})

/**
 * Track page view analytics
 * This endpoint is public and does not require authentication
 * It tracks page views for marketing site and demo tenant
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Validate request body
    const body = trackSchema.parse(req.body)

    // Get client IP address (anonymized - only first 3 octets)
    const clientIp = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.socket.remoteAddress || 
                     null
    
    // Anonymize IP address (remove last octet for privacy)
    let anonymizedIp: string | null = null
    if (clientIp) {
      const ipStr = Array.isArray(clientIp) ? clientIp[0] : clientIp
      const parts = ipStr.split('.')
      if (parts.length === 4) {
        anonymizedIp = `${parts[0]}.${parts[1]}.${parts[2]}.0`
      }
    }

    // Check if this is a unique visitor (first visit for this session_id + tenant_id)
    const sql = getPostgresClient(getDatabaseUrl())
    
    const existingVisit = await sql`
      SELECT id FROM page_views
      WHERE session_id = ${body.session_id}
        AND tenant_id = ${body.tenant_id}
      LIMIT 1
    `

    const isUniqueVisitor = existingVisit.length === 0

    // Insert page view
    await sql`
      INSERT INTO page_views (
        tenant_id,
        path,
        referrer,
        user_agent,
        ip_address,
        utm_source,
        utm_medium,
        utm_campaign,
        session_id,
        is_unique_visitor,
        is_admin_view
      ) VALUES (
        ${body.tenant_id},
        ${body.path},
        ${body.referrer || null},
        ${body.user_agent || null},
        ${anonymizedIp || null},
        ${body.utm_source || null},
        ${body.utm_medium || null},
        ${body.utm_campaign || null},
        ${body.session_id},
        ${isUniqueVisitor},
        ${body.is_admin || false}
      )
    `

    return res.status(200).json({
      success: true,
      is_unique_visitor: isUniqueVisitor
    })
  } catch (error) {
    logger.error('Error tracking page view:', error)
    
    // Don't expose internal errors to client
    // Tracking failures should not break the app
    return res.status(200).json({
      success: false,
      error: 'Tracking failed'
    })
  }
}

