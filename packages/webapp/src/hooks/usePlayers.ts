/**
 * Custom hook for managing players data and operations.
 * 
 * Provides a clean interface for fetching, creating, updating, and managing players
 * with loading states, error handling, and automatic refetching.
 */

import { useCallback, useEffect, useState } from 'react'
import type { Player, PlayerCreateInput, PlayerListFilters, PlayerUpdateInput } from '@rundeklar/common'
import api from '../api'
import { normalizeError } from '../lib/errors'
import { useToast } from '../components/ui/Toast'

/**
 * Return type for usePlayers hook.
 */
export interface UsePlayersReturn {
  /** Array of players (filtered if filters provided). */
  players: Player[]
  
  /** Whether data is currently loading. */
  loading: boolean
  
  /** Error message if any error occurred. */
  error: string | null
  
  /** Function to reload players data. */
  refetch: () => Promise<void>
  
  /** Function to create a new player. */
  createPlayer: (input: PlayerCreateInput) => Promise<Player | null>
  
  /** Function to update an existing player. */
  updatePlayer: (input: PlayerUpdateInput) => Promise<Player | null>
  
  /** Function to clear the current error. */
  clearError: () => void
}

/**
 * Custom hook for managing players.
 * 
 * @param filters - Optional filters for player list (search query, active status)
 * @returns Players data, loading state, error state, and CRUD operations
 * 
 * @example
 * ```typescript
 * const { players, loading, error, createPlayer, updatePlayer } = usePlayers({
 *   q: 'John',
 *   active: true
 * })
 * ```
 */
export const usePlayers = (filters?: PlayerListFilters): UsePlayersReturn => {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { notify } = useToast()

  /**
   * Loads players from the API with optional filters.
   */
  const loadPlayers = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await api.players.list(filters)
      setPlayers(result)
    } catch (err) {
      const normalizedError = normalizeError(err)
      setError(normalizedError.message)
      notify({
        variant: 'danger',
        title: 'Kunne ikke hente spillere',
        description: normalizedError.message
      })
    } finally {
      setLoading(false)
    }
  }, [filters?.q, filters?.active, notify])

  /**
   * Creates a new player.
   * 
   * @param input - Player creation input
   * @returns Created player or null if error occurred
   */
  const createPlayer = useCallback(async (input: PlayerCreateInput): Promise<Player | null> => {
    setError(null)
    
    try {
      const created = await api.players.create(input)
      await loadPlayers() // Reload to get updated list
      notify({
        variant: 'success',
        title: 'Spiller oprettet',
        description: `${created.name} er nu tilføjet`
      })
      return created
    } catch (err) {
      const normalizedError = normalizeError(err)
      setError(normalizedError.message)
      notify({
        variant: 'danger',
        title: 'Kunne ikke oprette spiller',
        description: normalizedError.message
      })
      return null
    }
  }, [loadPlayers, notify])

  /**
   * Updates an existing player.
   * 
   * @param input - Player update input
   * @returns Updated player or null if error occurred
   */
  const updatePlayer = useCallback(async (input: PlayerUpdateInput): Promise<Player | null> => {
    setError(null)
    
    try {
      const updated = await api.players.update(input)
      await loadPlayers() // Reload to get updated list
      notify({
        variant: 'success',
        title: 'Spiller opdateret',
        description: `${updated.name} er nu opdateret`
      })
      return updated
    } catch (err) {
      const normalizedError = normalizeError(err)
      setError(normalizedError.message)
      notify({
        variant: 'danger',
        title: 'Kunne ikke opdatere spiller',
        description: normalizedError.message
      })
      return null
    }
  }, [loadPlayers, notify])

  /**
   * Clears the current error state.
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Load players on mount and when filters change
  useEffect(() => {
    void loadPlayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.q, filters?.active])

  return {
    players,
    loading,
    error,
    refetch: loadPlayers,
    createPlayer,
    updatePlayer,
    clearError
  }
}

