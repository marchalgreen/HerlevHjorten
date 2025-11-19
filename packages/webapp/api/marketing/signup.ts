import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { hashPassword, validatePasswordStrength } from '../../src/lib/auth/password.js'
import { sendVerificationEmail } from '../../src/lib/auth/email.js'
import { getPostgresClient, getDatabaseUrl } from '../auth/db-helper.js'
import { randomBytes } from 'crypto'
import { logger } from '../../src/lib/utils/logger.js'
import { setCorsHeaders } from '../../src/lib/utils/cors.js'
import {
  nameToSubdomain,
  validateSubdomain,
  isSubdomainAvailable,
  createTenantConfig
} from '../../src/lib/admin/tenant-utils.js'
import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'marchalgreen@gmail.com'
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  clubName: z.string().min(2, 'Club name must be at least 2 characters'),
  planId: z.enum(['basic', 'professional']).optional(), // Enterprise handled separately
  billingPeriod: z.enum(['monthly', 'yearly']).default('yearly')
})

/**
 * Send notification email to admin when new tenant signs up
 */
async function sendAdminNotificationEmail(
  clubName: string,
  email: string,
  tenantId: string,
  planId: string,
  billingPeriod: 'monthly' | 'yearly'
): Promise<void> {
  if (!resend) {
    logger.warn('Resend not configured - skipping admin notification email')
    console.warn('⚠️  RESEND_API_KEY not set. Admin notification email will not be sent.')
    return
  }
  
  if (!ADMIN_NOTIFICATION_EMAIL) {
    logger.warn('ADMIN_NOTIFICATION_EMAIL not set - skipping admin notification email')
    console.warn('⚠️  ADMIN_NOTIFICATION_EMAIL not set. Admin notification email will not be sent.')
    return
  }

  const planNames: Record<string, { monthly: string; yearly: string }> = {
    basic: {
      monthly: 'Basispakke (250 kr/måned)',
      yearly: 'Basispakke (2700 kr/år - 225 kr/måned)'
    },
    professional: {
      monthly: 'Professionel (400 kr/måned)',
      yearly: 'Professionel (4320 kr/år - 360 kr/måned)'
    }
  }
  
  const planDisplay = planNames[planId]?.[billingPeriod] || `${planId} (${billingPeriod})`

  try {
    await resend.emails.send({
      from: 'Rundeklar <noreply@rundeklar.dk>',
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `🎉 Ny klub har oprettet prøveperiode: ${clubName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Ny klub har oprettet prøveperiode</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Klubnavn:</strong> ${clubName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Tenant ID:</strong> ${tenantId}</p>
            <p><strong>Pakke:</strong> ${planDisplay}</p>
            <p><strong>URL:</strong> https://${tenantId}.rundeklar.dk</p>
          </div>
          <p style="color: #666;">
            Husk at følge op på prøveperioden og sikre at klubben får den nødvendige support.
          </p>
        </div>
      `
    })
  } catch (error) {
    logger.error('Failed to send admin notification email', error)
    // Don't fail signup if notification email fails
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = signupSchema.parse(req.body)

    // Validate password strength
    const passwordValidation = validatePasswordStrength(body.password)
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      })
    }

    // Generate tenant ID from club name
    const tenantId = nameToSubdomain(body.clubName)

    // Validate subdomain
    const subdomainValidation = validateSubdomain(tenantId)
    if (!subdomainValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid club name',
        details: subdomainValidation.errors
      })
    }

    // Check if subdomain is available
    const available = await isSubdomainAvailable(tenantId)
    if (!available) {
      return res.status(409).json({
        error: `En klub med navnet "${body.clubName}" eksisterer allerede. Vælg venligst et andet navn.`
      })
    }

    const sql = getPostgresClient(getDatabaseUrl())

    // Check if email already exists
    const existingEmail = await sql`
      SELECT id FROM clubs WHERE email = ${body.email}
    `
    if (existingEmail.length > 0) {
      return res.status(409).json({
        error: 'En konto med denne email eksisterer allerede'
      })
    }

    // Create tenant config file
    const tenantConfig = await createTenantConfig({
      id: tenantId,
      name: body.clubName,
      subdomain: tenantId,
      logo: 'fulllogo_transparent_nobuffer_horizontal.png',
      maxCourts: 8
    })

    // Hash password
    const passwordHash = await hashPassword(body.password)

    // Generate email verification token
    const verificationToken = randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create club/admin user
    const [club] = await sql`
      INSERT INTO clubs (
        tenant_id,
        email,
        password_hash,
        email_verification_token,
        email_verification_expires,
        role,
        email_verified
      )
      VALUES (
        ${tenantId},
        ${body.email},
        ${passwordHash},
        ${verificationToken},
        ${verificationExpires},
        'admin',
        false
      )
      RETURNING id, email, tenant_id, email_verified
    `

    // Send verification email to user
    try {
      await sendVerificationEmail(body.email, verificationToken, tenantId)
      logger.info(`Verification email sent to ${body.email}`)
    } catch (emailError) {
      logger.error('Failed to send verification email', emailError)
      console.error('❌ Failed to send verification email:', emailError)
      // Don't fail signup if email fails
    }

    // Send notification email to admin
    try {
      await sendAdminNotificationEmail(
        body.clubName,
        body.email,
        tenantId,
        body.planId || 'basic',
        body.billingPeriod || 'monthly'
      )
      logger.info(`Admin notification email sent for new tenant: ${tenantId}`)
    } catch (notificationError) {
      logger.error('Failed to send admin notification email', notificationError)
      console.error('❌ Failed to send admin notification email:', notificationError)
      // Don't fail signup if notification email fails
    }

    return res.status(201).json({
      success: true,
      message: 'Registrering gennemført! Tjek din email for at verificere din konto.',
      club: {
        id: club.id,
        email: club.email,
        tenantId: club.tenant_id,
        emailVerified: club.email_verified
      },
      tenant: {
        id: tenantConfig.id,
        name: tenantConfig.name,
        subdomain: tenantConfig.subdomain
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    logger.error('Signup error', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Log detailed error for debugging
    console.error('Signup error details:', {
      message: errorMessage,
      stack: errorStack,
      body: req.body
    })
    
    return res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
    })
  }
}

