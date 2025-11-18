import { Resend } from 'resend'
import { logger } from '../utils/logger.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || 'Herlev Hjorten'
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'rundeklar.dk'
const APP_URL = process.env.APP_URL || process.env.VITE_APP_URL || 'http://localhost:5173'

if (!RESEND_API_KEY) {
  logger.warn('RESEND_API_KEY not set - email functionality will be disabled')
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

/**
 * Builds a tenant-specific subdomain URL
 * @param tenantId - Tenant ID (e.g., "herlev-hjorten", "demo")
 * @param path - Path to append (e.g., "/login", "/reset-pin?token=...")
 * @returns Full URL with subdomain (e.g., "https://herlev-hjorten.rundeklar.dk/login")
 */
function buildTenantUrl(tenantId: string, path: string): string {
  // For development/localhost, use APP_URL with hash routing
  if (APP_URL.includes('localhost') || APP_URL.includes('127.0.0.1')) {
    // Remove leading slash from path and ensure it starts with /#
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${APP_URL}/#/${tenantId}${cleanPath}`
  }

  // For production, build subdomain URL
  // tenantId is already the subdomain (e.g., "herlev-hjorten")
  // Always use https in production
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : (APP_URL.startsWith('https') ? 'https' : 'http')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${protocol}://${tenantId}.${BASE_DOMAIN}${cleanPath}`
}

/**
 * Generates HTML for PIN code displayed in 6 separate boxes
 * @param pin - 6-digit PIN code
 * @returns HTML string with styled PIN boxes
 */
function generatePINBoxes(pin: string): string {
  const digits = pin.split('')
  return digits
    .map(
      (digit) => `
      <td style="
        width: 56px;
        height: 64px;
        background-color: #ffffff;
        border: 2px solid #007bff;
        border-radius: 10px;
        text-align: center;
        vertical-align: middle;
        font-size: 32px;
        font-weight: 700;
        color: #007bff;
        font-family: 'Courier New', monospace;
        box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
        padding: 0;
      ">${digit}</td>
    `
    )
    .join('')
}

/**
 * Builds logo URL for emails
 * @param tenantId - Tenant ID (optional, defaults to main domain)
 * @returns Full URL to logo image
 */
function buildLogoUrl(tenantId?: string): string {
  // Use the horizontal logo with text for emails
  const logoFilename = 'fulllogo_transparent_nobuffer_horizontal.png'
  
  // For development/localhost
  if (APP_URL.includes('localhost') || APP_URL.includes('127.0.0.1')) {
    return `${APP_URL}/${logoFilename}`
  }

  // For production, use base domain (logo is same for all tenants)
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : (APP_URL.startsWith('https') ? 'https' : 'http')
  return `${protocol}://${BASE_DOMAIN}/${logoFilename}`
}

/**
 * Base email template wrapper with consistent styling
 * @param content - HTML content for the email body
 * @param tenantId - Optional tenant ID for logo URL
 * @returns Complete HTML email template
 */
function emailTemplate(content: string, tenantId?: string): string {
  const logoUrl = buildLogoUrl(tenantId)
  
  return `
    <!DOCTYPE html>
    <html lang="da">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px 0;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
              <!-- Logo Header -->
              <tr>
                <td style="padding: 32px 40px 24px 40px; text-align: center; border-bottom: 1px solid #e9ecef;">
                  <img 
                    src="${logoUrl}" 
                    alt="Rundeklar" 
                    style="max-width: 240px; height: auto; display: block; margin: 0 auto;"
                    width="240"
                  />
                </td>
              </tr>
              <!-- Email Content -->
              <tr>
                <td style="padding: 40px 40px 30px 40px;">
                  ${content}
                </td>
              </tr>
              <tr>
                <td style="padding: 32px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 0 0 16px 0; text-align: center;">
                        <p style="margin: 0; font-size: 13px; font-weight: 600; color: #495057; text-transform: uppercase; letter-spacing: 0.5px;">
                          Har du spørgsmål?
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 0 20px 0; text-align: center;">
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6c757d;">
                          Hvis du oplever problemer eller har spørgsmål, er du meget velkommen til at kontakte os på
                        </p>
                        <p style="margin: 8px 0 0 0;">
                          <a href="mailto:marchalgreen@gmail.com" style="
                            color: #007bff;
                            text-decoration: none;
                            font-weight: 600;
                            font-size: 14px;
                          ">marchalgreen@gmail.com</a>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 20px 0 0 0; border-top: 1px solid #e9ecef; text-align: center;">
                        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #495057;">
                          ${RESEND_FROM_NAME}
                        </p>
                        <p style="margin: 0; font-size: 11px; color: #6c757d;">
                          Denne email blev sendt automatisk. Besvar ikke denne email direkte.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
 * Generates a styled button/link for emails
 * @param text - Button text
 * @param url - Button URL
 * @param variant - Button style variant ('primary' | 'secondary')
 * @returns HTML string for button
 */
function emailButton(text: string, url: string, variant: 'primary' | 'secondary' = 'primary'): string {
  const styles =
    variant === 'primary'
      ? 'background-color: #007bff; color: #ffffff;'
      : 'background-color: #6c757d; color: #ffffff;'
  return `
    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 24px 0;">
      <tr>
        <td align="center" style="padding: 0;">
          <a href="${url}" style="
            display: inline-block;
            padding: 14px 32px;
            ${styles}
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: background-color 0.2s;
          ">${text}</a>
        </td>
      </tr>
    </table>
  `
}

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
    logger.warn('Resend not configured - skipping email verification')
    return
  }

  const verifyUrl = buildTenantUrl(tenantId, `/verify-email?token=${token}`)

  const content = `
    <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #212529; line-height: 1.2;">
      Bekræft din email-adresse
    </h1>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Tak fordi du registrerede dig hos ${RESEND_FROM_NAME}!
    </p>
    
    <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Klik på knappen nedenfor for at bekræfte din email-adresse:
    </p>

    ${emailButton('Bekræft email', verifyUrl)}

    <div style="margin: 32px 0; padding: 16px; background-color: #d1ecf1; border-left: 4px solid #0c5460; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #0c5460;">
        <strong>Bemærk:</strong> Dette link udløber om 24 timer. Hvis du ikke har oprettet en konto, kan du ignorere denne email.
      </p>
    </div>

    <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #6c757d;">
      Hvis knappen ikke virker, kan du kopiere og indsætte denne URL i din browser:
    </p>
    <p style="margin: 8px 0 0 0; font-size: 12px; line-height: 1.6; color: #6c757d; word-break: break-all; font-family: 'Courier New', monospace;">
      ${verifyUrl}
    </p>
  `

  await resend.emails.send({
    from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
    to: email,
    subject: 'Bekræft din email-adresse',
    html: emailTemplate(content, tenantId)
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
    logger.warn('Resend not configured - skipping password reset email')
    return
  }

  const resetUrl = buildTenantUrl(tenantId, `/reset-password?token=${token}`)

  const content = `
    <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #212529; line-height: 1.2;">
      Nulstil din adgangskode
    </h1>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Du har anmodet om at nulstille din adgangskode for ${RESEND_FROM_NAME}.
    </p>
    
    <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Klik på knappen nedenfor for at fortsætte:
    </p>

    ${emailButton('Nulstil adgangskode', resetUrl)}

    <div style="margin: 32px 0; padding: 16px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #856404;">
        <strong>Vigtigt:</strong> Dette link udløber om 1 time. Hvis du ikke har anmodet om en nulstilling, kan du ignorere denne email.
      </p>
    </div>

    <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #6c757d;">
      Hvis knappen ikke virker, kan du kopiere og indsætte denne URL i din browser:
    </p>
    <p style="margin: 8px 0 0 0; font-size: 12px; line-height: 1.6; color: #6c757d; word-break: break-all; font-family: 'Courier New', monospace;">
      ${resetUrl}
    </p>
  `

  await resend.emails.send({
    from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
    to: email,
    subject: 'Nulstil din adgangskode',
    html: emailTemplate(content, tenantId)
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
    logger.warn('Resend not configured - skipping 2FA setup email')
    return
  }

  const content = `
    <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #212529; line-height: 1.2;">
      To-faktor godkendelse aktiveret
    </h1>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      To-faktor godkendelse er blevet aktiveret for din ${RESEND_FROM_NAME} konto.
    </p>
    
    <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Fra nu af skal du indtaste en verifikationskode fra din authenticator app, når du logger ind.
    </p>

    <div style="margin: 32px 0; padding: 16px; background-color: #d4edda; border-left: 4px solid #28a745; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #155724;">
        <strong>✓ Sikkerhed forbedret:</strong> Din konto er nu beskyttet med to-faktor godkendelse.
      </p>
    </div>

    <div style="margin: 32px 0; padding: 16px; background-color: #f8d7da; border-left: 4px solid #dc3545; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #721c24;">
        <strong>Vigtigt:</strong> Hvis du ikke har aktiveret to-faktor godkendelse, skal du kontakte support med det samme.
      </p>
    </div>
  `

  await resend.emails.send({
    from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
    to: email,
    subject: 'To-faktor godkendelse aktiveret',
    html: emailTemplate(content, _tenantId)
  })
}

/**
 * Send welcome email to new coach with PIN
 * @param email - Recipient email
 * @param pin - The coach's PIN code
 * @param tenantId - Tenant ID for URL building
 * @param username - Coach username
 */
export async function sendCoachWelcomeEmail(
  email: string,
  pin: string,
  tenantId: string,
  username: string
): Promise<void> {
  if (!resend) {
    logger.warn('Resend not configured - skipping welcome email')
    return
  }

  // Build login URL based on tenant subdomain
  const loginUrl = buildTenantUrl(tenantId, '/login')

  const content = `
    <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #212529; line-height: 1.2;">
      Velkommen til ${RESEND_FROM_NAME}!
    </h1>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Hej ${username},
    </p>
    
    <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Din trænerkonto er blevet oprettet. Du kan nu logge ind med følgende oplysninger:
    </p>

    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 32px 0; background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
      <tr>
        <td style="padding: 0 0 16px 0;">
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px;">
            Brugernavn
          </p>
          <p style="margin: 8px 0 0 0; font-size: 18px; font-weight: 600; color: #212529;">
            ${username}
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 0 0 0; border-top: 1px solid #dee2e6;">
          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px;">
            PIN-kode
          </p>
          <table role="presentation" style="border-collapse: separate; border-spacing: 10px; margin: 12px auto 0 auto;">
            <tr>
              ${generatePINBoxes(pin)}
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${emailButton('Log ind', loginUrl)}

    <p style="margin: 32px 0 0 0; font-size: 14px; line-height: 1.6; color: #6c757d; text-align: center;">
      Hvis du har spørgsmål, er du velkommen til at kontakte os.
    </p>
  `

  await resend.emails.send({
    from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
    to: email,
    subject: `Velkommen til ${RESEND_FROM_NAME}`,
    html: emailTemplate(content, tenantId)
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
    logger.warn('Resend not configured - skipping PIN reset email')
    throw new Error('Resend email service is not configured. Please set RESEND_API_KEY environment variable.')
  }

  // Build reset URL based on tenant subdomain
  const resetUrl = buildTenantUrl(tenantId, `/reset-pin?token=${token}`)

  try {
    logger.debug(`Attempting to send PIN reset email to ${email}`)
    
    const content = `
      <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #212529; line-height: 1.2;">
        Nulstil din PIN
      </h1>
      
      <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #495057;">
        Hej ${username},
      </p>
      
      <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #495057;">
        Du har anmodet om at nulstille din PIN for ${RESEND_FROM_NAME}. Klik på knappen nedenfor for at fortsætte.
      </p>

      ${emailButton('Nulstil PIN', resetUrl)}

      <div style="margin: 32px 0; padding: 16px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #856404;">
          <strong>Vigtigt:</strong> Dette link udløber om 1 time. Hvis du ikke har anmodet om en PIN-nulstilling, kan du ignorere denne email.
        </p>
      </div>

      <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #6c757d;">
        Hvis knappen ikke virker, kan du kopiere og indsætte denne URL i din browser:
      </p>
      <p style="margin: 8px 0 0 0; font-size: 12px; line-height: 1.6; color: #6c757d; word-break: break-all; font-family: 'Courier New', monospace;">
        ${resetUrl}
      </p>
    `

    const result = await resend.emails.send({
      from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
      to: email,
      subject: 'Nulstil din PIN',
      html: emailTemplate(content, tenantId)
    })
    
    // Check for errors in result
    if (result.error) {
      logger.error('Resend API returned an error', result.error)
      throw new Error(`Resend API error: ${result.error.message || JSON.stringify(result.error)}`)
    }
    
    logger.debug('PIN reset email sent successfully')
  } catch (error) {
    logger.error('Failed to send PIN reset email', error)
    throw error
  }
}

