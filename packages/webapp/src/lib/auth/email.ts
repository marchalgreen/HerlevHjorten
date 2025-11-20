import { Resend } from 'resend'
import { logger } from '../utils/logger.js'
import { formatCoachUsername } from '../formatting.js'
import { LOGO_BASE64 } from './email-logo-base64.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || 'Herlev/Hjorten'
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'rundeklar.dk'
const APP_URL = process.env.APP_URL || process.env.VITE_APP_URL || 'http://localhost:5173'

if (!RESEND_API_KEY) {
  logger.warn('RESEND_API_KEY not set - email functionality will be disabled')
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

/**
 * Builds a tenant-specific subdomain URL
 * @param tenantId - Tenant ID (e.g., "herlev-hjorten", "demo")
 * @param path - Path to append (e.g., "/", "/reset-pin?token=...")
 * @returns Full URL with subdomain (e.g., "https://herlev-hjorten.rundeklar.dk/")
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
 * Builds logo as base64 data URI for emails (always embedded for maximum compatibility)
 * Email clients often block external images, so embedding ensures the logo always displays
 * Uses pre-embedded base64 logo from email-logo-base64.ts
 * @param _tenantId - Tenant ID (optional, reserved for future tenant-specific logos)
 * @returns Base64 data URI for logo image
 */
function buildLogoUrl(_tenantId?: string): string {
  // Always use embedded base64 logo for maximum email client compatibility
  // This ensures the logo displays even when email clients block external images
  const dataUri = `data:image/png;base64,${LOGO_BASE64}`
  logger.debug(`Logo URL generated: ${dataUri.length} characters (base64: ${LOGO_BASE64.length} chars)`)
  return dataUri
}

/**
 * Base email template wrapper with consistent styling
 * @param content - HTML content for the email body
 * @param tenantId - Optional tenant ID for logo URL
 * @param options - Optional template options
 * @returns Complete HTML email template
 */
function emailTemplate(
  content: string,
  tenantId?: string,
  options?: { showLogo?: boolean; showAutoFooter?: boolean; showQuestions?: boolean }
): string {
  const showLogo = options?.showLogo !== false // Default to true for backward compatibility
  const showAutoFooter = options?.showAutoFooter !== false // Default to true for backward compatibility
  const showQuestions = options?.showQuestions !== false // Default to true for backward compatibility
  const logoUrl = showLogo ? buildLogoUrl(tenantId) : ''
  
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
              ${showLogo ? `<!-- Logo Header -->
              <tr>
                <td style="padding: 32px 40px 24px 40px; text-align: center; border-bottom: 1px solid #e9ecef;">
                  <img 
                    src="${logoUrl}" 
                    alt="Rundeklar" 
                    style="max-width: 240px; height: auto; display: block; margin: 0 auto; border: 0; outline: none; text-decoration: none;"
                    width="240"
                    height="auto"
                  />
                </td>
              </tr>` : ''}
              <!-- Email Content -->
              <tr>
                <td style="padding: 40px 40px 30px 40px;">
                  ${content}
                </td>
              </tr>
              ${showQuestions || showAutoFooter ? `<tr>
                <td style="padding: 32px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    ${showQuestions ? `<tr>
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
                    </tr>` : ''}
                    ${showAutoFooter ? `<tr>
                      <td style="padding: 20px 0 0 0; border-top: 1px solid #e9ecef; text-align: center;">
                        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #495057;">
                          ${RESEND_FROM_NAME}
                        </p>
                        <p style="margin: 0; font-size: 11px; color: #6c757d;">
                          Denne email blev sendt automatisk. Besvar ikke denne email direkte.
                        </p>
                      </td>
                    </tr>` : ''}
                  </table>
                </td>
              </tr>` : ''}
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
  // Login page is shown automatically on tenant root, so just link to root
  const loginUrl = buildTenantUrl(tenantId, '/')

  const content = `
    <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #212529; line-height: 1.2;">
      Velkommen til ${RESEND_FROM_NAME}!
    </h1>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Hej ${formatCoachUsername(username)},
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
            ${formatCoachUsername(username)}
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
        Hej ${formatCoachUsername(username)},
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

/**
 * Send cold-call email to club presidents
 * @param email - Recipient email
 * @param clubName - Name of the club
 * @param presidentName - Name of the club president
 * @returns Promise that resolves when email is sent
 */
export async function sendColdCallEmail(
  email: string,
  clubName: string,
  presidentName: string
): Promise<void> {
  // Check environment variable dynamically (in case it was set after module load)
  const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
  const resendClient = apiKey ? (resend || new Resend(apiKey)) : null
  
  if (!resendClient) {
    logger.warn('Resend not configured - skipping cold-call email')
    throw new Error('Resend email service is not configured. Please set RESEND_API_KEY environment variable.')
  }

  const demoUrl = 'https://demo.rundeklar.dk'
  const signupUrl = 'https://rundeklar.dk'

  // Extract first name from full name (take first word)
  const firstName = presidentName.trim().split(/\s+/)[0] || presidentName

  const content = `
    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Hej ${firstName}
    </p>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Jeg håber alt er godt hos jer. Mit navn er Marc, og jeg spiller selv i Herlev/Hjorten Badminton. De sidste par måneder har jeg brugt en del tid sammen med vores trænere på at løse en udfordring, som jeg tror mange klubber kender: de travle aftener hvor man både skal tage imod spillere, holde overblik og samtidig få runderne sat hurtigt og fair.
    </p>
    
    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Vi endte med at bygge et lille værktøj for at hjælpe os selv, og det voksede sig siden større. I dag hedder det Rundeklar, og vi bruger det fast i Herlev/Hjorten.
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Rundeklar er lavet for at give jer overblik og ro på de travle aftener, så energien kan bruges på træningen i stedet for administration.
    </p>
    
    <ul style="margin: 0 0 24px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #495057;">
      <li style="margin-bottom: 12px;">Spillere tjekker selv ind på få sekunder</li>
      <li style="margin-bottom: 12px;">Runderne sættes enten automatisk eller med et enkelt klik og et intuitivt drag og drop</li>
      <li style="margin-bottom: 12px;">Træneren får mere ro og mere tid på gulvet</li>
    </ul>
    
    <div style="margin: 32px 0; padding: 20px; background-color: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">
      <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 1.6; color: #495057; font-style: italic;">
        Før var det pen og papir og en masse råben på tværs af hallen. Nu ligger indtjekning, runder og overblik stille og roligt på én skærm. Det har gjort alt arbejdet omkring runder langt lettere og frigivet tid og ro til selve træningen.
      </p>
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6c757d; font-weight: 600;">
        — Morten Regaard, cheftræner, Herlev/Hjorten Badmintonklub
      </p>
    </div>
    
    <p style="margin: 32px 0 20px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Hvis I er nysgerrige, kan I prøve det direkte på <a href="${demoUrl}" style="color: #007bff; text-decoration: none; font-weight: 600;">demo.rundeklar.dk</a>.
    </p>
    
    <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Og hvis I vil mærke det i jeres egen klub, kan I oprette en gratis prøveperiode. Det tager få minutter og kræver ingen binding.
    </p>

    ${emailButton('Start her', signupUrl)}

    <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 1.6; color: #6c757d; text-align: center;">
      Direkte link: <a href="${signupUrl}" style="color: #007bff; text-decoration: none; word-break: break-all;">${signupUrl}</a>
    </p>

    <p style="margin: 32px 0 20px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Jeg viser det også gerne på et hurtigt opkald, hvis det er nemmere. Ti minutter er som regel nok til at gennemgå det vigtigste.
    </p>
    
    <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Hvad tænker I? Er det bedst at prøve selv, eller giver en hurtig gennemgang mest mening?
    </p>
    
    <p style="margin: 32px 0 0 0; font-size: 16px; line-height: 1.6; color: #495057;">
      Bedste hilsner<br>
      <strong style="color: #212529;">Marc Halgreen</strong><br>
      <span style="font-size: 14px; color: #6c757d;">Rundeklar</span>
    </p>
    
    <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #6c757d;">
      <a href="mailto:marc@rundeklar.dk" style="color: #007bff; text-decoration: none;">marc@rundeklar.dk</a><br>
      +45 53 69 69 52
    </p>
  `

  try {
    const result = await resendClient.emails.send({
      from: 'Marc Halgreen <marc@rundeklar.dk>',
      to: email,
      subject: `Vi gjorde vores træningsaftener lettere. Måske kan det også hjælpe i ${clubName}?`,
      html: emailTemplate(content, undefined, { showLogo: false, showAutoFooter: false, showQuestions: false }),
      // Enable click tracking (default is true, but being explicit)
      tags: [
        { name: 'category', value: 'cold_call' },
        { name: 'club_name', value: clubName.replace(/[^a-zA-Z0-9_]/g, '_') }
      ]
    })
    
    if (result.error) {
      logger.error('Resend API returned an error', result.error)
      throw new Error(`Resend API error: ${result.error.message || JSON.stringify(result.error)}`)
    }
    
    logger.info(`Cold-call email sent successfully to ${email} for ${clubName}`)
  } catch (error) {
    logger.error('Failed to send cold-call email', error)
    throw error
  }
}

