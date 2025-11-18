import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../../../src/lib/auth/middleware.js'
import { hashPIN, generateRandomPIN, validatePIN } from '../../../src/lib/auth/pin.js'
import { sendCoachWelcomeEmail } from '../../../src/lib/auth/email.js'
import { getPostgresClient, getDatabaseUrl } from '../../auth/db-helper.js'
import { logger } from '../../../src/lib/utils/logger.js'
import { setCorsHeaders } from '../../../src/lib/utils/cors.js'

const createCoachSchema = z.object({
  email: z.string().email('Valid email is required'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be less than 50 characters'),
  pin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits').optional(), // Optional - will generate if not provided
  sendEmail: z.boolean().optional().default(false) // Whether to send welcome email with PIN
})

const updateCoachSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(50).optional(),
  pin: z.string().min(6).max(6).optional(),
  active: z.boolean().optional()
})

export default async function handler(
  req: AuthenticatedRequest & { query?: { tenantId?: string }, params?: { tenantId?: string } },
  res: VercelResponse
) {
  // Always set JSON content type first to ensure all responses are JSON
  res.setHeader('Content-Type', 'application/json')
  setCorsHeaders(res, req.headers.origin)
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // Require authentication and admin role
    await requireAuth(req)
    requireAdmin(req)

    // Get tenantId from params (Express) or query (Vercel)
    const tenantId = (req.params?.tenantId || req.query?.tenantId) as string
    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant ID is required'
      })
    }

    // Verify tenant matches authenticated user's tenant (unless super admin)
    if (req.role !== 'sysadmin' && req.role !== 'super_admin' && req.tenantId !== tenantId) { // Backward compatibility
      return res.status(403).json({
        error: 'Access denied to this tenant'
      })
    }

    if (req.method === 'GET') {
      // List coaches for tenant
      let sql
      try {
        const databaseUrl = getDatabaseUrl()
        sql = getPostgresClient(databaseUrl)
      } catch (dbError) {
        logger.error('Database connection failed', dbError)
        return res.status(500).json({
          error: 'Database connection failed',
          message: dbError instanceof Error ? dbError.message : 'Unknown database error'
        })
      }
      
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
    } else if (req.method === 'POST') {
      // Create coach
      const body = createCoachSchema.parse(req.body)
      
      let sql
      try {
        const databaseUrl = getDatabaseUrl()
        sql = getPostgresClient(databaseUrl)
      } catch (dbError) {
        logger.error('Database connection failed', dbError)
        return res.status(500).json({
          error: 'Database connection failed',
          message: dbError instanceof Error ? dbError.message : 'Unknown database error'
        })
      }
      
      // Check if username already exists for this tenant (case-insensitive)
      // Normalize username to lowercase for comparison, but store with proper capitalization
      const normalizedUsername = body.username.toLowerCase().trim()
      
      const existingUsername = await sql`
        SELECT id
        FROM clubs
        WHERE LOWER(username) = LOWER(${normalizedUsername})
          AND tenant_id = ${tenantId}
      `
      
      if (existingUsername.length > 0) {
        return res.status(400).json({
          error: 'Username already exists for this tenant'
        })
      }
      
      // Check if email already exists for this tenant
      const existingEmail = await sql`
        SELECT id
        FROM clubs
        WHERE email = ${body.email}
          AND tenant_id = ${tenantId}
      `
      
      if (existingEmail.length > 0) {
        return res.status(400).json({
          error: 'Email already exists for this tenant'
        })
      }
      
      // Generate or use provided PIN
      const pin = body.pin || generateRandomPIN()
      
      // Validate PIN format
      const pinValidation = validatePIN(pin)
      if (!pinValidation.isValid) {
        return res.status(400).json({
          error: 'Invalid PIN format',
          details: pinValidation.errors
        })
      }
      
      // Hash PIN
      const pinHash = await hashPIN(pin)
      
      // Capitalize first letter of username for storage (display consistency)
      // Login still works because we use LOWER() in queries
      const capitalizedUsername = normalizedUsername.charAt(0).toUpperCase() + normalizedUsername.slice(1)
      
      // Create coach (store username with proper capitalization)
      const [coach] = await sql`
        INSERT INTO clubs (
          tenant_id,
          email,
          username,
          pin_hash,
          role,
          email_verified
        )
        VALUES (
          ${tenantId},
          ${body.email},
          ${capitalizedUsername},
          ${pinHash},
          'coach',
          true
        )
        RETURNING id, email, username, tenant_id, role
      `
      
      // Send welcome email if requested
      if (body.sendEmail) {
        try {
          await sendCoachWelcomeEmail(coach.email, pin, tenantId, coach.username)
        } catch (emailError) {
          logger.error('Failed to send welcome email', emailError)
          // Don't fail the request if email fails
        }
      }
      
      return res.status(201).json({
        success: true,
        coach: {
          id: coach.id,
          email: coach.email,
          username: coach.username,
          tenantId: coach.tenant_id,
          role: coach.role,
          pin: body.sendEmail ? undefined : pin // Only return PIN if not sent via email
        },
        message: `Coach created successfully${body.sendEmail ? '. Welcome email sent.' : ''}`
      })
    } else {
      return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    // Ensure Content-Type is set even in error cases
    res.setHeader('Content-Type', 'application/json')
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return res.status(401).json({ error: error.message })
    }

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return res.status(403).json({ error: error.message })
    }

    if (error instanceof Error && error.message.includes('DATABASE_URL')) {
      return res.status(500).json({
        error: 'Database configuration error',
        message: error.message
      })
    }

    logger.error('Coach management error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Coach management failed',
      ...(process.env.NODE_ENV === 'development' && {
        stack: error instanceof Error ? error.stack : undefined
      })
    })
  }
}

