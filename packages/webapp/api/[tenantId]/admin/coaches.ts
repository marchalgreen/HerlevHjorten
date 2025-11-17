import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../../../src/lib/auth/middleware'
import { hashPIN, generateRandomPIN, validatePIN } from '../../../src/lib/auth/pin'
import { sendCoachWelcomeEmail } from '../../../src/lib/auth/email'
import { getPostgresClient, getDatabaseUrl } from '../../auth/db-helper'
import { logger } from '../../../src/lib/utils/logger'
import { setCorsHeaders } from '../../../src/lib/utils/cors'

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
    if (req.role !== 'super_admin' && req.tenantId !== tenantId) {
      return res.status(403).json({
        error: 'Access denied to this tenant'
      })
    }

    if (req.method === 'GET') {
      // List coaches for tenant
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
        coaches: coaches.map((coach: { id: string; email: string; username: string; role: string; email_verified: boolean; created_at: Date; last_login: Date | null }) => ({
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
      
      const sql = getPostgresClient(getDatabaseUrl())
      
      // Check if username already exists for this tenant (case-insensitive)
      // Normalize username to lowercase for storage
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
      
      // Create coach (store username in lowercase)
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
          ${normalizedUsername},
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

    logger.error('Coach management error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Coach management failed',
      ...(process.env.NODE_ENV === 'development' && {
        stack: error instanceof Error ? error.stack : undefined
      })
    })
  }
}

