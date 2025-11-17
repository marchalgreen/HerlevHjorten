import type { VercelRequest } from '@vercel/node'
import { verifyAccessToken } from './jwt'
import { getPostgresClient, getDatabaseUrl } from '../../../api/auth/db-helper'
import { UserRole, isSuperAdmin, isAdmin, isCoach } from './roles'

export interface AuthenticatedRequest extends VercelRequest {
  clubId?: string
  tenantId?: string
  role?: string
  email?: string
  club?: {
    id: string
    email: string
    tenantId: string
    role: string
    emailVerified: boolean
    twoFactorEnabled: boolean
  }
}

/**
 * Extract JWT token from Authorization header
 * @param req - Request object
 * @returns Token string or null
 */
function extractToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

/**
 * Require authentication middleware
 * Validates JWT token and attaches club info to request
 * @param req - Request object
 * @throws Error if not authenticated
 */
export async function requireAuth(req: AuthenticatedRequest): Promise<void> {
  const token = extractToken(req)
  if (!token) {
    throw new Error('Authentication required')
  }

  const payload = verifyAccessToken(token)
  if (!payload) {
    throw new Error('Invalid or expired token')
  }

  // Verify club exists and is active
  // Use direct database connection (server-side) instead of tenant-specific client
  const sql = getPostgresClient(getDatabaseUrl())

  const clubs = await sql`
    SELECT id, email, tenant_id, role, email_verified, two_factor_enabled
    FROM clubs
    WHERE id = ${payload.clubId}
      AND tenant_id = ${payload.tenantId}
  `

  if (clubs.length === 0) {
    throw new Error('Club not found')
  }

  const club = clubs[0]

  // Attach to request
  req.clubId = payload.clubId
  req.tenantId = payload.tenantId
  // Use database role if JWT role is missing or different (database is source of truth)
  req.role = club.role || payload.role
  req.email = payload.email
  req.club = {
    id: club.id,
    email: club.email,
    tenantId: club.tenant_id,
    role: club.role,
    emailVerified: club.email_verified,
    twoFactorEnabled: club.two_factor_enabled
  }
}

/**
 * Require club context (must be authenticated and match tenant)
 * @param req - Authenticated request
 * @param tenantId - Required tenant ID
 * @throws Error if tenant doesn't match
 */
export function requireClub(req: AuthenticatedRequest, tenantId: string): void {
  if (!req.clubId || !req.tenantId) {
    throw new Error('Authentication required')
  }
  if (req.tenantId !== tenantId) {
    throw new Error('Tenant mismatch')
  }
}

/**
 * Optional auth - doesn't throw, just attaches if token is valid
 * @param req - Request object
 */
export async function optionalAuth(req: AuthenticatedRequest): Promise<void> {
  try {
    await requireAuth(req)
  } catch {
    // Ignore errors - auth is optional
  }
}

/**
 * Require super admin role
 * @param req - Authenticated request
 * @throws Error if not super admin
 */
export function requireSuperAdmin(req: AuthenticatedRequest): void {
  if (!req.role || !isSuperAdmin(req.role)) {
    throw new Error('Super admin access required')
  }
}

/**
 * Require admin or super admin role
 * @param req - Authenticated request
 * @throws Error if not admin or super admin
 */
export function requireAdmin(req: AuthenticatedRequest): void {
  if (!req.role || !isAdmin(req.role)) {
    throw new Error('Admin access required')
  }
}

/**
 * Require coach role
 * @param req - Authenticated request
 * @throws Error if not coach
 */
export function requireCoach(req: AuthenticatedRequest): void {
  if (!req.role || !isCoach(req.role)) {
    throw new Error('Coach access required')
  }
}

