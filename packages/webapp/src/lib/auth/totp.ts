import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

/**
 * Generate a TOTP secret for two-factor authentication
 * @returns TOTP secret object
 */
export function generateTOTPSecret() {
  return speakeasy.generateSecret({
    name: 'Herlev Hjorten',
    length: 32
  })
}

/**
 * Generate QR code data URL for TOTP setup
 * @param secret - TOTP secret
 * @param email - User email for label
 * @returns QR code data URL
 */
export async function generateQRCode(secret: string, email: string): Promise<string> {
  const otpauthUrl = speakeasy.otpauthURL({
    secret,
    label: email,
    issuer: 'Herlev Hjorten'
  })

  return await QRCode.toDataURL(otpauthUrl)
}

/**
 * Verify a TOTP code
 * @param secret - TOTP secret
 * @param token - TOTP code to verify
 * @param window - Time window for verification (default: 1)
 * @returns True if code is valid
 */
export function verifyTOTP(secret: string, token: string, window: number = 1): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window
  }) || false
}

/**
 * Generate backup codes for 2FA
 * @param count - Number of codes to generate (default: 10)
 * @returns Array of backup codes
 */
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

export async function generateBackupCodes(count: number = 10): Promise<string[]> {
  const codes: string[] = []
  
  for (let i = 0; i < count; i++) {
    const bytes = await getRandomBytes(4)
    const code = bytesToHex(bytes).toUpperCase()
    codes.push(code)
  }
  
  return codes
}

/**
 * Hash backup codes for storage
 * @param codes - Array of backup codes
 * @returns Array of hashed codes
 */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  if (typeof window !== 'undefined') {
    // Browser: this should only be called server-side
    throw new Error('hashBackupCodes can only be used server-side')
  }
  const cryptoModule = await import('node:crypto')
  return codes.map(code => 
    cryptoModule.createHash('sha256').update(code).digest('hex')
  )
}

/**
 * Verify a backup code against hashed codes
 * @param code - Plain backup code
 * @param hashedCodes - Array of hashed backup codes
 * @returns Index of matching code, or -1 if not found
 */
export async function verifyBackupCode(code: string, hashedCodes: string[]): Promise<number> {
  if (typeof window !== 'undefined') {
    // Browser: this should only be called server-side
    throw new Error('verifyBackupCode can only be used server-side')
  }
  const cryptoModule = await import('node:crypto')
  const codeHash = cryptoModule.createHash('sha256').update(code.toUpperCase()).digest('hex')
  return hashedCodes.findIndex(hash => hash === codeHash)
}

