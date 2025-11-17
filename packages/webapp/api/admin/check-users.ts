import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPostgresClient, getDatabaseUrl } from '../auth/db-helper'

/**
 * Admin endpoint to check users in database
 * WARNING: This exposes sensitive information - should be protected in production
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const sql = getPostgresClient(getDatabaseUrl())

    // Get all users with their roles
    const users = await sql`
      SELECT 
        id,
        email,
        username,
        role,
        tenant_id,
        email_verified,
        password_hash IS NOT NULL as has_password,
        pin_hash IS NOT NULL as has_pin,
        created_at,
        last_login
      FROM clubs
      ORDER BY created_at DESC
    `

    // Group by role
    type UserRow = typeof users[number]
    const byRole = {
      super_admin: [] as UserRow[],
      admin: [] as UserRow[],
      coach: [] as UserRow[],
      null: [] as UserRow[]
    }

    users.forEach(user => {
      const role = user.role || 'null'
      if (role in byRole) {
        byRole[role as keyof typeof byRole].push(user)
      } else {
        byRole.null.push(user)
      }
    })

    // Get tenants
    const tenants = await sql`
      SELECT DISTINCT tenant_id, COUNT(*) as user_count
      FROM clubs
      GROUP BY tenant_id
      ORDER BY tenant_id
    `

    return res.status(200).json({
      success: true,
      summary: {
        total: users.length,
        super_admin: byRole.super_admin.length,
        admin: byRole.admin.length,
        coach: byRole.coach.length,
        without_role: byRole.null.length
      },
      tenants: tenants.map(t => ({
        tenant_id: t.tenant_id,
        user_count: Number(t.user_count)
      })),
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        tenant_id: user.tenant_id,
        email_verified: user.email_verified,
        has_password: user.has_password,
        has_pin: user.has_pin,
        created_at: user.created_at,
        last_login: user.last_login
      })),
      byRole: {
        super_admin: byRole.super_admin.map(u => ({
          id: u.id,
          email: u.email,
          username: u.username,
          tenant_id: u.tenant_id,
          email_verified: u.email_verified,
          has_password: u.has_password,
          has_pin: u.has_pin
        })),
        admin: byRole.admin.map(u => ({
          id: u.id,
          email: u.email,
          username: u.username,
          tenant_id: u.tenant_id,
          email_verified: u.email_verified,
          has_password: u.has_password,
          has_pin: u.has_pin
        })),
        coach: byRole.coach.map(u => ({
          id: u.id,
          email: u.email,
          username: u.username,
          tenant_id: u.tenant_id,
          email_verified: u.email_verified,
          has_password: u.has_password,
          has_pin: u.has_pin
        })),
        without_role: byRole.null.map(u => ({
          id: u.id,
          email: u.email,
          username: u.username,
          tenant_id: u.tenant_id,
          email_verified: u.email_verified,
          has_password: u.has_password,
          has_pin: u.has_pin
        }))
      }
    })
  } catch (error) {
    console.error('Check users error:', error)
    return res.status(500).json({
      error: 'Failed to check users',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

