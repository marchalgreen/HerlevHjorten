/**
 * Formatting utilities for dates, numbers, and text.
 * 
 * Provides consistent formatting across the application
 * with proper locale support.
 */

import { DATE_CONSTANTS } from '../constants/index.js'

/**
 * Formats a date string to Danish locale format.
 * 
 * @param dateStr - ISO date string or null
 * @param includeTime - Whether to include time in the output
 * @returns Formatted date string or 'Aldrig' if null
 * 
 * @example
 * ```typescript
 * formatDate('2024-01-15T10:30:00Z') // '15. jan. 2024, 10:30'
 * formatDate(null) // 'Aldrig'
 * formatDate('2024-01-15T10:30:00Z', false) // '15. jan. 2024'
 * ```
 */
export const formatDate = (
  dateStr: string | null | undefined,
  includeTime = true
): string => {
  if (!dateStr) {
    return 'Aldrig'
  }
  
  try {
    const date = new Date(dateStr)
    
    if (isNaN(date.getTime())) {
      return 'Ugyldig dato'
    }
    
    return new Intl.DateTimeFormat(DATE_CONSTANTS.DEFAULT_LOCALE, {
      dateStyle: DATE_CONSTANTS.DATE_STYLE,
      ...(includeTime && { timeStyle: DATE_CONSTANTS.TIME_STYLE }),
    }).format(date)
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Ugyldig dato'
  }
}

/**
 * Formats a date to show only the date part (no time).
 * 
 * @param dateStr - ISO date string or null
 * @returns Formatted date string or 'Aldrig' if null
 * 
 * @example
 * ```typescript
 * formatDateOnly('2024-01-15T10:30:00Z') // '15. jan. 2024'
 * ```
 */
export const formatDateOnly = (dateStr: string | null | undefined): string => {
  return formatDate(dateStr, false)
}

/**
 * Formats a player name with optional alias.
 * 
 * @param name - Player name
 * @param alias - Optional player alias
 * @returns Formatted name string
 * 
 * @example
 * ```typescript
 * formatPlayerName('John Doe', 'JD') // 'John Doe (JD)'
 * formatPlayerName('John Doe') // 'John Doe'
 * ```
 */
export const formatPlayerName = (name: string, alias?: string | null): string => {
  if (alias) {
    return `${name} (${alias})`
  }
  return name
}

/**
 * Formats a player name for card display: Firstname MIDDLENAME LASTNAME
 * - Keeps the first token as-is (assumed proper-cased)
 * - Uppercases all remaining tokens
 * - Preserves alias in parentheses if provided
 */
export const formatPlayerCardName = (name: string, alias?: string | null): string => {
  // If a nickname/alias exists, prefer showing it in ALL CAPS
  if (alias && alias.trim().length > 0) {
    return alias.trim().toUpperCase()
  }
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return name
  const [first, ...rest] = parts
  const upperRest = rest.map((p) => p.toUpperCase())
  return [first, ...upperRest].join(' ')
}

/**
 * Formats a number with optional decimal places.
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string
 * 
 * @example
 * ```typescript
 * formatNumber(1234.567, 2) // '1.234,57'
 * formatNumber(1234) // '1.234'
 * ```
 */
export const formatNumber = (value: number | null | undefined, decimals = 0): string => {
  if (value === null || value === undefined) {
    return '–'
  }
  
  try {
    return new Intl.NumberFormat(DATE_CONSTANTS.DEFAULT_LOCALE, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  } catch (error) {
    console.error('Error formatting number:', error)
    return String(value)
  }
}

/**
 * Formats a category letter from category name.
 * 
 * @param category - Player category ('Single', 'Double', 'Begge', or null)
 * @returns Category letter ('S', 'D', 'B') or null
 * 
 * @example
 * ```typescript
 * formatCategoryLetter('Single') // 'S'
 * formatCategoryLetter('Double') // 'D'
 * formatCategoryLetter('Begge') // 'B'
 * formatCategoryLetter(null) // null
 * ```
 */
export const formatCategoryLetter = (
  category: 'Single' | 'Double' | 'Begge' | null | undefined
): 'S' | 'D' | 'B' | null => {
  if (!category) {
    return null
  }
  
  switch (category) {
    case 'Single':
      return 'S'
    case 'Double':
      return 'D'
    case 'Begge':
      return 'B'
    default:
      return null
  }
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 * 
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 * 
 * @example
 * ```typescript
 * formatDuration(3000) // '3 sekunder'
 * formatDuration(60000) // '1 minut'
 * ```
 */
export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours} ${hours === 1 ? 'time' : 'timer'}`
  }
  
  if (minutes > 0) {
    return `${minutes} ${minutes === 1 ? 'minut' : 'minutter'}`
  }
  
  return `${seconds} ${seconds === 1 ? 'sekund' : 'sekunder'}`
}

/**
 * Truncates text to a maximum length with ellipsis.
 * 
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 * 
 * @example
 * ```typescript
 * truncateText('Very long text here', 10) // 'Very long...'
 * truncateText('Short', 10) // 'Short'
 * ```
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text
  }
  
  return `${text.slice(0, maxLength - 3)}...`
}

/**
 * Formats a coach username for display.
 * Converts lowercase username to title case (first letter capitalized).
 * Usernames are stored in lowercase for consistency in login/authentication,
 * but should be displayed with proper capitalization.
 * 
 * @param username - Coach username (typically lowercase)
 * @returns Formatted username with first letter capitalized
 * 
 * @example
 * ```typescript
 * formatCoachUsername('simoni') // 'Simoni'
 * formatCoachUsername('john doe') // 'John doe'
 * formatCoachUsername('') // ''
 * ```
 */
export const formatCoachUsername = (username: string | null | undefined): string => {
  if (!username || username.length === 0) {
    return ''
  }
  
  // Capitalize first letter, keep rest as-is
  return username.charAt(0).toUpperCase() + username.slice(1)
}

