import jwt from 'jsonwebtoken'

function getJWTSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET || process.env.VITE_AUTH_JWT_SECRET
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET environment variable is required')
  }
  return secret
}

const JWT_SECRET = getJWTSecret()

export interface JWTPayload {
  clubId: string
  tenantId: string
  role: string
  email: string
  type: 'access' | 'refresh'
}

const ACCESS_TOKEN_EXPIRY = '15m'

/**
 * Generate an access token for a club
 * @param clubId - Club UUID
 * @param tenantId - Tenant ID
 * @param role - User role (coach, admin, super_admin)
 * @param email - User email
 * @returns JWT access token (15min expiry)
 */
export function generateAccessToken(
  clubId: string,
  tenantId: string,
  role: string,
  email: string
): string {
  const payload: JWTPayload = {
    clubId,
    tenantId,
    role,
    email,
    type: 'access'
  }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'herlev-hjorten-auth'
  })
}

// Browser-compatible random bytes generator
async function getRandomBytes(count: number): Promise<Uint8Array> {
  if (typeof window !== 'undefined') {
    // Browser: use Web Crypto API
    const array = new Uint8Array(count)
    crypto.getRandomValues(array)
    return array
  } else {
    // Node.js: use crypto module (dynamic import to avoid bundling)
    const cryptoModule = await import('node:crypto')
    return cryptoModule.randomBytes(count)
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generate a refresh token string (random, not JWT)
 * @returns Random token string
 */
export async function generateRefreshToken(): Promise<string> {
  const bytes = await getRandomBytes(32)
  return bytesToHex(bytes)
}

/**
 * Verify and decode an access token
 * @param token - JWT token to verify
 * @returns Decoded payload or null if invalid
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as JWTPayload
    if (decoded.type !== 'access') {
      return null
    }
    return decoded
  } catch {
    return null
  }
}

/**
 * Hash a refresh token for storage
 * @param token - Refresh token to hash
 * @returns Hashed token
 */
export async function hashRefreshToken(token: string): Promise<string> {
  if (typeof window !== 'undefined') {
    // Browser: this should only be called server-side
    throw new Error('hashRefreshToken can only be used server-side')
  }
  const cryptoModule = await import('node:crypto')
  return cryptoModule.createHash('sha256').update(token).digest('hex')
}

/**
 * Verify a refresh token against its hash
 * @param token - Plain refresh token
 * @param hash - Stored hash
 * @returns True if token matches hash
 */
export async function verifyRefreshTokenHash(token: string, hash: string): Promise<boolean> {
  const tokenHash = await hashRefreshToken(token)
  return tokenHash === hash
}

