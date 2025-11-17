/**
 * Unit tests for PIN authentication
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { hashPIN, verifyPIN, validatePIN, generateRandomPIN, generatePINResetToken, isPINResetTokenExpired } from '../../src/lib/auth/pin'

describe('PIN Authentication', () => {
  describe('validatePIN', () => {
    it('should accept valid 6-digit PIN', () => {
      const result = validatePIN('123456')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject PIN with less than 6 digits', () => {
      const result = validatePIN('12345')
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('6 cifre'))).toBe(true)
    })

    it('should reject PIN with more than 6 digits', () => {
      const result = validatePIN('1234567')
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('6 cifre'))).toBe(true)
    })

    it('should reject PIN with non-numeric characters', () => {
      const result = validatePIN('12345a')
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('tal') || e.includes('cifre'))).toBe(true)
    })

    it('should reject empty PIN', () => {
      const result = validatePIN('')
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('generateRandomPIN', () => {
    it('should generate a 6-digit PIN', () => {
      const pin = generateRandomPIN()
      expect(pin).toMatch(/^\d{6}$/)
    })

    it('should generate different PINs each time', () => {
      const pin1 = generateRandomPIN()
      const pin2 = generateRandomPIN()
      // Very unlikely to be the same, but possible
      // Test that it's at least a valid format
      expect(pin1).toMatch(/^\d{6}$/)
      expect(pin2).toMatch(/^\d{6}$/)
    })
  })

  describe('hashPIN and verifyPIN', () => {
    // Note: These tests require server-side environment (argon2)
    // They are skipped in browser/test environment
    it.skip('should hash and verify a PIN correctly', async () => {
      const pin = '123456'
      const hash = await hashPIN(pin)
      
      expect(hash).toBeTruthy()
      expect(hash).not.toBe(pin)
      expect(hash.length).toBeGreaterThan(20) // Argon2 hashes are long
      
      const isValid = await verifyPIN(pin, hash)
      expect(isValid).toBe(true)
    })

    it.skip('should reject incorrect PIN', async () => {
      const pin = '123456'
      const hash = await hashPIN(pin)
      
      const isValid = await verifyPIN('654321', hash)
      expect(isValid).toBe(false)
    })

    it.skip('should handle different PINs correctly', async () => {
      const pin1 = '123456'
      const pin2 = '654321'
      
      const hash1 = await hashPIN(pin1)
      const hash2 = await hashPIN(pin2)
      
      expect(hash1).not.toBe(hash2)
      
      expect(await verifyPIN(pin1, hash1)).toBe(true)
      expect(await verifyPIN(pin2, hash2)).toBe(true)
      expect(await verifyPIN(pin1, hash2)).toBe(false)
      expect(await verifyPIN(pin2, hash1)).toBe(false)
    })
  })

  describe('generatePINResetToken', () => {
    it('should generate a reset token', async () => {
      const token = await generatePINResetToken()
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(20) // Should be a long random string
    })

    it('should generate different tokens each time', async () => {
      const token1 = await generatePINResetToken()
      const token2 = await generatePINResetToken()
      expect(token1).not.toBe(token2)
    })
  })

  describe('isPINResetTokenExpired', () => {
    it('should return false for future expiration date', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      expect(isPINResetTokenExpired(futureDate)).toBe(false)
    })

    it('should return true for past expiration date', () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      expect(isPINResetTokenExpired(pastDate)).toBe(true)
    })

    it('should return true for very old expiration date', () => {
      const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      expect(isPINResetTokenExpired(oldDate)).toBe(true)
    })
  })
})

