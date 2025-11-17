import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { generatePINResetToken, isPINResetTokenExpired, hashPIN, validatePIN } from '../../src/lib/auth/pin'
import { sendPINResetEmail } from '../../src/lib/auth/email'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

const requestResetSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(1, 'Username is required'),
  tenantId: z.string().min(1, 'Tenant ID is required')
})

const resetPINSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  pin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits'),
  tenantId: z.string().min(1, 'Tenant ID is required')
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
    const sql = getPostgresClient(getDatabaseUrl())
    const { action } = req.query

    if (action === 'request') {
      // Request PIN reset
      const body = requestResetSchema.parse(req.body)

      // Find coach by email, username, and tenant (case-insensitive username)
      const coaches = await sql`
        SELECT id, email, username
        FROM clubs
        WHERE email = ${body.email}
          AND LOWER(username) = LOWER(${body.username})
          AND tenant_id = ${body.tenantId}
          AND role = 'coach'
      `

      if (coaches.length === 0) {
        // Don't reveal if user exists or not (security best practice)
        return res.status(200).json({
          success: true,
          message: 'If a matching account exists, a PIN reset email has been sent.'
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
        await sendPINResetEmail(coach.email, resetToken, body.tenantId, coach.username)
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
        message: 'If a matching account exists, a PIN reset email has been sent.'
      })
    } else if (action === 'reset') {
      // Reset PIN with token
      const body = resetPINSchema.parse(req.body)

      // Validate PIN format
      const pinValidation = validatePIN(body.pin)
      if (!pinValidation.isValid) {
        return res.status(400).json({
          error: 'Invalid PIN format',
          details: pinValidation.errors
        })
      }

      // Find coach by reset token
      const coaches = await sql`
        SELECT id, email, pin_reset_token, pin_reset_expires
        FROM clubs
        WHERE pin_reset_token = ${body.token}
          AND tenant_id = ${body.tenantId}
          AND role = 'coach'
      `

      if (coaches.length === 0) {
        return res.status(400).json({
          error: 'Invalid or expired reset token'
        })
      }

      const coach = coaches[0]

      // Check if token is expired
      if (!coach.pin_reset_expires || isPINResetTokenExpired(coach.pin_reset_expires)) {
        return res.status(400).json({
          error: 'Reset token has expired'
        })
      }

      // Hash new PIN
      const pinHash = await hashPIN(body.pin)

      // Update PIN and clear reset token
      await sql`
        UPDATE clubs
        SET pin_hash = ${pinHash},
            pin_reset_token = NULL,
            pin_reset_expires = NULL
        WHERE id = ${coach.id}
      `

      return res.status(200).json({
        success: true,
        message: 'PIN has been reset successfully'
      })
    } else {
      return res.status(400).json({
        error: 'Invalid action. Use ?action=request or ?action=reset'
      })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    logger.error('PIN reset error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'PIN reset failed'
    })
  }
}

