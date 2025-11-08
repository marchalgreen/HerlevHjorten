import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AutoArrangeResult,
  CheckedInPlayer,
  CourtWithPlayers,
  Player,
  TrainingSession
} from '@herlev-hjorten/common'
import api from '../api'
import { PageCard } from '../components/ui'
import { useToast } from '../components/ui/Toast'

/** Default number of slots per court (can be extended to 5-8). */
const EMPTY_SLOTS = 4

/** LocalStorage key for Match Program state persistence. */
const MATCH_PROGRAM_STORAGE_KEY = 'herlev-hjorten-match-program-state'

/** Type for persisted Match Program state. */
type PersistedMatchProgramState = {
  inMemoryMatches: Record<number, CourtWithPlayers[]>
  lockedCourts: Record<number, number[]>
  hasRunAutoMatch: number[]
  extendedCapacityCourts: Array<[number, number]>
  sessionId: string | null
}

/**
 * Loads Match Program state from localStorage.
 * @param sessionId - Current session ID to validate persisted state
 * @returns Persisted state or null if not found/invalid
 */
const loadPersistedState = (sessionId: string | null): Partial<PersistedMatchProgramState> | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(MATCH_PROGRAM_STORAGE_KEY)
    if (!raw) {
      console.log('[MatchProgram] No persisted state found in localStorage')
      return null
    }
    const parsed = JSON.parse(raw) as PersistedMatchProgramState
    
    // If sessionId is null, don't clear - just return null (session might not be loaded yet)
    if (sessionId === null) {
      console.log('[MatchProgram] Session not loaded yet, keeping persisted state:', {
        persistedSessionId: parsed.sessionId,
        rounds: Object.keys(parsed.inMemoryMatches)
      })
      return null
    }
    
    // Only restore if it's for the same session
    if (parsed.sessionId === sessionId) {
      console.log('[MatchProgram] Loaded persisted state:', {
        sessionId: parsed.sessionId,
        rounds: Object.keys(parsed.inMemoryMatches),
        totalMatches: Object.values(parsed.inMemoryMatches).flat().length
      })
      return parsed
    }
    
    // Clear stale state from different session
    console.log('[MatchProgram] Stale state found (different session), clearing:', {
      persistedSessionId: parsed.sessionId,
      currentSessionId: sessionId
    })
    localStorage.removeItem(MATCH_PROGRAM_STORAGE_KEY)
    return null
  } catch (err) {
    console.error('[MatchProgram] Failed to load persisted state:', err)
    return null
  }
}

/**
 * Saves Match Program state to localStorage.
 * @param state - State to persist
 */
const savePersistedState = (state: PersistedMatchProgramState) => {
  if (typeof window === 'undefined') return
  try {
    const serialized = JSON.stringify(state)
    localStorage.setItem(MATCH_PROGRAM_STORAGE_KEY, serialized)
    // Debug: Log what we're saving
    console.log('[MatchProgram] Saved state to localStorage:', {
      sessionId: state.sessionId,
      rounds: Object.keys(state.inMemoryMatches),
      totalMatches: Object.values(state.inMemoryMatches).flat().length
    })
  } catch (err) {
    console.error('[MatchProgram] Failed to save state:', err)
  }
}

/**
 * Clears persisted Match Program state from localStorage.
 */
const clearPersistedState = () => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(MATCH_PROGRAM_STORAGE_KEY)
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Match program page — manages court assignments and player matching for training sessions.
 * @remarks Renders court layout with drag-and-drop, handles auto-matching algorithm,
 * and tracks duplicate matchups across rounds. Delegates data operations to api.matches.
 */
