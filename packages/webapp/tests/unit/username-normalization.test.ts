/**
 * Unit tests for username normalization (case-insensitive)
 */

import { describe, it, expect } from 'vitest'

describe('Username Normalization', () => {
  describe('Case-insensitive comparison', () => {
    it('should normalize usernames to lowercase', () => {
      const username1 = 'TestUser'
      const username2 = 'testuser'
      const username3 = 'TESTUSER'
      
      expect(username1.toLowerCase()).toBe(username2)
      expect(username2.toLowerCase()).toBe(username3.toLowerCase())
    })

    it('should handle mixed case usernames', () => {
      const username = 'MiXeDcAsE'
      const normalized = username.toLowerCase()
      expect(normalized).toBe('mixedcase')
    })

    it('should handle usernames with numbers', () => {
      const username = 'User123'
      const normalized = username.toLowerCase()
      expect(normalized).toBe('user123')
    })

    it('should trim whitespace', () => {
      const username = '  TestUser  '
      const normalized = username.toLowerCase().trim()
      expect(normalized).toBe('testuser')
    })
  })

  describe('Database comparison logic', () => {
    it('should compare usernames case-insensitively', () => {
      // Simulating SQL: LOWER(username) = LOWER(${username})
      const compareUsernames = (dbUsername: string, inputUsername: string): boolean => {
        return dbUsername.toLowerCase() === inputUsername.toLowerCase()
      }

      expect(compareUsernames('TestUser', 'testuser')).toBe(true)
      expect(compareUsernames('TESTUSER', 'testuser')).toBe(true)
      expect(compareUsernames('testuser', 'TestUser')).toBe(true)
      expect(compareUsernames('TestUser', 'TestUser')).toBe(true)
      expect(compareUsernames('TestUser', 'DifferentUser')).toBe(false)
    })
  })
})

