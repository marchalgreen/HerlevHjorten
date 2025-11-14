/**
 * Match Program state persistence utilities.
 * 
 * Handles saving and loading match program state to/from localStorage
 * for persistence across page reloads and navigation.
 */

import type { CourtWithPlayers } from '@rundeklar/common'

/** LocalStorage key for Match Program state persistence. */
const MATCH_PROGRAM_STORAGE_KEY = 'herlev-hjorten-match-program-state'

/** Type for persisted Match Program state. */
export type PersistedMatchProgramState = {
  inMemoryMatches: Record<number, CourtWithPlayers[]>
  lockedCourts: Record<number, number[]>
  hasRunAutoMatch: number[]
  extendedCapacityCourts: Array<[number, number]>
  sessionId: string | null
}

/**
 * Loads Match Program state from localStorage.
 * 
 * @param sessionId - Current session ID to validate persisted state
 * @returns Persisted state or null if not found/invalid
 */
export const loadPersistedState = (sessionId: string | null): Partial<PersistedMatchProgramState> | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(MATCH_PROGRAM_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as PersistedMatchProgramState

    // If sessionId is null, don't clear - just return null (session might not be loaded yet)
    if (sessionId === null) {
      return null
    }

    // Only restore if it's for the same session
    if (parsed.sessionId === sessionId) {
      return parsed
    }

    // Clear stale state from different session
    localStorage.removeItem(MATCH_PROGRAM_STORAGE_KEY)
    return null
  } catch {
    return null
  }
}

/**
 * Saves Match Program state to localStorage.
 * 
 * @param state - State to persist
 */
export const savePersistedState = (state: PersistedMatchProgramState): void => {
  if (typeof window === 'undefined') return
  try {
    const serialized = JSON.stringify(state)
    localStorage.setItem(MATCH_PROGRAM_STORAGE_KEY, serialized)
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clears persisted Match Program state from localStorage.
 */
export const clearPersistedState = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(MATCH_PROGRAM_STORAGE_KEY)
  } catch {
    // Ignore localStorage errors
  }
}

