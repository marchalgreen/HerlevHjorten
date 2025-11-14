/**
 * Custom hook for managing training session data and operations.
 * 
 * Provides a clean interface for fetching, creating, and managing training sessions
 * with loading states and error handling.
 */

import { useCallback, useEffect, useState } from 'react'
import type { TrainingSession } from '@rundeklar/common'
import api from '../api'
import { normalizeError } from '../lib/errors'
import { useToast } from '../components/ui/Toast'

/**
 * Return type for useSession hook.
 */
export interface UseSessionReturn {
  /** Current active session or null if none exists. */
  session: TrainingSession | null
  
  /** Whether data is currently loading. */
  loading: boolean
  
  /** Error message if any error occurred. */
  error: string | null
  
  /** Function to reload session data. */
  refetch: () => Promise<void>
  
  /** Function to start a new session or get existing active session. */
  startSession: () => Promise<TrainingSession | null>
  
  /** Function to end the active session. */
  endSession: (matchesData?: Array<{ round: number; matches: any[] }>) => Promise<void>
  
  /** Function to clear the current error. */
  clearError: () => void
}

/**
 * Custom hook for managing training sessions.
 * 
 * @returns Session data, loading state, error state, and session operations
 * 
 * @example
 * ```typescript
 * const { session, loading, startSession, endSession } = useSession()
 * 
 * if (!session) {
 *   return <button onClick={() => startSession()}>Start træning</button>
 * }
 * ```
 */
export const useSession = (): UseSessionReturn => {
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { notify } = useToast()

  /**
   * Loads the active session from the API.
   */
  const loadSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const active = await api.session.getActive()
      setSession(active)
    } catch (err) {
      const normalizedError = normalizeError(err)
      setError(normalizedError.message)
      // Don't show toast for "no active session" - it's a normal state
      if (normalizedError.code !== 'SESSION_NOT_FOUND') {
        notify({
          variant: 'danger',
          title: 'Kunne ikke hente træning',
          description: normalizedError.message
        })
      }
    } finally {
      setLoading(false)
    }
  }, [notify])

  /**
   * Starts a new session or gets existing active session.
   * 
   * @returns Started session or null if error occurred
   */
  const startSession = useCallback(async (): Promise<TrainingSession | null> => {
    setError(null)
    
    try {
      const active = await api.session.startOrGetActive()
      setSession(active)
      notify({
        variant: 'success',
        title: 'Træning startet',
        description: 'Træningen er nu aktiv'
      })
      return active
    } catch (err) {
      const normalizedError = normalizeError(err)
      setError(normalizedError.message)
      notify({
        variant: 'danger',
        title: 'Kunne ikke starte træning',
        description: normalizedError.message
      })
      return null
    }
  }, [notify])

  /**
   * Ends the active session.
   * 
   * @param matchesData - Optional match data to save before ending
   */
  const endSession = useCallback(async (
    matchesData?: Array<{ round: number; matches: any[] }>
  ): Promise<void> => {
    setError(null)
    
    try {
      await api.session.endActive(matchesData)
      setSession(null)
      notify({
        variant: 'success',
        title: 'Træning afsluttet',
        description: 'Træningen er nu afsluttet'
      })
    } catch (err) {
      const normalizedError = normalizeError(err)
      setError(normalizedError.message)
      notify({
        variant: 'danger',
        title: 'Kunne ikke afslutte træning',
        description: normalizedError.message
      })
    }
  }, [notify])

  /**
   * Clears the current error state.
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Load session on mount
  useEffect(() => {
    void loadSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    session,
    loading,
    error,
    refetch: loadSession,
    startSession,
    endSession,
    clearError
  }
}

