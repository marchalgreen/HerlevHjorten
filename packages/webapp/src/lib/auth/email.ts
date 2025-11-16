import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || 'Herlev Hjorten'
const APP_URL = process.env.APP_URL || process.env.VITE_APP_URL || 'http://localhost:5173'

if (!RESEND_API_KEY) {
  console.warn('RESEND_API_KEY not set - email functionality will be disabled')
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

/**
 * Send email verification email
 * @param email - Recipient email
 * @param token - Verification token
 * @param tenantId - Tenant ID for URL building
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  tenantId: string
): Promise<void> {
  if (!resend) {
    console.warn('Resend not configured - skipping email verification')
    return
  }

  const verifyUrl = `${APP_URL}/#/${tenantId}/verify-email?token=${token}`

  await resend.emails.send({
    from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
    to: email,
    subject: 'Verify your email address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Verify your email address</h1>
        <p>Thank you for registering with ${RESEND_FROM_NAME}!</p>
        <p>Please click the link below to verify your email address:</p>
        <p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            Verify Email
          </a>
        </p>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `
  })
}

/**
 * Send password reset email
 * @param email - Recipient email
 * @param token - Reset token
 * @param tenantId - Tenant ID for URL building
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  tenantId: string
): Promise<void> {
  if (!resend) {
    console.warn('Resend not configured - skipping password reset email')
    return
  }

  const resetUrl = `${APP_URL}/#/${tenantId}/reset-password?token=${token}`

  await resend.emails.send({
    from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
    to: email,
    subject: 'Reset your password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Reset your password</h1>
        <p>You requested to reset your password for ${RESEND_FROM_NAME}.</p>
        <p>Click the link below to reset your password:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            Reset Password
          </a>
        </p>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `
  })
}

/**
 * Send 2FA setup email
 * @param email - Recipient email
 * @param tenantId - Tenant ID
 */
export async function send2FASetupEmail(
  email: string,
  _tenantId: string
): Promise<void> {
  if (!resend) {
    console.warn('Resend not configured - skipping 2FA setup email')
    return
  }

  await resend.emails.send({
    from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
    to: email,
    subject: 'Two-factor authentication enabled',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Two-factor authentication enabled</h1>
        <p>Two-factor authentication has been successfully enabled for your ${RESEND_FROM_NAME} account.</p>
        <p>From now on, you'll need to enter a verification code from your authenticator app when logging in.</p>
        <p>If you didn't enable two-factor authentication, please contact support immediately.</p>
      </div>
    `
  })
}

/**
 * Send PIN reset email
 * @param email - Recipient email
 * @param token - Reset token
 * @param tenantId - Tenant ID for URL building
 * @param username - Coach username
 */
export async function sendPINResetEmail(
  email: string,
  token: string,
  tenantId: string,
  username: string
): Promise<void> {
  if (!resend) {
    console.warn('Resend not configured - skipping PIN reset email')
    return
  }

  // Build reset URL based on tenant subdomain
  const subdomain = tenantId === 'herlev-hjorten' ? '' : `${tenantId}.`
  const resetUrl = `${APP_URL}/#/${tenantId}/reset-pin?token=${token}`

  await resend.emails.send({
    from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
    to: email,
    subject: 'Reset your PIN',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Reset your PIN</h1>
        <p>Hej ${username},</p>
        <p>Du har anmodet om at nulstille din PIN for ${RESEND_FROM_NAME}.</p>
        <p>Klik på linket nedenfor for at nulstille din PIN:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            Nulstil PIN
          </a>
        </p>
        <p>Eller kopier og indsæt denne URL i din browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p>Dette link udløber om 1 time.</p>
        <p>Hvis du ikke har anmodet om en PIN-nulstilling, kan du ignorere denne email.</p>
      </div>
    `
  })
}

