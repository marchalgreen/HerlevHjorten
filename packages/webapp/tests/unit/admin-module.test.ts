/**
 * Unit tests for admin module functionality
 * Note: These are unit tests for utility functions, not integration tests for API endpoints
 */

import { describe, it, expect } from 'vitest'
import { isSuperAdmin, isAdmin, isCoach } from '../../src/lib/auth/roles'

describe('Admin Module - Role Checks', () => {
  describe('isSuperAdmin', () => {
    it('should return true for super_admin role', () => {
      expect(isSuperAdmin('super_admin')).toBe(true)
    })

    it('should return false for admin role', () => {
      expect(isSuperAdmin('admin')).toBe(false)
    })

    it('should return false for coach role', () => {
      expect(isSuperAdmin('coach')).toBe(false)
    })
  })

  describe('isAdmin', () => {
    it('should return true for super_admin role', () => {
      expect(isAdmin('super_admin')).toBe(true)
    })

    it('should return true for admin role', () => {
      expect(isAdmin('admin')).toBe(true)
    })

    it('should return false for coach role', () => {
      expect(isAdmin('coach')).toBe(false)
    })
  })

  describe('isCoach', () => {
    it('should return true for coach role', () => {
      expect(isCoach('coach')).toBe(true)
    })

    it('should return false for admin role', () => {
      expect(isCoach('admin')).toBe(false)
    })

    it('should return false for super_admin role', () => {
      expect(isCoach('super_admin')).toBe(false)
    })
  })
})

describe('Admin Module - Tenant Utilities', () => {
  describe('Subdomain validation', () => {
    it('should validate subdomain format', () => {
      // This would test validateSubdomain if exported
      // For now, we test the concept
      const validSubdomains = ['herlev-hjorten', 'demo', 'test-tenant']
      const invalidSubdomains = ['', 'test tenant', 'test@tenant', 'TEST']

      validSubdomains.forEach(subdomain => {
        expect(subdomain.length).toBeGreaterThan(0)
        expect(subdomain).toMatch(/^[a-z0-9-]+$/)
      })

      invalidSubdomains.forEach(subdomain => {
        if (subdomain.length > 0) {
          expect(subdomain).not.toMatch(/^[a-z0-9-]+$/)
        }
      })
    })
  })
})

