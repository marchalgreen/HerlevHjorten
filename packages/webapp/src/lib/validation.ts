/**
 * Validation utilities for form inputs and data.
 * 
 * Provides reusable validation functions and helpers
 * for consistent validation across the application.
 */

import { VALIDATION } from '../constants'
import type { PlayerGender, PlayerCategory } from '@rundeklar/common'

/**
 * Validates a player name.
 * 
 * @param name - Name to validate
 * @returns Error message if invalid, null if valid
 */
export const validatePlayerName = (name: string): string | null => {
  const trimmed = name.trim()
  
  if (trimmed.length < VALIDATION.MIN_NAME_LENGTH) {
    return 'Navn skal være mindst 1 tegn'
  }
  
  if (trimmed.length > VALIDATION.MAX_NAME_LENGTH) {
    return `Navn må maksimalt være ${VALIDATION.MAX_NAME_LENGTH} tegn`
  }
  
  return null
}

/**
 * Validates a player alias.
 * 
 * @param alias - Alias to validate
 * @returns Error message if invalid, null if valid
 */
export const validatePlayerAlias = (alias: string | null | undefined): string | null => {
  if (!alias) {
    return null // Alias is optional
  }
  
  const trimmed = alias.trim()
  
  if (trimmed.length > VALIDATION.MAX_NAME_LENGTH) {
    return `Kaldenavn må maksimalt være ${VALIDATION.MAX_NAME_LENGTH} tegn`
  }
  
  return null
}

/**
 * Validates a level value (ranking).
 * 
 * @param level - Level value to validate
 * @returns Error message if invalid, null if valid
 */
export const validateLevel = (level: number | null | undefined): string | null => {
  if (level === null || level === undefined) {
    return null // Level is optional
  }
  
  if (!Number.isInteger(level)) {
    return 'Rangliste skal være et heltal'
  }
  
  if (level < 0) {
    return 'Rangliste kan ikke være negativ'
  }
  
  return null
}

/**
 * Validates a player gender.
 * 
 * @param gender - Gender to validate
 * @returns Error message if invalid, null if valid
 */
export const validateGender = (gender: PlayerGender | null | undefined): string | null => {
  if (!gender) {
    return null // Gender is optional
  }
  
  const validGenders: PlayerGender[] = ['Herre', 'Dame']
  
  if (!validGenders.includes(gender)) {
    return 'Ugyldigt køn'
  }
  
  return null
}

/**
 * Validates a player category.
 * 
 * @param category - Category to validate
 * @returns Error message if invalid, null if valid
 */
export const validateCategory = (category: PlayerCategory | null | undefined): string | null => {
  if (!category) {
    return null // Category is optional
  }
  
  const validCategories: PlayerCategory[] = ['Single', 'Double', 'Begge']
  
  if (!validCategories.includes(category)) {
    return 'Ugyldig kategori'
  }
  
  return null
}

/**
 * Validates a court index.
 * 
 * @param courtIdx - Court index to validate
 * @returns Error message if invalid, null if valid
 */
export const validateCourtIdx = (courtIdx: number): string | null => {
  if (!Number.isInteger(courtIdx)) {
    return 'Baneindeks skal være et heltal'
  }
  
  if (courtIdx < VALIDATION.MIN_COURT_IDX || courtIdx > VALIDATION.MAX_COURT_IDX) {
    return `Baneindeks skal være mellem ${VALIDATION.MIN_COURT_IDX} og ${VALIDATION.MAX_COURT_IDX}`
  }
  
  return null
}

/**
 * Validates a slot number.
 * 
 * @param slot - Slot number to validate
 * @returns Error message if invalid, null if valid
 */
export const validateSlot = (slot: number): string | null => {
  if (!Number.isInteger(slot)) {
    return 'Slot skal være et heltal'
  }
  
  if (slot < VALIDATION.MIN_SLOT || slot > VALIDATION.MAX_SLOT) {
    return `Slot skal være mellem ${VALIDATION.MIN_SLOT} og ${VALIDATION.MAX_SLOT}`
  }
  
  return null
}

/**
 * Validates a round number.
 * 
 * @param round - Round number to validate
 * @returns Error message if invalid, null if valid
 */
export const validateRound = (round: number): string | null => {
  if (!Number.isInteger(round)) {
    return 'Runde skal være et heltal'
  }
  
  if (round < VALIDATION.MIN_ROUND || round > VALIDATION.MAX_ROUND) {
    return `Runde skal være mellem ${VALIDATION.MIN_ROUND} og ${VALIDATION.MAX_ROUND}`
  }
  
  return null
}

/**
 * Validates an email address format.
 * 
 * @param email - Email to validate
 * @returns Error message if invalid, null if valid
 */
export const validateEmail = (email: string): string | null => {
  if (!email) {
    return 'E-mail er påkrævet'
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!emailRegex.test(email)) {
    return 'Ugyldig e-mailadresse'
  }
  
  return null
}

/**
 * Validates that a value is not empty.
 * 
 * @param value - Value to validate
 * @param fieldName - Name of the field for error message
 * @returns Error message if invalid, null if valid
 */
export const validateRequired = (value: unknown, fieldName: string): string | null => {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} er påkrævet`
  }
  
  if (typeof value === 'string' && value.trim().length === 0) {
    return `${fieldName} er påkrævet`
  }
  
  return null
}

/**
 * Validates that a number is within a range.
 * 
 * @param value - Number to validate
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param fieldName - Name of the field for error message
 * @returns Error message if invalid, null if valid
 */
export const validateRange = (
  value: number,
  min: number,
  max: number,
  fieldName: string
): string | null => {
  if (value < min || value > max) {
    return `${fieldName} skal være mellem ${min} og ${max}`
  }
  
  return null
}

