/**
 * Custom hook for managing player check-ins for training sessions.
 * 
 * Provides a clean interface for checking players in/out with loading states,
 * error handling, and automatic refetching.
 */

import { useCallback, useEffect, useState } from 'react'
import type { CheckedInPlayer, Player } from '@rundeklar/common'
import api from '../api'
import { normalizeError } from '../lib/errors'
import { useToast } from '../components/ui/Toast'

/**
 * Return type for useCheckIns hook.
 */
export interface UseCheckInsReturn {
  /** Array of checked-in players. */
  checkedIn: CheckedInPlayer[]
  
  /** Whether data is currently loading. */
  loading: boolean
  
  /** Error message if any error occurred. */
  error: string | null
  
  /** Function to reload check-ins data. */
  refetch: () => Promise<void>
  
  /** Function to check in a player. */
  checkIn: (playerId: string, maxRounds?: number) => Promise<boolean>
  
  /** Function to check out a player. */
  checkOut: (playerId: string) => Promise<boolean>
  
  /** Function to clear the current error. */
  clearError: () => void
}

/**
 * Custom hook for managing player check-ins.
 * 
 * @param sessionId - Active session ID (if null, check-ins won't load)
 * @returns Check-ins data, loading state, error state, and check-in operations
 * 
 * @example
 * ```typescript
 * const { checkedIn, loading, checkIn, checkOut } = useCheckIns(session?.id)
 * 
 * await checkIn(playerId, 1) // Check in with max 1 round
 * await checkOut(playerId)
 * ```
 */
export const useCheckIns = (sessionId: string | null): UseCheckInsReturn => {
  const [checkedIn, setCheckedIn] = useState<CheckedInPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { notify } = useToast()

  /**
   * Loads checked-in players from the API.
   */
  const loadCheckIns = useCallback(async () => {
    if (!sessionId) {
      setCheckedIn([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const result = await api.checkIns.listActive()
      setCheckedIn(result)
    } catch (err) {
      const normalizedError = normalizeError(err)
      setError(normalizedError.message)
      notify({
        variant: 'danger',
        title: 'Kunne ikke hente fremmøde',
        description: normalizedError.message
      })
    } finally {
      setLoading(false)
    }
  }, [sessionId, notify])

  /**
   * Checks in a player for the active session.
   * Optimistic update: UI updates immediately, database sync happens in background.
   * 
   * @param playerId - ID of player to check in
   * @param maxRounds - Optional maximum rounds (1 for "kun 1 runde")
   * @returns True if successful, false otherwise
   */
  const checkIn = useCallback(async (
    playerId: string,
    maxRounds?: number
  ): Promise<boolean> => {
    setError(null)
    
    // Fetch player data immediately for optimistic update
    let playerData: Player | null = null
    try {
      const players = await api.players.list({ active: true })
      playerData = players.find(p => p.id === playerId) || null
    } catch (err) {
      // If we can't get player data, continue anyway - will be loaded on sync
      console.warn('[useCheckIns] Failed to fetch player data for optimistic update:', err)
    }
    
    // Optimistic update: Add player to UI immediately with real data if available
    setCheckedIn(prev => {
      // Check if already checked in (prevent duplicates)
      if (prev.some(p => p.id === playerId)) {
        return prev
      }
      
      // Create checked-in player with real data if available
      const checkedInPlayer: CheckedInPlayer = playerData ? {
        ...playerData,
        checkInAt: new Date().toISOString(),
        maxRounds: maxRounds ?? null
      } : {
        id: playerId,
        name: 'Loading...', // Fallback if player data not available
        active: true,
        checkInAt: new Date().toISOString(),
        maxRounds: maxRounds ?? null
      } as CheckedInPlayer
      
      return [...prev, checkedInPlayer]
    })
    
    // Sync with database in background
    try {
      await api.checkIns.add({ playerId, maxRounds })
      // Reload to ensure consistency (will update if player data was missing)
      await loadCheckIns()
      return true
    } catch (err) {
      // Rollback optimistic update on error
      setCheckedIn(prev => prev.filter(p => p.id !== playerId))
      const normalizedError = normalizeError(err)
      setError(normalizedError.message)
      notify({
        variant: 'danger',
        title: 'Kunne ikke tjekke ind',
        description: normalizedError.message
      })
      return false
    }
  }, [loadCheckIns, notify])

  /**
   * Checks out a player from the active session.
   * Optimistic update: UI updates immediately, database sync happens in background.
   * 
   * @param playerId - ID of player to check out
   * @returns True if successful, false otherwise
   */
  const checkOut = useCallback(async (playerId: string): Promise<boolean> => {
    setError(null)
    
    // Optimistic update: Remove player from UI immediately
    const removedPlayer = checkedIn.find(p => p.id === playerId)
    setCheckedIn(prev => prev.filter(p => p.id !== playerId))
    
    // Sync with database in background
    try {
      await api.checkIns.remove({ playerId })
      // No need to reload - we already updated UI
      return true
    } catch (err) {
      // Rollback optimistic update on error
      if (removedPlayer) {
        setCheckedIn(prev => [...prev, removedPlayer].sort((a, b) => 
          a.checkInAt.localeCompare(b.checkInAt)
        ))
      }
      const normalizedError = normalizeError(err)
      setError(normalizedError.message)
      notify({
        variant: 'danger',
        title: 'Kunne ikke tjekke ud',
        description: normalizedError.message
      })
      return false
    }
  }, [checkedIn, notify])

  /**
   * Clears the current error state.
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Load check-ins when session ID changes
  useEffect(() => {
    void loadCheckIns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return {
    checkedIn,
    loading,
    error,
    refetch: loadCheckIns,
    checkIn,
    checkOut,
    clearError
  }
}