const MatchProgramPage = () => {
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [checkedIn, setCheckedIn] = useState<CheckedInPlayer[]>([])
  const [matches, setMatches] = useState<CourtWithPlayers[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moveMenuPlayer, setMoveMenuPlayer] = useState<string | null>(null)
  const { notify } = useToast()
  const [selectedRound, setSelectedRound] = useState<number>(1)
  const [unavailablePlayers, setUnavailablePlayers] = useState<Set<string>>(new Set())
  const [activatedOneRoundPlayers, setActivatedOneRoundPlayers] = useState<Set<string>>(new Set())
  const [dragOverInactive, setDragOverInactive] = useState(false)
  const [dragOverBench, setDragOverBench] = useState(false)
  const [dragSource, setDragSource] = useState<'bench' | 'inactive' | 'court' | null>(null)
  const [dragOverCourt, setDragOverCourt] = useState<number | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<{ courtIdx: number; slot: number } | null>(null)
  
  // Use refs to track drag state without triggering re-renders
  const dragOverSlotRef = useRef<{ courtIdx: number; slot: number } | null>(null)
  const dragOverCourtRef = useRef<number | null>(null)
  const rafIdRef = useRef<number | null>(null)
  
  // Throttled state update function for drag over events
  const updateDragOverState = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
    }
    rafIdRef.current = requestAnimationFrame(() => {
      setDragOverSlot(dragOverSlotRef.current)
      setDragOverCourt(dragOverCourtRef.current)
      rafIdRef.current = null
    })
  }, [])
  const [recentlySwappedPlayers, setRecentlySwappedPlayers] = useState<Set<string>>(new Set())
  const [previousRoundsVisible, setPreviousRoundsVisible] = useState<Set<number>>(new Set())
  const [previousRoundsMatches, setPreviousRoundsMatches] = useState<Record<number, CourtWithPlayers[]>>({})
  const [popupPosition, setPopupPosition] = useState({ x: 16, y: 16 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  // WHY: Track extended capacity per court (4, 5, 6, 7, or 8 slots)
  const [extendedCapacityCourts, setExtendedCapacityCourts] = useState<Map<number, number>>(new Map())
  // WHY: Track locked courts per round that should not be changed by auto-match/re-shuffle
  const [lockedCourts, setLockedCourts] = useState<Record<number, Set<number>>>({})
  // WHY: Track if auto-match has been run for the current round (to show "Omfordel" button)
  const [hasRunAutoMatch, setHasRunAutoMatch] = useState<Set<number>>(new Set())
  
  // WHY: Track all match changes in memory (per round) - only save to DB on "Afslut træning"
  const [inMemoryMatches, setInMemoryMatches] = useState<Record<number, CourtWithPlayers[]>>({})
  
  // WHY: Track if we've restored persisted state to avoid overwriting it
  const hasRestoredStateRef = useRef(false)
  
  // WHY: Refs to hold latest state values for event handlers (to avoid stale closures)
  const inMemoryMatchesRef = useRef(inMemoryMatches)
  const lockedCourtsRef = useRef(lockedCourts)
  const hasRunAutoMatchRef = useRef(hasRunAutoMatch)
  const extendedCapacityCourtsRef = useRef(extendedCapacityCourts)
  const sessionRef = useRef(session)
  
  // WHY: Keep refs in sync with state
  useEffect(() => {
    inMemoryMatchesRef.current = inMemoryMatches
  }, [inMemoryMatches])
  
  useEffect(() => {
    lockedCourtsRef.current = lockedCourts
  }, [lockedCourts])
  
  useEffect(() => {
    hasRunAutoMatchRef.current = hasRunAutoMatch
  }, [hasRunAutoMatch])
  
  useEffect(() => {
    extendedCapacityCourtsRef.current = extendedCapacityCourts
  }, [extendedCapacityCourts])
  
  useEffect(() => {
    sessionRef.current = session
  }, [session])
  
  // WHY: Track bench collapse state for maximizing court space
  const [benchCollapsed, setBenchCollapsed] = useState(false)
  const [benchCollapsing, setBenchCollapsing] = useState(false)
  
  // WHY: Track full-screen view mode for optimal readability when players gather
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [viewportSize, setViewportSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 1920, height: typeof window !== 'undefined' ? window.innerHeight : 1080 })

  // WHY: Handle ESC key to exit full-screen mode
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false)
      }
    }
    if (isFullScreen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isFullScreen])

  // WHY: Track viewport size for responsive full-screen layout
  useEffect(() => {
    if (!isFullScreen) return

    const updateViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    }

    updateViewportSize()
    window.addEventListener('resize', updateViewportSize)
    return () => window.removeEventListener('resize', updateViewportSize)
  }, [isFullScreen])

  /** Loads active training session from API. */
  const loadSession = useCallback(async () => {
    try {
      const active = await api.session.getActive()
      setSession(active)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente træning')
    }
  }, [])

  /** Loads checked-in players for current session. */
  const loadCheckIns = async () => {
    if (!session) {
      setCheckedIn([])
      return
    }
    try {
      const data = await api.checkIns.listActive()
      setCheckedIn(data)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente fremmøde')
    }
  }

  /** Loads court assignments for selected round. Ensures all 8 courts are always present. */
  const loadMatches = async () => {
    if (!session) {
      // Even without session, show all 8 empty courts
      const allCourts: CourtWithPlayers[] = Array.from({ length: 8 }, (_, i) => ({
        courtIdx: i + 1,
        slots: []
      }))
      setMatches(allCourts)
      return
    }
    try {
      // Check in-memory state first (it should already be restored from persisted state)
      // Use ref to get the latest value in case React state hasn't updated yet
      const currentInMemoryMatches = inMemoryMatchesRef.current
      if (currentInMemoryMatches[selectedRound]) {
        // Use in-memory state - ensure all 8 courts are present
        const currentMatches = currentInMemoryMatches[selectedRound]
        const allCourts = Array.from({ length: 8 }, (_, i) => i + 1)
        const matchesByCourt = new Map(currentMatches.map((court) => [court.courtIdx, court]))
        const data = allCourts.map((courtIdx) => {
          const existing = matchesByCourt.get(courtIdx)
          return existing || { courtIdx, slots: [] }
        })
        setMatches(data)
        return
      }
      
      // If in-memory state doesn't have this round, check persisted state as fallback
      // This can happen if restoration hasn't completed yet or if data was lost
      const persisted = loadPersistedState(session.id)
      if (persisted?.inMemoryMatches?.[selectedRound]) {
        // Use persisted state - ensure all 8 courts are present
        const persistedMatches = persisted.inMemoryMatches[selectedRound]
        const allCourts = Array.from({ length: 8 }, (_, i) => i + 1)
        const matchesByCourt = new Map(persistedMatches.map((court) => [court.courtIdx, court]))
        const data = allCourts.map((courtIdx) => {
          const existing = matchesByCourt.get(courtIdx)
          return existing || { courtIdx, slots: [] }
        })
        // Restore to in-memory state
        setInMemoryMatches((prev) => ({ ...prev, [selectedRound]: data }))
        setMatches(data)
        return
      }
      
      // Fall back to database
      const data = await api.matches.list(selectedRound)
      // Ensure all 8 courts are present
      const allCourts = Array.from({ length: 8 }, (_, i) => i + 1)
      const matchesByCourt = new Map(data.map((court) => [court.courtIdx, court]))
      const completeData = allCourts.map((courtIdx) => {
        const existing = matchesByCourt.get(courtIdx)
        return existing || { courtIdx, slots: [] }
      })
      setInMemoryMatches((prev) => ({ ...prev, [selectedRound]: completeData }))
      setMatches(completeData)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente baner')
    }
  }
  
  // WHY: Helper function to save state to localStorage (accepts state values as parameters)
  // Defined early so it can be used by updateInMemoryMatches
  const saveCurrentState = useCallback((
    matches: Record<number, CourtWithPlayers[]>,
    locked: Record<number, Set<number>>,
    autoMatch: Set<number>,
    extended: Map<number, number>
  ) => {
    const currentSession = sessionRef.current
    if (!currentSession) {
      console.log('[MatchProgram] saveCurrentState: No session, skipping save')
      return
    }
    if (!hasRestoredStateRef.current) {
      console.log('[MatchProgram] saveCurrentState: Restoration not complete, skipping save')
      return
    }
    
    // Convert Sets and Maps to serializable formats
    const lockedCourtsSerializable: Record<number, number[]> = {}
    for (const [round, courtSet] of Object.entries(locked)) {
      lockedCourtsSerializable[Number(round)] = Array.from(courtSet)
    }
    
    const extendedCapacityCourtsSerializable: Array<[number, number]> = Array.from(extended.entries())
    
    const stateToPersist: PersistedMatchProgramState = {
      inMemoryMatches: matches,
      lockedCourts: lockedCourtsSerializable,
      hasRunAutoMatch: Array.from(autoMatch),
      extendedCapacityCourts: extendedCapacityCourtsSerializable,
      sessionId: currentSession.id
    }
    
    console.log('[MatchProgram] saveCurrentState called:', {
      sessionId: currentSession.id,
      rounds: Object.keys(matches),
      hasMatches: Object.values(matches).some(round => round.some(court => court.slots.length > 0))
    })
    
    savePersistedState(stateToPersist)
  }, [])

  /** Updates in-memory matches for a specific round. Ensures all 8 courts are always present. */
  const updateInMemoryMatches = useCallback((round: number, newMatches: CourtWithPlayers[]) => {
    // Ensure all 8 courts are always present (1-8)
    const allCourts = Array.from({ length: 8 }, (_, i) => i + 1)
    const matchesByCourt = new Map(newMatches.map((court) => [court.courtIdx, court]))
    
    // Build complete matches array with all 8 courts
    const completeMatches: CourtWithPlayers[] = allCourts.map((courtIdx) => {
      const existing = matchesByCourt.get(courtIdx)
      return existing || { courtIdx, slots: [] }
    })
    
    // Update state and immediately save to localStorage to prevent data loss
    setInMemoryMatches((prev) => {
      const updated = { ...prev, [round]: completeMatches }
      // Immediately save using the updated state we're about to set
      // This ensures data is saved even if component unmounts before useEffect runs
      // Use refs for other state variables to ensure we get the latest values
      if (session && hasRestoredStateRef.current) {
        // Save synchronously with the updated state value and latest ref values
        saveCurrentState(
          updated,
          lockedCourtsRef.current,
          hasRunAutoMatchRef.current,
          extendedCapacityCourtsRef.current
        )
      }
      return updated
    })
    if (round === selectedRound) {
      setMatches(completeMatches)
    }
  }, [selectedRound, session, saveCurrentState])

  /** Initializes page state — loads session and players. */
  const hydrate = useCallback(async () => {
    setLoading(true)
    setError(null)
    await loadSession()
    setLoading(false)
  }, [loadSession])

  // WHY: Initialize page on mount; deps are stable callbacks
  useEffect(() => { void hydrate() }, [hydrate])

  // WHY: Load persisted state when session is available, then load matches
  useEffect(() => {
    if (!session) {
      // Don't clear persisted state if session is null - it might just be loading
      // Only clear if we're sure there's no active session (e.g., after ending training)
      // For now, just reset local state but keep persisted state in localStorage
      setMatches([])
      setCheckedIn([])
      hasRestoredStateRef.current = false
      return
    }
    
    // Only restore state once per session
    if (!hasRestoredStateRef.current) {
      // Load persisted state for this session
      const persisted = loadPersistedState(session.id)
      if (persisted) {
        // Restore inMemoryMatches - restore ALL rounds, not just selectedRound
        if (persisted.inMemoryMatches && Object.keys(persisted.inMemoryMatches).length > 0) {
          setInMemoryMatches(persisted.inMemoryMatches)
          // Update ref immediately so loadMatches can use it
          inMemoryMatchesRef.current = persisted.inMemoryMatches
        }
        
        // Restore lockedCourts (convert arrays back to Sets)
        if (persisted.lockedCourts) {
          const restored: Record<number, Set<number>> = {}
          for (const [round, courtIndices] of Object.entries(persisted.lockedCourts)) {
            restored[Number(round)] = new Set(courtIndices)
          }
          setLockedCourts(restored)
          // Update ref immediately
          lockedCourtsRef.current = restored
        }
        
        // Restore hasRunAutoMatch (convert array back to Set)
        if (persisted.hasRunAutoMatch) {
          const restored = new Set(persisted.hasRunAutoMatch)
          setHasRunAutoMatch(restored)
          // Update ref immediately
          hasRunAutoMatchRef.current = restored
        }
        
        // Restore extendedCapacityCourts (convert array of tuples back to Map)
        if (persisted.extendedCapacityCourts) {
          const restored = new Map(persisted.extendedCapacityCourts)
          setExtendedCapacityCourts(restored)
          // Update ref immediately
          extendedCapacityCourtsRef.current = restored
        }
        
        // Mark restoration as complete AFTER setting all state and refs
        hasRestoredStateRef.current = true
        // Load matches immediately after restoration (refs are now synced)
        void loadMatches()
      } else {
        // No persisted state, mark as restored immediately
        hasRestoredStateRef.current = true
        // Load matches immediately if no persisted state
        void loadMatches()
      }
    } else {
      // Restoration already complete, just load matches for the selected round
      void loadMatches()
    }
    
    // Always load check-ins
    void loadCheckIns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, selectedRound])

  // WHY: Persist state to localStorage whenever it changes (passes actual state values)
  useEffect(() => {
    if (!session) return
    
    // Don't persist if we're currently restoring state (to avoid overwriting with empty state)
    if (!hasRestoredStateRef.current) {
      // Still restoring, wait for restoration to complete
      return
    }
    
    // Pass actual state values directly to avoid race conditions with refs
    saveCurrentState(inMemoryMatches, lockedCourts, hasRunAutoMatch, extendedCapacityCourts)
  }, [session, inMemoryMatches, lockedCourts, hasRunAutoMatch, extendedCapacityCourts, saveCurrentState])

  // WHY: Save state when component unmounts or user navigates away (uses refs for event handlers)
  useEffect(() => {
    if (!session || !hasRestoredStateRef.current) return

    // Save state when page is about to unload
    const handleBeforeUnload = () => {
      // Use refs for event handlers (they're always synced via separate useEffects)
      saveCurrentState(
        inMemoryMatchesRef.current,
        lockedCourtsRef.current,
        hasRunAutoMatchRef.current,
        extendedCapacityCourtsRef.current
      )
    }

    // Save state when page becomes hidden (e.g., user switches tabs or navigates away)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentState(
          inMemoryMatchesRef.current,
          lockedCourtsRef.current,
          hasRunAutoMatchRef.current,
          extendedCapacityCourtsRef.current
        )
      }
    }

    // Save state when page is being unloaded (for modern browsers)
    const handlePageHide = () => {
      saveCurrentState(
        inMemoryMatchesRef.current,
        lockedCourtsRef.current,
        hasRunAutoMatchRef.current,
        extendedCapacityCourtsRef.current
      )
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    // Cleanup: save state when component unmounts
    return () => {
      saveCurrentState(
        inMemoryMatchesRef.current,
        lockedCourtsRef.current,
        hasRunAutoMatchRef.current,
        extendedCapacityCourtsRef.current
      )
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [session, saveCurrentState])


  // WHY: Close dropdown when round changes to avoid stale state
  useEffect(() => {
    setMoveMenuPlayer(null)
  }, [selectedRound])

  // WHY: Close dropdown when clicking outside — uses event delegation
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moveMenuPlayer && !(event.target as Element).closest('[data-flyt-menu]')) {
        setMoveMenuPlayer(null)
      }
    }

    if (moveMenuPlayer) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [moveMenuPlayer])

  /** Memoized Set of player IDs currently assigned to courts. */
  const assignedIds = useMemo(() => {
    const ids = new Set<string>()
    matches.forEach((court: CourtWithPlayers) => {
      court.slots.forEach(({ player }: { player: Player }) => ids.add(player.id))
    })
    return ids
  }, [matches])

  /** Memoized bench players — excludes assigned, one-round-only (rounds 2+), and unavailable players. */
  const bench = useMemo(
    () => checkedIn
      .filter((player) => {
        // Exclude players already assigned to a court
        if (assignedIds.has(player.id)) return false
        // Exclude players who only want to play 1 round if we're viewing rounds 2 or 3
        // UNLESS they've been manually activated
        if (selectedRound > 1 && player.maxRounds === 1 && !activatedOneRoundPlayers.has(player.id)) return false
        // Exclude players marked as unavailable/injured
        if (unavailablePlayers.has(player.id)) return false
        return true
      })
      .sort((a, b) => {
        // Primary sort: Gender (Dame first, Herre second, then null/undefined)
        const genderOrder: Record<string, number> = { Dame: 1, Herre: 2 }
        const genderA = genderOrder[a.gender ?? ''] ?? 3
        const genderB = genderOrder[b.gender ?? ''] ?? 3
        if (genderA !== genderB) {
          return genderA - genderB
        }
        
        // Secondary sort: PlayingCategory (Double first, Begge second, Single last, then null/undefined)
        const categoryOrder: Record<string, number> = { Double: 1, Begge: 2, Single: 3 }
        const categoryA = categoryOrder[a.primaryCategory ?? ''] ?? 4
        const categoryB = categoryOrder[b.primaryCategory ?? ''] ?? 4
        return categoryA - categoryB
      }),
    [checkedIn, assignedIds, selectedRound, unavailablePlayers, activatedOneRoundPlayers]
  )

  /** Memoized inactive players — includes one-round-only (rounds 2+) and unavailable players. */
  const inactivePlayers = useMemo(
    () => checkedIn
      .filter((player) => {
        // Exclude players already assigned to a court
        if (assignedIds.has(player.id)) return false
        // Include players who only want to play 1 round if we're viewing rounds 2 or 3
        // UNLESS they've been manually activated
        const isOneRoundOnly = selectedRound > 1 && player.maxRounds === 1 && !activatedOneRoundPlayers.has(player.id)
        // Include players marked as unavailable/injured
        const isUnavailable = unavailablePlayers.has(player.id)
        return isOneRoundOnly || isUnavailable
      })
      .sort((a, b) => {
        // Primary sort: Gender (Dame first, Herre second, then null/undefined)
        const genderOrder: Record<string, number> = { Dame: 1, Herre: 2 }
        const genderA = genderOrder[a.gender ?? ''] ?? 3
        const genderB = genderOrder[b.gender ?? ''] ?? 3
        if (genderA !== genderB) {
          return genderA - genderB
        }
        
        // Secondary sort: PlayingCategory (Double first, Begge second, Single last, then null/undefined)
        const categoryOrder: Record<string, number> = { Double: 1, Begge: 2, Single: 3 }
        const categoryA = categoryOrder[a.primaryCategory ?? ''] ?? 4
        const categoryB = categoryOrder[b.primaryCategory ?? ''] ?? 4
        return categoryA - categoryB
      }),
    [checkedIn, assignedIds, selectedRound, unavailablePlayers, activatedOneRoundPlayers]
  )

  /** Marks player as unavailable/inactive. */
  const handleMarkUnavailable = (playerId: string) => {
    setUnavailablePlayers((prev) => new Set(prev).add(playerId))
  }

  /** Marks player as available (removes from unavailable set). */
  const handleMarkAvailable = (playerId: string) => {
    setUnavailablePlayers((prev) => {
      const newSet = new Set(prev)
      newSet.delete(playerId)
      return newSet
    })
  }

  /** Activates a "Kun 1 runde" player by moving them to bench. */
  const handleActivateOneRoundPlayer = async (playerId: string) => {
    if (!session) return
    try {
      // Ensure player is not on a court
      await handleMove(playerId)
      // Also ensure they're not marked as unavailable
      if (unavailablePlayers.has(playerId)) {
        handleMarkAvailable(playerId)
      }
      // Add to activated one-round players set so they appear in bench
      setActivatedOneRoundPlayers((prev) => new Set(prev).add(playerId))
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke aktivere spiller')
    }
  }

  const genderBreakdown = useMemo(() => {
    const male = checkedIn.filter((player) => player.gender === 'Herre').length
    const female = checkedIn.filter((player) => player.gender === 'Dame').length
    return { male, female }
  }, [checkedIn])

  /**
   * Loads matches for a previous round (for duplicate detection).
   * Uses in-memory matches first, then falls back to database.
   * @param round - Round number to load
   */
  const loadPreviousRound = useCallback(async (round: number) => {
    if (!session || round >= selectedRound || round < 1) return
    if (previousRoundsMatches[round]) return // Already loaded
    
    try {
      // First check in-memory matches (current session changes)
      let data: CourtWithPlayers[]
      if (inMemoryMatches[round]) {
        data = inMemoryMatches[round]
      } else {
        // Fall back to database (for rounds from previous sessions or if not in memory)
        data = await api.matches.list(round)
        // Ensure all 8 courts are present
        const allCourts = Array.from({ length: 8 }, (_, i) => i + 1)
        const matchesByCourt = new Map(data.map((court) => [court.courtIdx, court]))
        data = allCourts.map((courtIdx) => {
          const existing = matchesByCourt.get(courtIdx)
          return existing || { courtIdx, slots: [] }
        })
      }
      setPreviousRoundsMatches((prev) => ({ ...prev, [round]: data }))
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente tidligere runde')
    }
  }, [session, selectedRound, previousRoundsMatches, inMemoryMatches])

  /**
   * Syncs in-memory matches to previousRoundsMatches when they change,
   * so "Se tidligere runder" always shows the latest data.
   */
  useEffect(() => {
    // Update previousRoundsMatches for any rounds that are in inMemoryMatches
    // and are previous rounds (round < selectedRound)
    const updates: Record<number, CourtWithPlayers[]> = {}
    for (let round = 1; round < selectedRound; round++) {
      if (inMemoryMatches[round]) {
        updates[round] = inMemoryMatches[round]
      }
    }
    if (Object.keys(updates).length > 0) {
      setPreviousRoundsMatches((prev) => ({ ...prev, ...updates }))
    }
  }, [inMemoryMatches, selectedRound])

  /**
   * Checks if 3+ players on a court have played together in previous rounds.
   * @param court - Court to check for duplicates
   * @returns true if duplicate matchup found (3+ same players)
   */
  const hasDuplicateMatchup = useCallback(async (court: CourtWithPlayers): Promise<boolean> => {
    if (selectedRound <= 1) return false // No previous rounds to check
    
    const currentPlayerIds = court.slots
      .map((slot) => slot.player?.id)
      .filter((id): id is string => !!id)
    
    if (currentPlayerIds.length < 3) return false // Need at least 3 players
    
    // Load all previous rounds if not already loaded
    for (let round = 1; round < selectedRound; round++) {
      if (!previousRoundsMatches[round]) {
        await loadPreviousRound(round)
      }
    }
    
    // Wait a bit for state to update after loading
    await new Promise((resolve) => setTimeout(resolve, 50))
    
    // Re-fetch previous rounds matches from state - use in-memory matches if available
    const updatedPreviousRounds = { ...previousRoundsMatches }
    
    // Check each previous round
    for (let round = 1; round < selectedRound; round++) {
      let previousMatches = updatedPreviousRounds[round]
      
      // If still not loaded, try loading - check in-memory first
      if (!previousMatches) {
        try {
          // First check in-memory matches (current session changes)
          if (inMemoryMatches[round]) {
            previousMatches = inMemoryMatches[round]
            updatedPreviousRounds[round] = previousMatches
          } else {
            // Fall back to database
            const data = await api.matches.list(round)
            // Ensure all 8 courts are present
            const allCourts = Array.from({ length: 8 }, (_, i) => i + 1)
            const matchesByCourt = new Map(data.map((court) => [court.courtIdx, court]))
            previousMatches = allCourts.map((courtIdx) => {
              const existing = matchesByCourt.get(courtIdx)
              return existing || { courtIdx, slots: [] }
            })
            updatedPreviousRounds[round] = previousMatches
          }
        } catch {
          continue
        }
      }
      
      if (!previousMatches) continue
      
      for (const previousCourt of previousMatches) {
        const previousPlayerIds = previousCourt.slots
          .map((slot) => slot.player?.id)
          .filter((id): id is string => !!id)
        
        // Count how many players from current court were in previous court
        const overlap = currentPlayerIds.filter((id) => previousPlayerIds.includes(id))
        
        if (overlap.length >= 3) {
          return true // Found a duplicate match with 3+ same players
        }
      }
    }
    
    return false
  }, [selectedRound, previousRoundsMatches, loadPreviousRound])

  const [courtsWithDuplicatesSet, setCourtsWithDuplicatesSet] = useState<Set<number>>(new Set())
  const [duplicatePlayersMap, setDuplicatePlayersMap] = useState<Map<number, Set<string>>>(new Map())

  // WHY: Check for duplicate matchups when matches or round changes — loads previous rounds as needed
  useEffect(() => {
    if (selectedRound <= 1) {
      setCourtsWithDuplicatesSet(new Set())
      setDuplicatePlayersMap(new Map())
      return
    }
    
    if (matches.length === 0) {
      setCourtsWithDuplicatesSet(new Set())
      setDuplicatePlayersMap(new Map())
      return
    }
    
    const checkDuplicates = async () => {
      const duplicates = new Set<number>()
      const playerDuplicatesMap = new Map<number, Set<string>>()
      
      // Load all previous rounds first - use in-memory matches if available
      for (let round = 1; round < selectedRound; round++) {
        if (!previousRoundsMatches[round]) {
          try {
            // First check in-memory matches (current session changes)
            let data: CourtWithPlayers[]
            if (inMemoryMatches[round]) {
              data = inMemoryMatches[round]
            } else {
              // Fall back to database (for rounds from previous sessions or if not in memory)
              data = await api.matches.list(round)
              // Ensure all 8 courts are present
              const allCourts = Array.from({ length: 8 }, (_, i) => i + 1)
              const matchesByCourt = new Map(data.map((court) => [court.courtIdx, court]))
              data = allCourts.map((courtIdx) => {
                const existing = matchesByCourt.get(courtIdx)
                return existing || { courtIdx, slots: [] }
              })
            }
            setPreviousRoundsMatches((prev) => ({ ...prev, [round]: data }))
          } catch {
            // Continue even if one round fails to load
          }
        }
      }
      
      // Wait for state to update
      await new Promise((resolve) => setTimeout(resolve, 100))
      
      // Now check duplicates
      for (const court of matches) {
        const currentPlayerIds = court.slots
          .map((slot) => slot.player?.id)
          .filter((id): id is string => !!id)
        
        if (currentPlayerIds.length < 3) continue
        
        // Check all previous rounds
        let duplicatePlayerIds = new Set<string>()
        
        for (let round = 1; round < selectedRound; round++) {
          // Get previous matches - try in-memory first, then state, then API
          let previousMatches = inMemoryMatches[round] || previousRoundsMatches[round]
          if (!previousMatches) {
            try {
              const data = await api.matches.list(round)
              // Ensure all 8 courts are present
              const allCourts = Array.from({ length: 8 }, (_, i) => i + 1)
              const matchesByCourt = new Map(data.map((court) => [court.courtIdx, court]))
              previousMatches = allCourts.map((courtIdx) => {
                const existing = matchesByCourt.get(courtIdx)
                return existing || { courtIdx, slots: [] }
              })
            } catch {
              continue
            }
          }
          
          if (!previousMatches) continue
          
          for (const previousCourt of previousMatches) {
            const previousPlayerIds = previousCourt.slots
              .map((slot) => slot.player?.id)
              .filter((id): id is string => !!id)
            
            const overlap = currentPlayerIds.filter((id) => previousPlayerIds.includes(id))
            
            if (overlap.length >= 3) {
              duplicates.add(court.courtIdx)
              // Track which players are duplicates - add all overlapping players
              overlap.forEach((id) => duplicatePlayerIds.add(id))
            }
          }
        }
        
        if (duplicatePlayerIds.size > 0) {
          playerDuplicatesMap.set(court.courtIdx, duplicatePlayerIds)
        }
      }
      
      setCourtsWithDuplicatesSet(duplicates)
      setDuplicatePlayersMap(playerDuplicatesMap)
    }
    
    void checkDuplicates()
  }, [matches, selectedRound, previousRoundsMatches])

  /** Starts a new training session or gets existing active session. */
  const handleStartTraining = async () => {
    try {
      const active = await api.session.startOrGetActive()
      setSession(active)
      notify({ variant: 'success', title: 'Træning startet' })
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke starte træning')
    }
  }

  /** Ends active training session and saves only the final match state to database. */
  const handleEndTraining = async () => {
    if (!session) return
    try {
      // Collect only the final match state from in-memory matches (no database fallback)
      // Only save rounds that actually have matches (non-empty courts with players)
      const allMatchesData: Array<{ round: number; matches: CourtWithPlayers[] }> = []
      for (let round = 1; round <= 4; round++) {
        const roundMatches = inMemoryMatches[round]
        // Only include rounds that have matches with actual players
        if (roundMatches && roundMatches.length > 0) {
          // Filter out empty courts (courts with no players)
          const nonEmptyMatches = roundMatches.filter((court) => 
            court.slots.length > 0 && court.slots.some((slot) => slot.player !== null && slot.player !== undefined)
          )
          if (nonEmptyMatches.length > 0) {
            allMatchesData.push({ round, matches: nonEmptyMatches })
          }
        }
      }
      
      // Save only the final match state to database and end session
      await api.session.endActive(allMatchesData)
      setSession(null)
      setInMemoryMatches({}) // Clear in-memory state
      setLockedCourts({}) // Clear locked courts
      setHasRunAutoMatch(new Set()) // Clear auto-match flags
      setExtendedCapacityCourts(new Map()) // Clear extended capacity
      hasRestoredStateRef.current = false // Reset restoration flag
      clearPersistedState() // Clear persisted state from localStorage
      notify({ variant: 'success', title: 'Træning afsluttet' })
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke afslutte træning')
    }
  }

  /** Handles mouse down on popup header for dragging. */
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return // Don't drag if clicking buttons
    setIsDragging(true)
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  // WHY: Track mouse move/up events for popup dragging — constrains to viewport
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      
      // Constrain to viewport
      const maxX = window.innerWidth - 400 // popup width
      const maxY = window.innerHeight - 100 // minimum popup height
      
      setPopupPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  /** Gets courts with players (occupied courts) - these should be excluded from auto-match */
  const occupiedCourts = useMemo(() => {
    const occupied = new Set<number>()
    matches.forEach((court) => {
      if (court.slots.some((slot) => slot.player)) {
        occupied.add(court.courtIdx)
      }
    })
    return occupied
  }, [matches])
  
  /** Gets locked courts for the current round. */
  const currentRoundLockedCourts = useMemo(() => {
    return lockedCourts[selectedRound] || new Set<number>()
  }, [selectedRound, lockedCourts])
  
  /** Gets all courts that should be excluded from auto-match: manually locked + occupied */
  const excludedCourts = useMemo(() => {
    const excluded = new Set(currentRoundLockedCourts)
    // Also exclude occupied courts (courts with players)
    occupiedCourts.forEach((courtIdx) => excluded.add(courtIdx))
    return excluded
  }, [currentRoundLockedCourts, occupiedCourts])

  /** Triggers auto-matching algorithm for selected round. */
  const handleAutoMatch = async () => {
    if (!session) return
    try {
      // Check if this is a re-shuffle (button says "Omfordel") BEFORE marking as run
      const isReshuffle = hasRunAutoMatch.has(selectedRound)
      
      // For initial auto-match: auto-lock courts that already have players
      let courtsToExclude: Set<number>
      if (!isReshuffle) {
        const currentMatchesForAutoLock = inMemoryMatches[selectedRound] || []
        const courtsToAutoLock = new Set<number>()
        
        // Find courts with players (any players in any slots)
        currentMatchesForAutoLock.forEach((court) => {
          if (court.slots.some((slot) => slot.player)) {
            courtsToAutoLock.add(court.courtIdx)
          }
        })
        
        // Auto-lock these courts for this round
        if (courtsToAutoLock.size > 0) {
          setLockedCourts((prev) => {
            const roundLocks = prev[selectedRound] || new Set<number>()
            const newSet = new Set(roundLocks)
            courtsToAutoLock.forEach((courtIdx) => newSet.add(courtIdx))
            return { ...prev, [selectedRound]: newSet }
          })
        }
        
        // For initial auto-match: exclude all occupied courts (they're now auto-locked)
        // Combine manually locked courts with auto-locked courts
        const allLockedCourts = new Set(currentRoundLockedCourts)
        courtsToAutoLock.forEach((courtIdx) => allLockedCourts.add(courtIdx))
        courtsToExclude = allLockedCourts
      } else {
        // For reshuffle: only exclude manually locked courts
        courtsToExclude = currentRoundLockedCourts
      }
      
      // Mark that auto-match has been run for this round
      setHasRunAutoMatch((prev) => new Set(prev).add(selectedRound))
      
      // Call auto-arrange - it now returns matches in memory (no DB writes)
      // Pass current in-memory matches so it can identify players on locked courts
      const currentMatchesForApi = inMemoryMatches[selectedRound] || []
      const { matches: newMatches, result } = await api.matches.autoArrange(selectedRound, unavailablePlayers, activatedOneRoundPlayers, courtsToExclude, isReshuffle, currentMatchesForApi)
      
      // Merge new matches with existing courts
      // For initial auto-match: keep all occupied courts (they're auto-locked) and add new matches
      // For reshuffle: keep manually locked courts and add new matches
      const currentMatchesForMerge = inMemoryMatches[selectedRound] || []
      const keptCourtsMatches = currentMatchesForMerge.filter((court) => courtsToExclude.has(court.courtIdx))
      // Merge: keep existing courts, add new matches (excluding court indices that are being kept)
      const newMatchesWithoutKept = newMatches.filter((court) => !courtsToExclude.has(court.courtIdx))
      const finalMatches = [...keptCourtsMatches, ...newMatchesWithoutKept]
      
      // Update in-memory state with the final matches
      updateInMemoryMatches(selectedRound, finalMatches)
      await loadCheckIns()
      
      notify({ 
        variant: 'success', 
        title: isReshuffle
          ? `Omfordelt spillere på ${result.filledCourts} baner (Runde ${selectedRound})`
          : `Fordelte spillere på ${result.filledCourts} baner (Runde ${selectedRound})` 
      })
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke matche spillere')
    }
  }

  /** Toggles lock state for a court in the current round. */
  const handleToggleCourtLock = (courtIdx: number) => {
    setLockedCourts((prev) => {
      const roundLocks = prev[selectedRound] || new Set<number>()
      const newSet = new Set(roundLocks)
      if (newSet.has(courtIdx)) {
        newSet.delete(courtIdx)
      } else {
        newSet.add(courtIdx)
      }
      return { ...prev, [selectedRound]: newSet }
    })
  }

  /** Resets all court assignments for current session, respecting locked courts (in-memory only). */
  const handleResetMatches = async () => {
    if (!session) return
    try {
      // Reset in-memory state only - no database write
      const currentMatches = inMemoryMatches[selectedRound] || []
      // Ensure all 8 courts are present
      const allCourts = Array.from({ length: 8 }, (_, i) => i + 1)
      const matchesByCourt = new Map(currentMatches.map((court) => [court.courtIdx, court]))
      
      const updatedMatches: CourtWithPlayers[] = allCourts.map((courtIdx) => {
        const existing = matchesByCourt.get(courtIdx)
        // If court is locked in current round, keep it as is
        if (currentRoundLockedCourts.has(courtIdx) && existing) {
          return existing
        }
        // Otherwise, clear all slots (or create empty court)
        return existing ? { ...existing, slots: [] } : { courtIdx, slots: [] }
      })
      
      updateInMemoryMatches(selectedRound, updatedMatches)
      await loadCheckIns()
      
      notify({ 
        variant: 'success', 
        title: 'Kampe nulstillet (låste baner bevares)' 
      })
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke nulstille kampe')
    }
  }

  /**
   * Moves player to court/slot or removes from court (in-memory only, no DB write).
   * @param playerId - Player ID to move
   * @param courtIdx - Target court index (undefined = remove from court)
   * @param slot - Target slot index (required if courtIdx provided)
   */
  const handleMove = async (playerId: string, courtIdx?: number, slot?: number) => {
    if (!session) return
    try {
      // Update in-memory state only - no database write
      const currentMatches = inMemoryMatches[selectedRound] || await api.matches.list(selectedRound)
      const player = checkedIn.find((p) => p.id === playerId)
      if (!player) return

      const updatedMatches = currentMatches.map((court) => {
        // Remove player from all courts first
        const updatedSlots = court.slots.filter((s) => s.player?.id !== playerId)
        
        // If this is the target court, add player to the target slot
        if (courtIdx !== undefined && court.courtIdx === courtIdx && slot !== undefined) {
          // Check if slot is occupied
          const slotEntry = updatedSlots.find((s) => s.slot === slot)
          if (!slotEntry) {
            // Slot is empty, add player
            updatedSlots.push({ slot, player })
          } else if (slotEntry.player?.id !== playerId) {
            // Slot is occupied by different player - swap them
            const swappedPlayer = slotEntry.player
            updatedSlots.push({ slot, player })
            // Add swapped player to the source location (if we know it)
            // For now, just remove the occupying player (they'll be on bench)
          }
        }
        
        return { ...court, slots: updatedSlots }
      })

      // Ensure all 8 courts are present (fill in missing courts)
      const allCourts = Array.from({ length: 8 }, (_, i) => i + 1)
      const matchesByCourt = new Map(updatedMatches.map((court) => [court.courtIdx, court]))
      
      // If adding to a new court that doesn't exist yet, create it
      if (courtIdx !== undefined && slot !== undefined) {
        if (!matchesByCourt.has(courtIdx)) {
          matchesByCourt.set(courtIdx, { courtIdx, slots: [{ slot, player }] })
        }
      }
      
      // Build complete matches array with all 8 courts
      const completeMatches: CourtWithPlayers[] = allCourts.map((idx) => {
        const existing = matchesByCourt.get(idx)
        return existing || { courtIdx: idx, slots: [] }
      })

      updateInMemoryMatches(selectedRound, completeMatches)
      await loadCheckIns()
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke flytte spiller')
    }
  }

  /** Handles drop to bench — moves player to bench and marks as available. */
  const onDropToBench = async (event: React.DragEvent<HTMLDivElement>) => {
    const playerId = event.dataTransfer.getData('application/x-player-id')
    if (!playerId) return
    event.preventDefault()
    // First move to bench if they're on a court
    await handleMove(playerId)
    // If they were marked as unavailable/inactive, reactivate them
    if (unavailablePlayers.has(playerId)) {
      handleMarkAvailable(playerId)
    }
  }

  /** Handles drop to inactive — moves player to bench and marks as unavailable. */
  const onDropToInactive = async (event: React.DragEvent<HTMLDivElement>) => {
    const playerId = event.dataTransfer.getData('application/x-player-id')
    if (!playerId) return
    event.preventDefault()
    // First move to bench if they're on a court
    await handleMove(playerId)
    // Then mark as unavailable/inactive
    handleMarkUnavailable(playerId)
  }

  /**
   * Handles drop to court slot — supports swapping if slot is occupied (in-memory only).
   * @param event - Drag event
   * @param courtIdx - Target court index
   * @param slot - Target slot index
   */
  const onDropToSlot = async (
    event: React.DragEvent<HTMLElement>,
    courtIdx: number,
    slot: number
  ) => {
    const playerId = event.dataTransfer.getData('application/x-player-id')
    if (!playerId) return
    event.preventDefault()
    
    // Check if the target slot is occupied
    const currentMatches = inMemoryMatches[selectedRound] || matches
    const targetCourt = currentMatches.find((c) => c.courtIdx === courtIdx)
    const targetSlotEntry = targetCourt?.slots.find((s) => s.slot === slot)
    const occupyingPlayer = targetSlotEntry?.player
    
    // Get source location from drag data
    const sourceCourtIdxStr = event.dataTransfer.getData('application/x-source-court-idx')
    const sourceSlotStr = event.dataTransfer.getData('application/x-source-slot')
    const sourceCourtIdx = sourceCourtIdxStr ? Number(sourceCourtIdxStr) : undefined
    const sourceSlot = sourceSlotStr ? Number(sourceSlotStr) : undefined
    
    const player = checkedIn.find((p) => p.id === playerId)
    if (!player) return

    if (occupyingPlayer && occupyingPlayer.id !== playerId) {
      // Slot is occupied by a different player - swap them in memory
      const updatedMatches = currentMatches.map((court) => {
        if (court.courtIdx === courtIdx) {
          // Target court - handle swap
          if (sourceCourtIdx === courtIdx && sourceSlot !== undefined) {
            // Same court swap - directly swap the two players
            const updatedSlots = court.slots.map((s) => {
              if (s.slot === slot) {
                // Target slot - place dragged player here
                return { slot: s.slot, player }
              } else if (s.slot === sourceSlot) {
                // Source slot - place occupying player here
                return { slot: s.slot, player: occupyingPlayer }
              }
              // Keep other slots unchanged
              return s
            })
            return { ...court, slots: updatedSlots }
          } else {
            // Different court swap - remove dragged player, add occupying player to source
            const updatedSlots = court.slots
              .filter((s) => s.slot !== slot && s.player?.id !== playerId)
              .map((s) => {
                // If this is the source slot and we have source info, place occupying player here
                if (sourceCourtIdx === courtIdx && sourceSlot !== undefined && s.slot === sourceSlot) {
                  return { slot: s.slot, player: occupyingPlayer }
                }
                return s
              })
            
            // Add dragged player to target slot
            updatedSlots.push({ slot, player })
            
            // If source slot doesn't exist in the filtered list, add it
            if (sourceCourtIdx === courtIdx && sourceSlot !== undefined && !updatedSlots.find((s) => s.slot === sourceSlot)) {
              updatedSlots.push({ slot: sourceSlot, player: occupyingPlayer })
            }
            
            return { ...court, slots: updatedSlots }
          }
        } else if (sourceCourtIdx !== undefined && court.courtIdx === sourceCourtIdx) {
          // Source court (different from target) - remove dragged player, add occupying player if swapping
          const updatedSlots = court.slots
            .filter((s) => s.player?.id !== playerId)
            .map((s) => {
              if (sourceSlot !== undefined && s.slot === sourceSlot && occupyingPlayer) {
                return { slot: s.slot, player: occupyingPlayer }
              }
              return s
            })
          
          // If source slot doesn't exist, add it
          if (sourceSlot !== undefined && !updatedSlots.find((s) => s.slot === sourceSlot) && occupyingPlayer) {
            updatedSlots.push({ slot: sourceSlot, player: occupyingPlayer })
          }
          
          return { ...court, slots: updatedSlots }
        } else {
          // Other courts - just remove dragged player
          return { ...court, slots: court.slots.filter((s) => s.player?.id !== playerId) }
        }
      })

      // Ensure all 8 courts are present
      const allCourts = Array.from({ length: 8 }, (_, i) => i + 1)
      const matchesByCourt = new Map(updatedMatches.map((court) => [court.courtIdx, court]))
      const completeMatches: CourtWithPlayers[] = allCourts.map((idx) => {
        const existing = matchesByCourt.get(idx)
        return existing || { courtIdx: idx, slots: [] }
      })
      
      updateInMemoryMatches(selectedRound, completeMatches)
      
      // Add animation class to the swapped player
      setRecentlySwappedPlayers(new Set([occupyingPlayer.id]))
      setTimeout(() => {
        setRecentlySwappedPlayers(new Set())
      }, 1000)
    } else {
      // Slot is empty or same player - normal move
      await handleMove(playerId, courtIdx, slot)
    }
  }

  /** Handles drop to court area — prevents automatic placement, requires slot selection. */
  const onDropToCourt = async (event: React.DragEvent<HTMLDivElement>, _courtIdx: number) => {
    // Only allow dropping to specific slots, not to the entire court
    // This prevents automatic placement
    event.preventDefault()
    setDragOverCourt(null)
  }

  /** Finds first available slot in court (respects extended capacity). */
  const getFirstFreeSlot = (court: CourtWithPlayers) => {
    const occupied = new Set(court.slots.map((entry: { slot: number; player: Player }) => entry.slot))
    const maxSlots = extendedCapacityCourts.get(court.courtIdx) || 4
    const slots = Array.from({ length: maxSlots }, (_, i) => i)
    return slots.find((idx: number) => !occupied.has(idx))
  }

  /** @deprecated Quick assign handler — currently unused. */
  const _handleQuickAssign = async (playerId: string, courtIdx: number) => {
    const court = matches.find((c) => c.courtIdx === courtIdx)
    if (!court) return
    const slot = getFirstFreeSlot(court)
    if (slot === undefined) {
      setError('Banen er fuld')
      return
    }
    await handleMove(playerId, courtIdx, slot)
    setMoveMenuPlayer(null)
  }

  /** Returns neutral background color for all players. */
  const getPlayerSlotBgColor = () => {
    return 'bg-[hsl(var(--surface-2))]'
  }

  /**
   * Gets category letter (S/D/B) for data-cat attribute.
   * @param category - Player primary category ('Single', 'Double', 'Begge', or null)
   * @returns 'S', 'D', 'B', or null
   */
  const getCategoryLetter = (category: 'Single' | 'Double' | 'Begge' | null | undefined): 'S' | 'D' | 'B' | null => {
    if (!category) return null
    if (category === 'Single') return 'S'
    if (category === 'Double') return 'D'
    if (category === 'Begge') return 'B'
    return null
  }

  /**
   * Renders category badge (S/D/B) for player primary category.
   * Neutral style with optional category ring for visual cue.
   * @param category - Player primary category ('Single', 'Double', 'Begge', or null)
   * @returns Badge JSX or null
   */
  const getCategoryBadge = (category: 'Single' | 'Double' | 'Begge' | null | undefined) => {
    if (!category) return null
    const labels: Record<'Single' | 'Double' | 'Begge', string> = {
      Single: 'S',
      Double: 'D',
      Begge: 'B'
    }
    const catLetter = getCategoryLetter(category)
    return (
      <span 
        className={`inline-flex items-center justify-center rounded-full text-xs font-bold w-6 h-6 flex-shrink-0 bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] border-hair ${catLetter ? 'cat-ring' : ''}`}
        data-cat={catLetter || undefined}
        title={category}
      >
        {labels[category]}
      </span>
    )
  }

  /**
   * Renders a player slot with drag-and-drop support and swap detection.
   * @param court - Court data
   * @param slotIndex - Slot index to render
   * @param fullScreen - Whether in full-screen mode (uses larger font)
   * @returns Slot JSX
   */
  const renderPlayerSlot = (court: CourtWithPlayers, slotIndex: number, fullScreen: boolean = false) => {
    const entry = court.slots.find((slot: { slot: number; player: Player }) => slot.slot === slotIndex)
    const player = entry?.player
    const isDragOver = dragOverSlot?.courtIdx === court.courtIdx && dragOverSlot?.slot === slotIndex
    const isCourtHovered = dragOverCourt === court.courtIdx && !player
    const isDragOverOccupied = isDragOver && !!player
    const isRecentlySwapped = player && recentlySwappedPlayers.has(player.id)
    const isDuplicatePlayer = player && duplicatePlayersMap.get(court.courtIdx)?.has(player.id)
    const catLetter = player ? getCategoryLetter(player.primaryCategory) : null
    
    return (
      <div
        key={slotIndex}
        draggable={!!player}
        onDragStart={(event: React.DragEvent<HTMLDivElement>) => {
          if (player) {
            setDragSource('court')
            event.dataTransfer.setData('application/x-player-id', player.id)
            // Store source location for swapping
            event.dataTransfer.setData('application/x-source-court-idx', String(court.courtIdx))
            event.dataTransfer.setData('application/x-source-slot', String(slotIndex))
            // Use browser's default drag image for better performance
            event.dataTransfer.effectAllowed = 'move'
          }
        }}
        onDragEnd={() => {
          setDragSource(null)
          dragOverSlotRef.current = null
          dragOverCourtRef.current = null
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = null
          }
          setDragOverSlot(null)
          setDragOverCourt(null)
        }}
        className={`flex items-center gap-2 rounded-md px-3 py-3 h-[72px] w-full transition-all motion-reduce:transition-none ${
          isRecentlySwapped
            ? `${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''} animate-swap-in ring-2 ring-[hsl(var(--primary)/.5)] shadow-lg hover:shadow-sm cursor-grab active:cursor-grabbing ring-1 ring-[hsl(var(--line)/.12)]`
            : isDragOverOccupied && player
            ? `${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''} ring-2 ring-[hsl(var(--primary)/.6)] shadow-lg hover:shadow-sm cursor-grab active:cursor-grabbing ring-1 ring-[hsl(var(--line)/.12)]`
            : player
            ? `${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''} hover:shadow-sm cursor-grab active:cursor-grabbing ring-1 ring-[hsl(var(--line)/.12)]`
            : isDragOver
            ? 'bg-[hsl(var(--primary)/.15)] ring-2 ring-[hsl(var(--primary)/.5)] shadow-md ring-1 ring-[hsl(var(--line)/.12)]'
            : isCourtHovered
            ? 'bg-[hsl(var(--primary)/.08)] ring-1 ring-[hsl(var(--primary)/.3)]'
            : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] ring-1 ring-[hsl(var(--line)/.12)]'
        }`}
        data-cat={catLetter || undefined}
        onDragOver={(event: React.DragEvent<HTMLDivElement>) => {
          // Allow drag over even if slot is occupied (for swapping)
          event.preventDefault()
          // Update ref immediately for instant visual feedback
          const newSlot = { courtIdx: court.courtIdx, slot: slotIndex }
          if (dragOverSlotRef.current?.courtIdx !== newSlot.courtIdx || dragOverSlotRef.current?.slot !== newSlot.slot) {
            dragOverSlotRef.current = newSlot
            updateDragOverState()
          }
        }}
        onDragLeave={() => {
          dragOverSlotRef.current = null
          updateDragOverState()
        }}
        onDrop={(event: React.DragEvent<HTMLDivElement>) => {
          dragOverSlotRef.current = null
          dragOverCourtRef.current = null
          setDragOverSlot(null)
          setDragOverCourt(null)
          // Allow dropping even if slot is occupied (for swapping)
          void onDropToSlot(event, court.courtIdx, slotIndex)
        }}
      >
        {player ? (
          <>
            <div className="min-w-0 flex-1">
              {fullScreen ? (
                // Full-screen: icon and name on same row, larger font
                <div className="flex items-center gap-2">
                  {getCategoryBadge(player.primaryCategory)}
                  <p className="text-xl font-semibold text-[hsl(var(--foreground))] truncate">{player.alias ?? player.name}</p>
                  {isDuplicatePlayer && (
                    <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--destructive)/.3)] text-[10px] font-bold text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive)/.4)]">
                      !
                    </span>
                  )}
                </div>
              ) : (
                // Normal view: icon and name on same row
                <div className="flex items-center gap-2">
                  {getCategoryBadge(player.primaryCategory)}
                  <p className="text-base font-semibold text-[hsl(var(--foreground))] truncate">{player.alias ?? player.name}</p>
                  {isDuplicatePlayer && (
                    <span className="inline-flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--destructive)/.3)] text-[8px] font-bold text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive)/.4)]">
                      !
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    )
  }

  if (loading) {
    return (
      <section className="mx-auto flex h-full max-w-5xl items-center justify-center pt-6">
        <p className="text-lg text-[hsl(var(--muted))]">Loader...</p>
      </section>
    )
  }

  // Full-screen view mode
  if (isFullScreen && session) {
    // Filter to only show courts with players
    const courtsWithPlayers = matches.filter(court => court.slots.length > 0)
    
    return (
      <div className="fixed inset-0 z-50 bg-[hsl(var(--bg-canvas))] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-[hsl(var(--line)/.12)]">
          <div className="flex items-center gap-4">
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(Number(e.target.value))}
              className="relative rounded-lg px-5 py-3 pr-11 text-base font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-contrast))] shadow-[0_2px_8px_hsl(var(--primary)/.25)] hover:shadow-[0_4px_16px_hsl(var(--primary)/.35)] hover:bg-[hsl(var(--primary)/.95)] focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--bg-canvas))] outline-none transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none cursor-pointer appearance-none min-w-[140px]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '18px 18px'
              }}
            >
              <option value={1}>Runde 1</option>
              <option value={2}>Runde 2</option>
              <option value={3}>Runde 3</option>
              <option value={4}>Runde 4</option>
            </select>
            <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Kampprogram</h1>
          </div>
          <button
            type="button"
            onClick={() => setIsFullScreen(false)}
            className="rounded-md bg-accent px-6 py-3 text-base font-semibold text-white hover:opacity-90 transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ring-focus hover:shadow-sm"
          >
            Luk (ESC)
          </button>
        </header>
        <div className="flex-1 overflow-hidden p-6" style={{ height: 'calc(100vh - 80px)' }}>
          {(() => {
            // Calculate optimal grid layout based on viewport and number of courts
            const headerHeight = 80
            const padding = 48 // 24px on each side
            const gap = 16 // gap-4 = 16px
            const availableHeight = viewportSize.height - headerHeight - padding
            const availableWidth = viewportSize.width - padding
            const numCourts = courtsWithPlayers.length
            
            // Calculate required card height based on actual content
            // Card header: ~60px, padding: 40px (20px top + 20px bottom)
            // Each player slot: ~72px, gap between slots: 8px
            // Dividers: ~20px each
            // Estimate max capacity per court (usually 4, can be 6 or 8)
            const maxCapacity = numCourts > 0 ? Math.max(...courtsWithPlayers.map(c => extendedCapacityCourts.get(c.courtIdx) || 4)) : 4
            const cardHeaderHeight = 60
            const cardPadding = 40
            const slotHeight = 72
            const slotGap = 8
            const dividerHeight = 20
            // Calculate slots needed: maxCapacity slots + dividers (1 divider for 4 slots, 2 for 6, 3 for 8)
            const numDividers = maxCapacity === 8 ? 3 : maxCapacity === 6 ? 2 : 1
            const requiredCardHeight = cardHeaderHeight + cardPadding + (maxCapacity * slotHeight) + ((maxCapacity - 1) * slotGap) + (numDividers * dividerHeight)
            
            // Calculate optimal number of columns and rows
            // Explicit rules for balanced layouts
            let optimalCols = 1
            let optimalRows = numCourts
            
            if (numCourts === 0) {
              optimalCols = 1
              optimalRows = 1
            } else {
              // Calculate optimal columns based on number of courts
              // Explicit rules for balanced layouts
              let evenCols = 4
              let evenRows = Math.ceil(numCourts / evenCols)
              
              // Explicit rules for specific court counts
              if (numCourts <= 4) {
                evenCols = 2
                evenRows = Math.ceil(numCourts / evenCols)
              } else if (numCourts === 5) {
                evenCols = 3
                evenRows = 2
              } else if (numCourts === 6) {
                evenCols = 3
                evenRows = 2
              } else if (numCourts === 7) {
                evenCols = 4
                evenRows = 2 // 4 top, 3 bottom
              } else if (numCourts === 8) {
                evenCols = 4
                evenRows = 2 // 4x2
              } else {
                // For more than 8 courts, calculate based on balance
                evenCols = 4
                evenRows = Math.ceil(numCourts / evenCols)
              }
              
              // Always use the explicit rules - they define the required layout
              optimalCols = evenCols
              optimalRows = evenRows
            }
            
            // Calculate column width
            const minColWidth = 280
            const maxColWidth = Math.floor((availableWidth - (gap * (optimalCols - 1))) / optimalCols)
            const colWidth = Math.max(minColWidth, Math.min(maxColWidth, 450))
            
            return (
              <section 
                className="grid gap-4 h-full w-full"
                style={{
                  gridTemplateColumns: `repeat(${optimalCols}, minmax(${colWidth}px, 1fr))`,
                  gridAutoRows: 'minmax(0, 1fr)',
                  justifyContent: 'center',
                  alignContent: 'center'
                }}
              >
            {courtsWithPlayers.map((court) => (
              <PageCard
                key={court.courtIdx}
                hover={false}
                className={`space-y-3 hover:shadow-md p-5 transition-all duration-200 relative h-full flex flex-col ${
                  courtsWithDuplicatesSet.has(court.courtIdx)
                    ? 'ring-2 ring-[hsl(var(--destructive)/.45)] border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.03)]'
                    : ''
                }`}
              >
                <header className="flex items-center justify-between mb-3 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-[hsl(var(--foreground))]">Bane {court.courtIdx}</h3>
                    {courtsWithDuplicatesSet.has(court.courtIdx) && (
                      <span className="group relative">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--destructive)/.2)] text-xs font-bold text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive)/.3)]">
                          !
                        </span>
                        <span className="absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[hsl(var(--surface-2))] px-2 py-1 text-xs text-[hsl(var(--foreground))] shadow-lg ring-1 ring-[hsl(var(--line)/.12)] group-hover:block">
                          3+ spillere har allerede spillet sammen i en tidligere runde
                        </span>
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[hsl(var(--muted))]">{court.slots.length}/{extendedCapacityCourts.get(court.courtIdx) || EMPTY_SLOTS}</span>
                </header>
                <div className="flex flex-col gap-2 flex-1 min-h-0">
                  {(() => {
                    const maxCapacity = extendedCapacityCourts.get(court.courtIdx) || 4
                    const renderNetDivider = () => (
                      <div className="relative flex items-center justify-center py-1">
                        <div className="absolute inset-0 flex items-center">
                          <div className="h-px w-full bg-[hsl(var(--line)/.3)]"></div>
                        </div>
                        <div className="relative bg-[hsl(var(--surface))] px-2">
                          <div className="h-1 w-8 rounded-full bg-[hsl(var(--primary)/.2)] ring-1 ring-[hsl(var(--primary)/.3)]"></div>
                        </div>
                      </div>
                    )
                    const renderRegularDivider = () => (
                      <div className="relative flex items-center justify-center py-0.5">
                        <div className="h-px w-full bg-[hsl(var(--primary)/.3)]"></div>
                      </div>
                    )
                    const renderSlotGroup = (startIndex: number, count: number) => (
                      <div className="flex flex-col gap-2">
                        {Array.from({ length: count }).map((_, idx) => {
                          const slotIndex = startIndex + idx
                          return (
                            <React.Fragment key={slotIndex}>
                              {renderPlayerSlot(court, slotIndex, true)}
                            </React.Fragment>
                          )
                        })}
                      </div>
                    )
                    if (maxCapacity === 8) {
                      return (
                        <>
                          {renderSlotGroup(0, 2)}
                          {renderNetDivider()}
                          {renderSlotGroup(2, 2)}
                          {renderRegularDivider()}
                          {renderSlotGroup(4, 2)}
                          {renderNetDivider()}
                          {renderSlotGroup(6, 2)}
                        </>
                      )
                    } else if (maxCapacity === 6) {
                      return (
                        <>
                          {renderSlotGroup(0, 3)}
                          {renderNetDivider()}
                          {renderSlotGroup(3, 3)}
                        </>
                      )
                    } else if (maxCapacity === 4) {
                      return (
                        <>
                          {renderSlotGroup(0, 2)}
                          {renderNetDivider()}
                          {renderSlotGroup(2, 2)}
                        </>
                      )
                    } else {
                      return (
                        <>
                          {renderSlotGroup(0, maxCapacity)}
                        </>
                      )
                    }
                  })()}
                </div>
              </PageCard>
            ))}
              </section>
            )
          })()}
        </div>
      </div>
    )
  }

  return (
    <section className="flex h-full flex-col gap-6 pt-4">
      <header className="relative flex items-center justify-between mb-2">
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">Kampprogram</h1>
          <p className="text-base text-[hsl(var(--muted))] mt-1">
            {session ? (
              <>
                Aktiv træning: {new Date(session.date).toLocaleDateString('da-DK')}
                {checkedIn.length > 0 && (
                  <> <span className="font-bold text-[hsl(var(--foreground))]">•</span> Indtjekkede spillere: {checkedIn.length} <span className="font-bold text-[hsl(var(--foreground))]">•</span> {genderBreakdown.male} Herrer & {genderBreakdown.female} Damer</>
                )}
              </>
            ) : (
              'Start en træning for at begynde at matche spillere'
            )}
          </p>
          {error && <span className="mt-2 inline-block text-sm text-[hsl(var(--destructive))]">{error}</span>}
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
          <div className="relative">
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(Number(e.target.value))}
              className="relative rounded-lg px-5 py-3 pr-11 text-base font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-contrast))] shadow-[0_2px_8px_hsl(var(--primary)/.25)] hover:shadow-[0_4px_16px_hsl(var(--primary)/.35)] hover:bg-[hsl(var(--primary)/.95)] focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--bg-canvas))] outline-none transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[0_2px_8px_hsl(var(--primary)/.25)] appearance-none min-w-[140px]"
              disabled={!session}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '18px 18px'
              }}
            >
              <option value={1}>Runde 1</option>
              <option value={2}>Runde 2</option>
              <option value={3}>Runde 3</option>
              <option value={4}>Runde 4</option>
            </select>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2 items-end">
          <div className="flex gap-2">
            {selectedRound > 1 && (
              <button
                type="button"
                onClick={async () => {
                  // Load all previous rounds if not already loaded
                  for (let round = 1; round < selectedRound; round++) {
                    if (!previousRoundsMatches[round]) {
                      await loadPreviousRound(round)
                    }
                  }
                  // Toggle all previous rounds visibility
                  if (previousRoundsVisible.size > 0) {
                    setPreviousRoundsVisible(new Set())
                  } else {
                    const rounds = new Set<number>()
                    for (let round = 1; round < selectedRound; round++) {
                      rounds.add(round)
                    }
                    setPreviousRoundsVisible(rounds)
                  }
                }}
                className="rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none bg-[hsl(var(--surface-glass)/.85)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.95)] ring-1 ring-[hsl(var(--line)/.12)] hover:shadow-sm"
              >
                {previousRoundsVisible.size > 0 ? 'Skjul' : 'Se'} tidligere runder
              </button>
            )}
            <button
              type="button"
              onClick={handleAutoMatch}
              disabled={!session || (bench.length === 0 && !hasRunAutoMatch.has(selectedRound))}
              className="rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none bg-[hsl(var(--surface-glass)/.85)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.95)] ring-1 ring-[hsl(var(--line)/.12)] disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
            >
              {hasRunAutoMatch.has(selectedRound) ? 'Omfordel' : 'Auto-match'}
            </button>
            <button
              type="button"
              onClick={handleResetMatches}
              disabled={!session}
              className="rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none bg-transparent text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] ring-1 ring-[hsl(var(--destructive)/.3)] disabled:opacity-40 disabled:cursor-not-allowed hover:ring-[hsl(var(--destructive)/.4)] focus:ring-[hsl(var(--destructive)/.4)] focus:ring-2"
            >
              Nulstil kampe
            </button>
            {session && (
              <button
                type="button"
                onClick={() => setIsFullScreen(true)}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ring-focus hover:shadow-sm"
              >
                Vis kampprogram
              </button>
            )}
            {session ? (
              <button
                type="button"
                onClick={handleEndTraining}
                className="rounded-md px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2))] ring-1 ring-[hsl(var(--line)/.12)] transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none hover:shadow-sm"
              >
                Afslut træning
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartTraining}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ring-focus hover:shadow-sm"
              >
                Start træning
              </button>
            )}
          </div>
        </div>
      </header>

      {!session && (
        <PageCard className="rounded-full px-6 py-3 text-center text-[hsl(var(--muted))]">
          Start træningen for at begynde at matche spillere på banerne.
        </PageCard>
      )}

      <div className={`grid gap-3 lg:items-start transition-all duration-300 ease-in-out ${
        benchCollapsed 
          ? 'lg:grid-cols-[48px_1fr]' 
          : 'lg:grid-cols-[minmax(200px,240px)_1fr]'
      }`}>
        {/* Bench */}
        <PageCard 
          className={`space-y-3 transition-all duration-300 ease-in-out p-4 ${
            dragOverBench 
              ? 'ring-2 ring-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.05)]' 
              : ''
          } ${benchCollapsed ? 'overflow-visible' : ''}`}
          onDragOver={(e) => {
            // Always allow drag over, even from inactive section (treat all inactive players the same)
            e.preventDefault()
            if (benchCollapsed) {
              // Auto-expand when dragging over collapsed bench
              setBenchCollapsed(false)
            }
            setDragOverBench(true)
          }}
          onDragLeave={() => {
            setDragOverBench(false)
          }}
          onDrop={(e) => {
            setDragOverBench(false)
            setDragSource(null)
            onDropToBench(e)
          }}
        >
          {benchCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setBenchCollapsed(false)}
                className="flex items-center justify-center w-8 h-8 rounded hover:bg-[hsl(var(--surface-2))] transition-colors"
                title="Udvid bænk"
              >
                <svg className="w-5 h-5 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {bench.length > 0 && (
                <span className="rounded-full bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] px-2 py-1 text-xs font-semibold border border-[hsl(var(--primary)/.2)]">
                  {bench.length}
                </span>
              )}
            </div>
          ) : (
            <div 
              style={{
                animation: benchCollapsing 
                  ? 'slideOutToLeft 0.3s ease-in forwards'
                  : 'slideInFromLeft 0.3s ease-out forwards'
              }}
            >
              <header className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">BÆNK</h3>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-xs font-medium">
                    {bench.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBenchCollapsing(true)
                      setTimeout(() => {
                        setBenchCollapsed(true)
                        setBenchCollapsing(false)
                      }, 300) // Match animation duration
                    }}
                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-[hsl(var(--surface-2))] transition-colors"
                    title="Skjul bænk"
                  >
                    <svg className="w-4 h-4 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
              </header>
              <div className="flex flex-col space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-thin min-w-0">
              {bench.length === 0 && (
              <p className="rounded-md bg-[hsl(var(--surface-2))] px-2 py-4 text-center text-xs text-[hsl(var(--muted))] border-hair">
                Træk spillere her for at aktivere dem
              </p>
            )}
              {bench.map((player) => {
              const catLetter = getCategoryLetter(player.primaryCategory)
              return (
              <div
                key={player.id}
                className={`flex items-center gap-3 rounded-md px-3 py-3 h-[72px] w-full hover:shadow-sm cursor-grab active:cursor-grabbing transition-all ring-1 ring-[hsl(var(--line)/.12)] ${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''}`}
                data-cat={catLetter || undefined}
                draggable
                onDragStart={(event) => {
                  setDragSource('bench')
                  event.dataTransfer.setData('application/x-player-id', player.id)
                  event.dataTransfer.effectAllowed = 'move'
                  // Use browser's default drag image for better performance
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => {
                  setDragSource(null)
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {getCategoryBadge(player.primaryCategory)}
                    <p className="text-base font-semibold text-[hsl(var(--foreground))] truncate">{player.alias ?? player.name}</p>
                  </div>
                </div>
              </div>
              )
            })}
              
              {/* Inactive Players Section */}
              <div 
              className={`mt-4 pt-4 border-t transition-all duration-200 min-w-0 ${
                dragOverInactive && dragSource !== 'inactive'
                  ? 'border-[hsl(var(--destructive)/.4)] bg-[hsl(var(--destructive)/.05)]' 
                  : 'border-[hsl(var(--line)/.12)]'
              }`}
              onDragOver={(e) => {
                // If dragging from within inactive section, don't handle at all - let it bubble to parent (BÆNK)
                if (dragSource === 'inactive') {
                  return // Don't call preventDefault() or stopPropagation() - let event bubble naturally
                }
                
                e.preventDefault()
                setDragOverInactive(true)
              }}
              onDragLeave={(e) => {
                // If dragging from within inactive section, don't handle - let it bubble
                if (dragSource === 'inactive') {
                  return
                }
                setDragOverInactive(false)
              }}
              onDrop={(e) => {
                // If dropping from within inactive section, don't handle at all - let it bubble to parent (BÆNK)
                if (dragSource === 'inactive') {
                  return // Don't call preventDefault() or stopPropagation() - let event bubble naturally
                }
                
                setDragOverInactive(false)
                e.preventDefault()
                onDropToInactive(e)
              }}
            >
              {inactivePlayers.length > 0 ? (
                <>
                  <header className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-[hsl(var(--muted))] uppercase tracking-wide">
                      Inaktive / Kun 1 runde
                    </h4>
                    <span className="rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--muted))]">
                      {inactivePlayers.length}
                    </span>
                  </header>
                  <div className="flex flex-col space-y-3 min-w-0">
                    {inactivePlayers.map((player) => {
                      const isOneRoundOnly = selectedRound > 1 && player.maxRounds === 1
                      const isUnavailable = unavailablePlayers.has(player.id)
                      const catLetter = getCategoryLetter(player.primaryCategory)
                      return (
                        <div
                          key={player.id}
                          className={`flex items-center gap-2 rounded-md px-3 py-3 h-[72px] w-full max-w-full box-border opacity-60 hover:opacity-100 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all ring-1 ring-[hsl(var(--line)/.12)] overflow-hidden ${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''}`}
                          data-cat={catLetter || undefined}
                        draggable
                        onDragStart={(event) => {
                          setDragSource('inactive')
                          event.dataTransfer.setData('application/x-player-id', player.id)
                          event.dataTransfer.effectAllowed = 'move'
                          // Create a clone of the element for drag preview to prevent layout shift
                          const dragElement = event.currentTarget.cloneNode(true) as HTMLElement
                          dragElement.style.position = 'absolute'
                          dragElement.style.top = '-1000px'
                          dragElement.style.width = `${event.currentTarget.offsetWidth}px`
                          dragElement.style.opacity = '0.8'
                          document.body.appendChild(dragElement)
                          const rect = event.currentTarget.getBoundingClientRect()
                          event.dataTransfer.setDragImage(dragElement, event.clientX - rect.left, event.clientY - rect.top)
                          // Clean up after a short delay
                          setTimeout(() => document.body.removeChild(dragElement), 0)
                        }}
                        onDragEnd={() => {
                          setDragSource(null)
                        }}
                        >
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="text-base font-semibold text-[hsl(var(--foreground))] truncate w-full">{player.alias ?? player.name}</p>
                            <div className="flex items-center gap-1.5 mt-1 min-w-0">
                              {getCategoryBadge(player.primaryCategory)}
                              {isOneRoundOnly && !isUnavailable && (
                                <span className="inline-flex items-center rounded-full bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] border-hair px-1.5 py-0.5 text-[10px] whitespace-nowrap flex-shrink-0">Kun 1 runde</span>
                              )}
                              {isUnavailable && (
                                <span className="text-[10px] font-normal text-[hsl(var(--destructive))] whitespace-nowrap flex-shrink-0">Inaktiv</span>
                              )}
                            </div>
                          </div>
                          {(isUnavailable || (isOneRoundOnly && !isUnavailable)) && (
                            <div className="flex-shrink-0 flex items-center justify-end ml-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isUnavailable) {
                                    handleMarkAvailable(player.id)
                                  } else if (isOneRoundOnly) {
                                    handleActivateOneRoundPlayer(player.id)
                                  }
                                }}
                                className="rounded px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/.1)] ring-1 ring-[hsl(var(--success)/.2)] transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none hover:shadow-sm whitespace-nowrap"
                                title={isUnavailable ? "Gendan til bænk" : "Aktiver spiller"}
                              >
                                Aktiver
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="py-4">
                  <header className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-[hsl(var(--muted))] uppercase tracking-wide">
                      Inaktive / Kun 1 runde
                    </h4>
                    <span className="rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--muted))]">
                      0
                    </span>
                  </header>
                  <p className="text-[10px] text-[hsl(var(--muted))] text-center py-2 rounded-md bg-[hsl(var(--surface-2))] border-hair">
                    Træk spillere her for at markere dem som inaktive
                  </p>
                </div>
              )}
              </div>
              </div>
            </div>
          )}
        </PageCard>

        {/* Courts */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {matches.map((court) => (
            <PageCard
              key={court.courtIdx}
              hover={false}
              className={`space-y-2 hover:shadow-md p-4 transition-all duration-200 relative ${
                courtsWithDuplicatesSet.has(court.courtIdx)
                  ? 'ring-2 ring-[hsl(var(--destructive)/.45)] border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.03)]'
                  : dragOverCourt === court.courtIdx
                  ? 'ring-2 ring-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.05)] shadow-lg'
                  : ''
              }`}
              onDragOver={(event) => {
                event.preventDefault()
                // Update ref immediately for instant visual feedback
                if (dragOverCourtRef.current !== court.courtIdx) {
                  dragOverCourtRef.current = court.courtIdx
                  updateDragOverState()
                }
              }}
              onDragLeave={() => {
                dragOverCourtRef.current = null
                dragOverSlotRef.current = null
                updateDragOverState()
              }}
              onDrop={(event) => void onDropToCourt(event, court.courtIdx)}
            >
              <header className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Bane {court.courtIdx}</h3>
                  {courtsWithDuplicatesSet.has(court.courtIdx) && (
                    <span className="group relative">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--destructive)/.2)] text-[10px] font-bold text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive)/.3)]">
                        !
                      </span>
                      <span className="absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[hsl(var(--surface-2))] px-2 py-1 text-xs text-[hsl(var(--foreground))] shadow-lg ring-1 ring-[hsl(var(--line)/.12)] group-hover:block">
                        3+ spillere har allerede spillet sammen i en tidligere runde
                      </span>
                    </span>
                  )}
                  {/* Lock Toggle and Icon - always show when court has players */}
                  {court.slots.some((slot) => slot.player) && (
                    <>
                      {/* Lock Toggle Switch */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleCourtLock(court.courtIdx)
                        }}
                        className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-2 items-center justify-start ${
                          currentRoundLockedCourts.has(court.courtIdx)
                            ? 'bg-[hsl(var(--primary))]'
                            : 'bg-[hsl(var(--surface-2))]'
                        }`}
                        role="switch"
                        aria-checked={currentRoundLockedCourts.has(court.courtIdx)}
                        title={currentRoundLockedCourts.has(court.courtIdx) ? 'Lås op' : 'Lås bane'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            currentRoundLockedCourts.has(court.courtIdx)
                              ? 'translate-x-3'
                              : 'translate-x-0.5'
                          }`}
                          style={{
                            marginTop: '0',
                            marginBottom: '0'
                          }}
                        />
                      </button>
                      {/* Lock Icon */}
                      <svg
                        className={`h-3.5 w-3.5 transition-colors duration-200 ml-1.5 ${
                          currentRoundLockedCourts.has(court.courtIdx)
                            ? 'text-[hsl(var(--primary))]'
                            : 'text-[hsl(var(--muted))]'
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <title>{currentRoundLockedCourts.has(court.courtIdx) ? 'Bane er låst - vil ikke blive ændret ved auto-match/omfordel' : 'Bane er ikke låst'}</title>
                        {currentRoundLockedCourts.has(court.courtIdx) ? (
                          // Closed lock (locked state)
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        ) : (
                          // Open lock (unlocked state)
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                        )}
                      </svg>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center gap-2">
                    {/* Capacity Selector - shown when extended capacity is enabled */}
                    {extendedCapacityCourts.get(court.courtIdx) && extendedCapacityCourts.get(court.courtIdx)! > 4 && (
                      <select
                        value={extendedCapacityCourts.get(court.courtIdx) || 8}
                        onChange={(e) => {
                          const capacity = Number(e.target.value)
                          setExtendedCapacityCourts((prev) => {
                            const newMap = new Map(prev)
                            newMap.set(court.courtIdx, capacity)
                            return newMap
                          })
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-8 rounded border-0 bg-[hsl(var(--surface-2))] text-[10px] font-semibold text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--line)/.12)] focus:ring-1 focus:ring-[hsl(var(--primary))] text-center leading-[20px]"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%23666' d='M4 6L1 3h6z'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 2px center',
                          backgroundSize: '8px 8px',
                          appearance: 'none',
                          paddingRight: '10px',
                          paddingLeft: '0px',
                          textAlign: 'center',
                          textAlignLast: 'center'
                        }}
                      >
                        <option value={5}>5</option>
                        <option value={6}>6</option>
                        <option value={7}>7</option>
                        <option value={8}>8</option>
                      </select>
                    )}
                    
                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const currentCapacity = extendedCapacityCourts.get(court.courtIdx)
                        if (currentCapacity && currentCapacity > 4) {
                          // Turn off extended capacity
                          setExtendedCapacityCourts((prev) => {
                            const newMap = new Map(prev)
                            newMap.delete(court.courtIdx)
                            return newMap
                          })
                        } else {
                          // Turn on extended capacity (default to 8)
                          setExtendedCapacityCourts((prev) => {
                            const newMap = new Map(prev)
                            newMap.set(court.courtIdx, 8)
                            return newMap
                          })
                        }
                      }}
                      className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-2 items-center justify-start ${
                        extendedCapacityCourts.get(court.courtIdx) && extendedCapacityCourts.get(court.courtIdx)! > 4
                          ? 'bg-[hsl(var(--primary))]'
                          : 'bg-[hsl(var(--surface-2))]'
                      }`}
                      role="switch"
                      aria-checked={!!(extendedCapacityCourts.get(court.courtIdx) && extendedCapacityCourts.get(court.courtIdx)! > 4)}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          extendedCapacityCourts.get(court.courtIdx) && extendedCapacityCourts.get(court.courtIdx)! > 4
                            ? 'translate-x-3'
                            : 'translate-x-0.5'
                        }`}
                        style={{
                          marginTop: '0',
                          marginBottom: '0'
                        }}
                      />
                    </button>
                  </div>
                  <span className="text-xs text-[hsl(var(--muted))]">{court.slots.length}/{extendedCapacityCourts.get(court.courtIdx) || EMPTY_SLOTS}</span>
                </div>
              </header>
              
              {/* Court visualization: two halves with net divider */}
              <div className="flex flex-col gap-2">
                {(() => {
                  const maxCapacity = extendedCapacityCourts.get(court.courtIdx) || 4
                  
                  // Render net divider (with rounded center)
                  const renderNetDivider = () => (
                    <div className="relative flex items-center justify-center py-1">
                      <div className="absolute inset-0 flex items-center">
                        <div className="h-px w-full bg-[hsl(var(--line)/.3)]"></div>
                      </div>
                      <div className="relative bg-[hsl(var(--surface))] px-2">
                        <div className="h-1 w-8 rounded-full bg-[hsl(var(--primary)/.2)] ring-1 ring-[hsl(var(--primary)/.3)]"></div>
                      </div>
                    </div>
                  )
                  
                  // Render regular divider (simple line)
                  const renderRegularDivider = () => (
                    <div className="relative flex items-center justify-center py-0.5">
                      <div className="h-px w-full bg-[hsl(var(--primary)/.3)]"></div>
                    </div>
                  )
                  
                  // Render a group of slots
                  const renderSlotGroup = (startIndex: number, count: number) => (
                    <div className="flex flex-col gap-1.5">
                      {Array.from({ length: count }).map((_, idx) => {
                        const slotIndex = startIndex + idx
                        return (
                          <React.Fragment key={slotIndex}>
                            {renderPlayerSlot(court, slotIndex, isFullScreen)}
                          </React.Fragment>
                        )
                      })}
                    </div>
                  )
                  
                  if (maxCapacity === 8) {
                    // For 8 players: net divider between 2&3, regular divider between 4&5, net divider between 6&7
                    // Structure: [0,1] - net - [2,3] - regular - [4,5] - net - [6,7]
                    return (
                      <>
                        {renderSlotGroup(0, 2)}
                        {renderNetDivider()}
                        {renderSlotGroup(2, 2)}
                        {renderRegularDivider()}
                        {renderSlotGroup(4, 2)}
                        {renderNetDivider()}
                        {renderSlotGroup(6, 2)}
                      </>
                    )
                  } else if (maxCapacity === 6) {
                    // For 6 players: only net divider between two sets of 3 players
                    // Structure: [0,1,2] - net - [3,4,5]
                    return (
                      <>
                        {renderSlotGroup(0, 3)}
                        {renderNetDivider()}
                        {renderSlotGroup(3, 3)}
                      </>
                    )
                  } else if (maxCapacity === 4) {
                    // For 4 players: standard two halves with net divider
                    return (
                      <>
                        {renderSlotGroup(0, 2)}
                        {renderNetDivider()}
                        {renderSlotGroup(2, 2)}
                      </>
                    )
                  } else {
                    // For 5 and 7 players: no dividers at all
                    return (
                      <>
                        {renderSlotGroup(0, maxCapacity)}
                      </>
                    )
                  }
                })()}
              </div>
            </PageCard>
          ))}
        </section>
      </div>

      {/* Previous Rounds Popup Window */}
      {previousRoundsVisible.size > 0 && (
        <>
          {/* Subtle backdrop - visual only, doesn't block interaction */}
          <div 
            className="fixed inset-0 z-40 bg-[hsl(var(--bg-canvas)/.1)] pointer-events-none"
          />
          {/* Floating Popup Window */}
          <div 
            className="fixed z-50 w-[400px] max-h-[85vh] rounded-xl bg-[hsl(var(--surface))] shadow-2xl ring-2 ring-[hsl(var(--line)/.2)] overflow-hidden flex flex-col pointer-events-auto select-none"
            style={{
              left: `${popupPosition.x}px`,
              top: `${popupPosition.y}px`,
              cursor: isDragging ? 'grabbing' : 'default'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - draggable */}
            <div 
              className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--line)/.12)] bg-[hsl(var(--surface-2))] cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                  Tidligere runder
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviousRoundsVisible(new Set())}
                className="rounded-md p-1.5 text-[hsl(var(--muted))] hover:bg-[hsl(var(--surface))] hover:text-[hsl(var(--foreground))] transition-all duration-200"
                title="Luk"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {Array.from({ length: selectedRound - 1 })
                .map((_, i) => selectedRound - 1 - i)
                .filter((round) => previousRoundsVisible.has(round))
                .map((round) => (
                  <div key={round} className="space-y-2">
                    <h3 className="text-sm font-semibold text-[hsl(var(--muted))] uppercase tracking-wide sticky top-0 bg-[hsl(var(--surface))] pb-1">
                      Runde {round}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {(inMemoryMatches[round] || previousRoundsMatches[round] || []).map((court) => (
                        <PageCard key={court.courtIdx} className="space-y-1.5 p-2.5 opacity-75">
                          <header className="flex items-center justify-between mb-1">
                            <h4 className="text-xs font-semibold text-[hsl(var(--foreground))]">Bane {court.courtIdx}</h4>
                            <span className="text-[10px] text-[hsl(var(--muted))]">{court.slots.length}/{EMPTY_SLOTS}</span>
                          </header>
                          <div className="flex flex-col gap-1">
                            {Array.from({ length: 4 }).map((_, slotIdx) => {
                              const entry = court.slots.find((slot) => slot.slot === slotIdx)
                              const player = entry?.player
                              const catLetter = player ? getCategoryLetter(player.primaryCategory) : null
                              return (
                                <div
                                  key={slotIdx}
                                  className={`flex min-h-[36px] items-center rounded-md px-2 py-1 text-xs ring-1 ${
                                    player
                                      ? `${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''} ring-[hsl(var(--line)/.12)]`
                                      : 'bg-[hsl(var(--surface-2))] ring-[hsl(var(--line)/.12)]'
                                  }`}
                                  data-cat={catLetter || undefined}
                                >
                                  {player ? (
                                    <span className="text-xs font-medium text-[hsl(var(--foreground))] truncate">
                                      {player.alias ?? player.name}
                                    </span>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        </PageCard>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default MatchProgramPage