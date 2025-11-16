import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { hashRefreshToken } from '../../src/lib/auth/jwt'
import { getPostgresClient, getDatabaseUrl } from './db-helper'

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = logoutSchema.parse(req.body)

    const sql = getPostgresClient(getDatabaseUrl())
    const tokenHash = await hashRefreshToken(body.refreshToken)

    // Delete session
    await sql`
      DELETE FROM club_sessions
      WHERE token_hash = ${tokenHash}
    `

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    console.error('Logout error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Logout failed'
    })
  }
}

