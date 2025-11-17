import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'

// Support both email/password (admins) and username/PIN (coaches)
const loginSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  // Email/password login (for admins)
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(1, 'Password is required').optional(),
  // Username/PIN login (for coaches)
  username: z.string().min(1, 'Username is required').optional(),
  pin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits').optional(),
  // 2FA
  totpCode: z.string().optional()
}).refine(
  (data) => (data.email && data.password) || (data.username && data.pin),
  {
    message: 'Either email/password or username/PIN must be provided',
    path: ['email']
  }
)

// Helper to safely import modules with fallback
async function safeImport(modulePath: string): Promise<Record<string, any> | null> {
  try {
    const module = await import(modulePath)
    return (module.default || module) as Record<string, any>
  } catch (error) {
    console.error(`[ERROR] Failed to import ${modulePath}:`, error)
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always set JSON content type first - before any other operations
  try {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  } catch (headerError) {
    // If setting headers fails, we're in deep trouble - but try to continue
    console.error('[ERROR] Failed to set headers:', headerError)
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Dynamically import all modules to handle failures gracefully
    const [
      dbHelperModule,
      verifyPasswordModule,
      verifyPINModule,
      jwtModule,
      rateLimitModule,
      totpModule,
      loggerModule,
      corsModule
    ] = await Promise.all([
      safeImport('./db-helper.js'),
      safeImport('../../src/lib/auth/password'),
      safeImport('../../src/lib/auth/pin'),
      safeImport('../../src/lib/auth/jwt'),
      safeImport('../../src/lib/auth/rateLimit'),
      safeImport('../../src/lib/auth/totp'),
      safeImport('../../src/lib/utils/logger'),
      safeImport('../../src/lib/utils/cors')
    ])

    // Extract db-helper functions
    const getPostgresClient = dbHelperModule?.getPostgresClient as ((connectionString: string) => any) | null
    const getDatabaseUrl = dbHelperModule?.getDatabaseUrl as (() => string) | null

    // Extract functions with fallbacks
    const verifyPassword = verifyPasswordModule?.verifyPassword as ((password: string, hash: string) => Promise<boolean>) | null
    const verifyPIN = verifyPINModule?.verifyPIN as ((pin: string, hash: string) => Promise<boolean>) | null
    const generateAccessToken = jwtModule?.generateAccessToken as ((clubId: string, tenantId: string, role: string, email: string) => string) | null
    const generateRefreshToken = jwtModule?.generateRefreshToken as (() => Promise<string>) | null
    const hashRefreshToken = jwtModule?.hashRefreshToken as ((token: string) => Promise<string>) | null
    const checkLoginAttempts = rateLimitModule?.checkLoginAttempts as ((sql: any, identifier: string, ip: string) => Promise<{ allowed: boolean; lockoutUntil?: Date }>) | null
    const recordLoginAttempt = rateLimitModule?.recordLoginAttempt as ((sql: any, clubId: string | null, identifier: string, ip: string, success: boolean) => Promise<void>) | null
    const verifyTOTP = totpModule?.verifyTOTP as ((secret: string, code: string) => boolean) | null
    const logger = (loggerModule || { error: (msg: string, err?: unknown) => console.error(`[ERROR] ${msg}`, err) }) as { error: (msg: string, err?: unknown) => void }
    const setCorsHeaders = (corsModule?.setCorsHeaders || ((res: any, origin?: string) => {
      res.setHeader('Access-Control-Allow-Origin', origin || '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    })) as (res: any, origin?: string) => void

    // Set CORS headers using dynamic import
    setCorsHeaders(res, req.headers.origin)

    // Validate required modules
    if (!getPostgresClient || !getDatabaseUrl || !verifyPassword || !generateAccessToken || !generateRefreshToken || !hashRefreshToken || !checkLoginAttempts || !recordLoginAttempt) {
      logger.error('Critical modules failed to load', {
        getPostgresClient: !!getPostgresClient,
        getDatabaseUrl: !!getDatabaseUrl,
        verifyPassword: !!verifyPassword,
        generateAccessToken: !!generateAccessToken,
        verifyPIN: !!verifyPIN
      })
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Required authentication modules failed to load. Please contact support.'
      })
    }

    // Parse body safely with proper error handling
    let body
    try {
      body = loginSchema.parse(req.body)
    } catch (parseError) {
      if (parseError instanceof z.ZodError) {
        logger.error('Login validation error', parseError.errors)
        return res.status(400).json({
          error: 'Validation error',
          details: parseError.errors
        })
      }
      logger.error('Login parse error', parseError)
      return res.status(400).json({
        error: 'Invalid request body'
      })
    }

    // Safely get IP address - handle both Express and Vercel formats
    const forwardedFor = req.headers?.['x-forwarded-for'] as string | undefined
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || 'unknown'

    // Get database connection safely
    let sql
    try {
      const databaseUrl = getDatabaseUrl()
      if (!databaseUrl) {
        return res.status(500).json({
          error: 'Database configuration error'
        })
      }
      sql = getPostgresClient(databaseUrl)
    } catch (dbError) {
      logger.error('Database connection failed', dbError)
      return res.status(500).json({
        error: 'Database connection failed',
        message: dbError instanceof Error ? dbError.message : 'Unknown database error'
      })
    }

    // Determine login method
    const isPINLogin = !!(body.username && body.pin)
    const isEmailLogin = !!(body.email && body.password)
    
    // Check if PIN login is requested but PIN module not available
    if (isPINLogin && !verifyPIN) {
      logger.error('PIN login requested but PIN module not available')
      return res.status(400).json({
        error: 'PIN login not available',
        message: 'PIN authentication module is not loaded. Please use email/password login or contact support.'
      })
    }

    // Check rate limiting (use email or username as identifier)
    const rateLimitIdentifier = body.email || body.username || ''
    const rateLimit = await checkLoginAttempts(sql, rateLimitIdentifier, ipAddress)
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many login attempts',
        lockoutUntil: rateLimit.lockoutUntil
      })
    }

    // Find club based on login method
    let clubs
    if (isPINLogin) {
      // PIN login: find by username and tenant_id (case-insensitive)
      // Normalize username to lowercase for matching (username is stored in lowercase)
      const normalizedUsername = body.username!.toLowerCase().trim()
      
      clubs = await sql`
        SELECT id, email, username, pin_hash, tenant_id, role, email_verified, two_factor_enabled, two_factor_secret
        FROM clubs
        WHERE LOWER(username) = LOWER(${normalizedUsername})
          AND tenant_id = ${body.tenantId}
          AND role = 'coach'
      `
    } else if (isEmailLogin) {
      // Email/password login: find by email and tenant_id (admins)
      clubs = await sql`
        SELECT id, email, username, password_hash, tenant_id, role, email_verified, two_factor_enabled, two_factor_secret
        FROM clubs
        WHERE email = ${body.email}
          AND tenant_id = ${body.tenantId}
          AND role IN ('admin', 'super_admin')
      `
    } else {
      return res.status(400).json({
        error: 'Invalid login credentials',
        message: 'Either email/password or username/PIN must be provided'
      })
    }

    if (clubs.length === 0) {
      await recordLoginAttempt(sql, null, rateLimitIdentifier, ipAddress, false)
      return res.status(401).json({
        error: isPINLogin ? 'Invalid username or PIN' : 'Invalid email or password'
      })
    }

    const club = clubs[0]

    // Verify credentials based on login method
    let credentialsValid = false
    if (isPINLogin && verifyPIN) {
      if (!club.pin_hash) {
        logger.error('PIN login attempted but no PIN hash found', { clubId: club.id, username: club.username })
        await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, false)
        return res.status(401).json({
          error: 'PIN not set for this user'
        })
      }
      
      try {
        credentialsValid = await verifyPIN(body.pin!, club.pin_hash)
      } catch (pinError) {
        logger.error('PIN verification failed', pinError)
        await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, false)
        return res.status(500).json({
          error: 'PIN verification failed',
          message: 'An error occurred while verifying PIN. Please try again.'
        })
      }
    } else if (isEmailLogin) {
      if (!club.password_hash) {
        await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, false)
        return res.status(401).json({
          error: 'Password not set for this user'
        })
      }
      try {
        credentialsValid = await verifyPassword(body.password!, club.password_hash)
      } catch (passwordError) {
        logger.error('Password verification failed', passwordError)
        await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, false)
        return res.status(500).json({
          error: 'Password verification failed',
          message: 'An error occurred while verifying password. Please try again.'
        })
      }
    } else {
      await recordLoginAttempt(sql, null, rateLimitIdentifier, ipAddress, false)
      return res.status(400).json({
        error: 'Invalid login method',
        message: verifyPIN ? 'Either email/password or username/PIN required' : 'Email/password login required'
      })
    }

    if (!credentialsValid) {
      await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, false)
      return res.status(401).json({
        error: isPINLogin ? 'Invalid username or PIN' : 'Invalid email or password'
      })
    }

    // Check email verification (only required for email/password login, not PIN)
    if (isEmailLogin && !club.email_verified) {
      return res.status(403).json({
        error: 'Email not verified. Please check your email for verification link.'
      })
    }

    // Check 2FA
    if (club.two_factor_enabled) {
      if (!body.totpCode) {
        return res.status(200).json({
          requires2FA: true,
          message: 'Two-factor authentication required'
        })
      }

      if (!club.two_factor_secret) {
        return res.status(500).json({
          error: '2FA enabled but secret not found'
        })
      }

      if (!verifyTOTP) {
        logger.error('2FA verification requested but TOTP module not available')
        return res.status(500).json({
          error: '2FA verification not available',
          message: 'Two-factor authentication module is not loaded. Please contact support.'
        })
      }

      const totpValid = verifyTOTP(club.two_factor_secret, body.totpCode)
      if (!totpValid) {
        await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, false)
        return res.status(401).json({
          error: 'Invalid 2FA code'
        })
      }
    }

    // Generate tokens (include role and email)
    // Ensure we have required fields
    if (!club.role || !club.email) {
      logger.error('Missing required fields for token generation', { club })
      return res.status(500).json({
        error: 'User data incomplete',
        message: 'Missing role or email'
      })
    }
    
    const accessToken = generateAccessToken(club.id, club.tenant_id, club.role, club.email)
    const refreshToken = await generateRefreshToken()
    const refreshTokenHash = await hashRefreshToken(refreshToken)

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    await sql`
      INSERT INTO club_sessions (club_id, token_hash, expires_at)
      VALUES (${club.id}, ${refreshTokenHash}, ${expiresAt})
    `

    // Update last login
    await sql`
      UPDATE clubs
      SET last_login = NOW()
      WHERE id = ${club.id}
    `

    // Record successful login
    await recordLoginAttempt(sql, club.id, rateLimitIdentifier, ipAddress, true)

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      club: {
        id: club.id,
        email: club.email,
        username: club.username,
        role: club.role,
        tenantId: club.tenant_id,
        emailVerified: club.email_verified,
        twoFactorEnabled: club.two_factor_enabled
      }
    })
  } catch (outerError) {
    // Handle all errors - validation, database, PIN verification, etc.
    if (outerError instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: outerError.errors
      })
    }

    // Log error but don't expose internal details
    try {
      console.error('[ERROR] Login handler error:', outerError)
      if (outerError instanceof Error) {
        console.error('[ERROR] Error message:', outerError.message)
        console.error('[ERROR] Error stack:', outerError.stack)
      }
    } catch {
      // If even console.error fails, we're in deep trouble
    }
    
    // Always return JSON, never HTML - even for import/runtime errors
    try {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')
      return res.status(500).json({
        error: 'Login failed',
        message: outerError instanceof Error ? outerError.message : 'An unexpected error occurred'
      })
    } catch {
      // If even setting headers fails, return minimal JSON
      // This should never happen, but if it does, we've done our best
      return res.status(500).json({ error: 'Server error' })
    }
  }
}
