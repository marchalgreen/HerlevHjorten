import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required')
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
    const body = verifyEmailSchema.parse(req.body)

    const sql = getPostgresClient(getDatabaseUrl())

    // Find club with this token
    const clubs = await sql`
      SELECT id, email_verification_expires
      FROM clubs
      WHERE email_verification_token = ${body.token}
        AND email_verified = false
    `

    if (clubs.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired verification token'
      })
    }

    const club = clubs[0]

    // Check if token expired
    if (new Date(club.email_verification_expires) < new Date()) {
      return res.status(400).json({
        error: 'Verification token has expired'
      })
    }

    // Mark email as verified
    await sql`
      UPDATE clubs
      SET email_verified = true,
          email_verification_token = NULL,
          email_verification_expires = NULL
      WHERE id = ${club.id}
    `

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    logger.error('Email verification error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Email verification failed'
    })
  }
}

