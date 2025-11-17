import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../../../../src/lib/auth/middleware'
import { hashPIN, validatePIN, generatePINResetToken } from '../../../../src/lib/auth/pin'
import { sendPINResetEmail } from '../../../../src/lib/auth/email'
import { getPostgresClient, getDatabaseUrl } from '../../../auth/db-helper'
import { logger } from '../../../../src/lib/utils/logger'
import { setCorsHeaders } from '../../../../src/lib/utils/cors'

const updateCoachSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(50).optional(),
  pin: z.string().min(6).max(6).optional(),
  active: z.boolean().optional()
})

export default async function handler(
  req: AuthenticatedRequest & { query?: { tenantId?: string; id?: string }, params?: { tenantId?: string; id?: string } },
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

    // Get tenantId and coachId from params (Express) or query (Vercel)
    const tenantId = (req.params?.tenantId || req.query?.tenantId) as string
    const coachId = (req.params?.id || req.query?.id) as string
    
    if (!tenantId || !coachId) {
      return res.status(400).json({
        error: 'Tenant ID and Coach ID are required'
      })
    }

    // Verify tenant matches authenticated user's tenant (unless super admin)
    if (req.role !== 'super_admin' && req.tenantId !== tenantId) {
      return res.status(403).json({
        error: 'Access denied to this tenant'
      })
    }

    const sql = getPostgresClient(getDatabaseUrl())

    if (req.method === 'GET') {
      // Get coach details
      const coaches = await sql`
        SELECT id, email, username, role, email_verified, created_at, last_login
        FROM clubs
        WHERE id = ${coachId}
          AND tenant_id = ${tenantId}
          AND role = 'coach'
      `

      if (coaches.length === 0) {
        return res.status(404).json({
          error: 'Coach not found'
        })
      }

      const coach = coaches[0]
      return res.status(200).json({
        success: true,
        coach: {
          id: coach.id,
          email: coach.email,
          username: coach.username,
          role: coach.role,
          emailVerified: coach.email_verified,
          createdAt: coach.created_at,
          lastLogin: coach.last_login
        }
      })
    } else if (req.method === 'PUT') {
      // Update coach
      const body = updateCoachSchema.parse(req.body)

      // Verify coach exists and belongs to tenant
      const existing = await sql`
        SELECT id, email, username
        FROM clubs
        WHERE id = ${coachId}
          AND tenant_id = ${tenantId}
          AND role = 'coach'
      `

      if (existing.length === 0) {
        return res.status(404).json({
          error: 'Coach not found'
        })
      }

      // Check username uniqueness if updating username (case-insensitive)
      let normalizedUsername: string | undefined
      if (body.username) {
        normalizedUsername = body.username.toLowerCase().trim()
        // Compare case-insensitively with existing username
        if (normalizedUsername !== existing[0].username?.toLowerCase()) {
          const usernameCheck = await sql`
            SELECT id
            FROM clubs
            WHERE LOWER(username) = LOWER(${normalizedUsername})
              AND tenant_id = ${tenantId}
              AND id != ${coachId}
          `

          if (usernameCheck.length > 0) {
            return res.status(400).json({
              error: 'Username already exists for this tenant'
            })
          }
        }
      }

      // Check email uniqueness if updating email
      if (body.email && body.email !== existing[0].email) {
        const emailCheck = await sql`
          SELECT id
          FROM clubs
          WHERE email = ${body.email}
            AND tenant_id = ${tenantId}
            AND id != ${coachId}
        `

        if (emailCheck.length > 0) {
          return res.status(400).json({
            error: 'Email already exists for this tenant'
          })
        }
      }

      // Hash PIN if provided
      let pinHash: string | undefined = undefined
      if (body.pin) {
        const pinValidation = validatePIN(body.pin)
        if (!pinValidation.isValid) {
          return res.status(400).json({
            error: 'Invalid PIN format',
            details: pinValidation.errors
          })
        }
        pinHash = await hashPIN(body.pin)
      }

      // Build update query with whitelisted columns (security: prevent SQL injection)
      // Only these columns are allowed to be updated
      const allowedColumns = ['email', 'username', 'pin_hash'] as const
      const updates: string[] = []
      const values: (string | null)[] = []
      let paramIndex = 1

      if (body.email) {
        updates.push(`email = $${paramIndex++}`)
        values.push(body.email)
      }
      if (body.username) {
        // Store username in lowercase
        updates.push(`username = $${paramIndex++}`)
        values.push(normalizedUsername ?? null)
      }
      if (pinHash) {
        updates.push(`pin_hash = $${paramIndex++}`)
        values.push(pinHash)
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'No fields to update'
        })
      }

      // Security: Verify all update columns are in whitelist
      // This prevents SQL injection even if updates array is somehow compromised
      const updateColumns = updates.map(u => u.split('=')[0].trim())
      const invalidColumns = updateColumns.filter(col => !allowedColumns.includes(col as typeof allowedColumns[number]))
      if (invalidColumns.length > 0) {
        return res.status(400).json({
          error: `Invalid columns: ${invalidColumns.join(', ')}`
        })
      }

      values.push(coachId, tenantId)

      // Safe to use sql.unsafe here because:
      // 1. Column names are whitelisted and validated above
      // 2. All values are parameterized ($1, $2, etc.)
      // 3. Tenant ID and coach ID are validated before this point
      await sql.unsafe(`
        UPDATE clubs
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex++}
          AND tenant_id = $${paramIndex++}
          AND role = 'coach'
      `, values)

      // Get updated coach
      const [updated] = await sql`
        SELECT id, email, username, role
        FROM clubs
        WHERE id = ${coachId}
      `

      return res.status(200).json({
        success: true,
        coach: {
          id: updated.id,
          email: updated.email,
          username: updated.username,
          role: updated.role
        }
      })
    } else if (req.method === 'DELETE') {
      // Delete coach
      const result = await sql`
        DELETE FROM clubs
        WHERE id = ${coachId}
          AND tenant_id = ${tenantId}
          AND role = 'coach'
      `

      if (result.count === 0) {
        return res.status(404).json({
          error: 'Coach not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Coach deleted successfully'
      })
    } else if (req.method === 'POST') {
      // PIN reset action
      const { action } = req.body

      if (action === 'reset-pin') {
        // Reset coach PIN and send email
        const coaches = await sql`
          SELECT id, email, username
          FROM clubs
          WHERE id = ${coachId}
            AND tenant_id = ${tenantId}
            AND role = 'coach'
        `

        if (coaches.length === 0) {
          return res.status(404).json({
            error: 'Coach not found'
          })
        }

        const coach = coaches[0]

        // Generate reset token
        const resetToken = await generatePINResetToken()
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

        // Store reset token
        await sql`
          UPDATE clubs
          SET pin_reset_token = ${resetToken},
              pin_reset_expires = ${expiresAt}
          WHERE id = ${coach.id}
        `

        // Send reset email
        try {
          await sendPINResetEmail(coach.email, resetToken, tenantId, coach.username)
          logger.info(`PIN reset email sent successfully to ${coach.email}`)
        } catch (emailError) {
          logger.error('Failed to send PIN reset email', emailError)
          // Still return success to user (security best practice), but log the error
          return res.status(500).json({
            error: 'Failed to send PIN reset email',
            message: emailError instanceof Error ? emailError.message : 'Unknown error',
            ...(process.env.NODE_ENV === 'development' && {
              details: emailError instanceof Error ? emailError.stack : undefined
            })
          })
        }

        return res.status(200).json({
          success: true,
          message: 'PIN reset email sent successfully'
        })
      } else {
        return res.status(400).json({
          error: 'Invalid action'
        })
      }
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
      error: error instanceof Error ? error.message : 'Coach management failed'
    })
  }
}

