// Dynamic import argon2 only on server-side
// In browser, Vite will use the stub from vite.config.ts
async function getArgon2() {
  if (typeof window !== 'undefined') {
    throw new Error('argon2 can only be used server-side')
  }
  // Use dynamic import to avoid bundling in browser
  const argon2Module = await import('@node-rs/argon2')
  return argon2Module
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

// PIN codes skal være præcis 6 cifre
const PIN_LENGTH = 6

// Argon2 options for PIN (stærkere end password pga. kort længde)
const ARGON2_OPTIONS = {
  memoryCost: 65536, // 64 MB
  timeCost: 5, // Højere end password (5 vs 3) for bedre sikkerhed
  outputLen: 32,
  parallelism: 4
}

/**
 * Validates PIN format (exactly 6 digits)
 * @param pin - PIN to validate
 * @returns Object with isValid and errors array
 */
export function validatePIN(pin: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!/^\d+$/.test(pin)) {
    errors.push('PIN skal kun indeholde tal')
  }
  if (pin.length !== PIN_LENGTH) {
    errors.push(`PIN skal være præcis ${PIN_LENGTH} cifre`)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Hash a PIN using Argon2id
 * @param pin - Plain text PIN (6 digits)
 * @returns Hashed PIN
 */
export async function hashPIN(pin: string): Promise<string> {
  const validation = validatePIN(pin)
  if (!validation.isValid) {
    throw new Error(`Invalid PIN format: ${validation.errors.join(', ')}`)
  }
  const argon2 = await getArgon2()
  return await argon2.hash(pin, ARGON2_OPTIONS)
}

/**
 * Verify a PIN against a hash
 * @param pin - Plain text PIN
 * @param hash - Stored PIN hash
 * @returns True if PIN matches hash
 */
export async function verifyPIN(pin: string, hash: string): Promise<boolean> {
  try {
    const argon2 = await getArgon2()
    return await argon2.verify(hash, pin)
  } catch {
    return false
  }
}

/**
 * Generate a random 6-digit PIN
 * @returns Random 6-digit PIN string
 */
export function generateRandomPIN(): string {
  // Generate random number between 100000 and 999999
  const min = 100000
  const max = 999999
  const pin = Math.floor(Math.random() * (max - min + 1)) + min
  return pin.toString()
}

/**
 * Generate a PIN reset token
 * @returns Random token string
 */
export async function generatePINResetToken(): Promise<string> {
  const bytes = await getRandomBytes(32)
  // Convert Uint8Array to hex string
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Check if PIN reset token is expired
 * @param expiresAt - Expiration timestamp
 * @returns True if expired
 */
export function isPINResetTokenExpired(expiresAt: Date | string): boolean {
  const expires = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  return expires < new Date()
}

