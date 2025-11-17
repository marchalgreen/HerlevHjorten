import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateTOTPSecret, generateQRCode } from '../../src/lib/auth/totp'
import { getPostgresClient, getDatabaseUrl } from './db-helper'
import { verifyAccessToken } from '../../src/lib/auth/jwt'
import { logger } from '../../src/lib/utils/logger'
import { setCorsHeaders } from '../../src/lib/utils/cors'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Require authentication
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const token = authHeader.substring(7)
    const payload = verifyAccessToken(token)
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    const sql = getPostgresClient(getDatabaseUrl())

    // Get club
    const clubs = await sql`
      SELECT id, email, two_factor_enabled
      FROM clubs
      WHERE id = ${payload.clubId}
        AND tenant_id = ${payload.tenantId}
    `

    if (clubs.length === 0) {
      return res.status(404).json({ error: 'Club not found' })
    }

    const club = clubs[0]

    if (club.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' })
    }

    // Generate TOTP secret
    const secret = generateTOTPSecret()
    const secretBase32 = secret.base32

    // Generate QR code
    const qrCodeDataUrl = await generateQRCode(secretBase32, club.email)

    // Store secret (not enabled yet - will be enabled after verification)
    await sql`
      UPDATE clubs
      SET two_factor_secret = ${secretBase32}
      WHERE id = ${club.id}
    `

    return res.status(200).json({
      success: true,
      secret: secretBase32,
      qrCode: qrCodeDataUrl,
      manualEntryKey: secretBase32
    })
  } catch (error) {
    logger.error('2FA setup error', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : '2FA setup failed'
    })
  }
}

