/**
 * Application-wide constants.
 * 
 * Centralizes magic numbers, strings, and configuration values
 * to improve maintainability and reduce duplication.
 */

/**
 * Match and court configuration constants.
 */
export const MATCH_CONSTANTS = {
  /** Maximum number of players per court in a standard match. */
  MAX_PLAYERS_PER_COURT: 4,
  
  /** Maximum number of players per court in extended capacity mode. */
  MAX_PLAYERS_PER_COURT_EXTENDED: 8,
  
  /** Maximum number of rounds in a training session. */
  MAX_ROUNDS: 4,
  
  /** Default number of slots per court. */
  DEFAULT_SLOTS_PER_COURT: 4,
  
  /** Default number of empty slots per court (can be extended to 5-8). */
  EMPTY_SLOTS: 4,
  
  /** Slot numbers for 1v1 matches (opposite sides of net). */
  SINGLES_SLOTS: [1, 2] as const,
  
  /** Slot numbers for 2v2 matches (normal order). */
  DOUBLES_SLOTS: [0, 1, 2, 3] as const,
} as const

/**
 * Player category constants.
 */
export const PLAYER_CATEGORIES = {
  SINGLE: 'Single',
  DOUBLE: 'Double',
  BOTH: 'Begge',
} as const

/**
 * Player gender constants.
 */
export const PLAYER_GENDERS = {
  MALE: 'Herre',
  FEMALE: 'Dame',
} as const

/**
 * Training session status constants.
 */
export const SESSION_STATUS = {
  ACTIVE: 'active',
  ENDED: 'ended',
} as const

/**
 * Training session timeout configuration.
 */
export const SESSION_TIMEOUT = {
  /** Maximum duration for an active training session in milliseconds (default: 5 hours). */
  MAX_DURATION_MS: 5 * 60 * 60 * 1000, // 5 hours in milliseconds
  
  /** Maximum duration for an active training session in hours (for display). */
  MAX_DURATION_HOURS: 5,
} as const

/**
 * UI and animation constants.
 */
export const UI_CONSTANTS = {
  /** Debounce delay for search inputs (milliseconds). */
  SEARCH_DEBOUNCE_MS: 300,
  
  /** Animation duration for check-in/out transitions (milliseconds). */
  CHECK_IN_ANIMATION_DURATION_MS: 300,
  
  /** Delay before removing animation state after transition (milliseconds). */
  ANIMATION_CLEANUP_DELAY_MS: 400,
  
  /** Maximum height for table containers (pixels). */
  TABLE_MAX_HEIGHT_PX: 520,
  
  /** Maximum height for dropdown lists (pixels). */
  DROPDOWN_MAX_HEIGHT_PX: 200,
} as const

/**
 * Date and time formatting constants.
 */
export const DATE_CONSTANTS = {
  /** Default locale for date formatting. */
  DEFAULT_LOCALE: 'da-DK',
  
  /** Date format style for display. */
  DATE_STYLE: 'medium' as const,
  
  /** Time format style for display. */
  TIME_STYLE: 'short' as const,
} as const

/**
 * Letter filter constants for player filtering.
 */
export const LETTER_FILTERS = {
  /** All letters in Danish alphabet. */
  ALL_LETTERS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ',
  
  /** "All" filter option. */
  ALL: 'Alle',
  
  /** Split point for two-row layout (15 items per row). */
  ROW_SPLIT_INDEX: 14,
} as const

/**
 * Route path constants.
 */
export const ROUTES = {
  CHECK_IN: '/check-in',
  ROUNDS: '/runder',
  MATCH_PROGRAM: '/match-program', // Deprecated: use ROUNDS instead
  PLAYERS: '/players',
  STATISTICS: '/statistics',
} as const

/**
 * API error codes.
 */
export const ERROR_CODES = {
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  PLAYER_ALREADY_EXISTS: 'PLAYER_ALREADY_EXISTS',
  PLAYER_INACTIVE: 'PLAYER_INACTIVE',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_NOT_ACTIVE: 'SESSION_NOT_ACTIVE',
  CHECK_IN_EXISTS: 'CHECK_IN_EXISTS',
  CHECK_IN_NOT_FOUND: 'CHECK_IN_NOT_FOUND',
  COURT_NOT_FOUND: 'COURT_NOT_FOUND',
  COURT_FULL: 'COURT_FULL',
  SLOT_OCCUPIED: 'SLOT_OCCUPIED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

/**
 * Toast notification variants.
 */
export const TOAST_VARIANTS = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const

/**
 * Validation constants.
 */
export const VALIDATION = {
  /** Minimum length for player names. */
  MIN_NAME_LENGTH: 1,
  
  /** Maximum length for player names. */
  MAX_NAME_LENGTH: 100,
  
  /** Minimum court index. */
  MIN_COURT_IDX: 1,
  
  /** Maximum court index. */
  MAX_COURT_IDX: 8,
  
  /** Minimum slot number. */
  MIN_SLOT: 0,
  
  /** Maximum slot number. */
  MAX_SLOT: 7,
  
  /** Minimum round number. */
  MIN_ROUND: 1,
  
  /** Maximum round number. */
  MAX_ROUND: 4,
} as const

