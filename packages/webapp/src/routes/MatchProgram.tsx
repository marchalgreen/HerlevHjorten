import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [recentlySwappedPlayers, setRecentlySwappedPlayers] = useState<Set<string>>(new Set())
  const [previousRoundsVisible, setPreviousRoundsVisible] = useState<Set<number>>(new Set())
  const [previousRoundsMatches, setPreviousRoundsMatches] = useState<Record<number, CourtWithPlayers[]>>({})
  const [popupPosition, setPopupPosition] = useState({ x: 16, y: 16 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  // WHY: Track extended capacity per court (4, 5, 6, 7, or 8 slots)
  const [extendedCapacityCourts, setExtendedCapacityCourts] = useState<Map<number, number>>(new Map())
  // WHY: Track locked courts that should not be changed by auto-match/re-shuffle
  const [lockedCourts, setLockedCourts] = useState<Set<number>>(new Set())
  // WHY: Track if auto-match has been run for the current round (to show "Omfordel" button)
  const [hasRunAutoMatch, setHasRunAutoMatch] = useState<Set<number>>(new Set())

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

  /** Loads court assignments for selected round. */
  const loadMatches = async () => {
    if (!session) {
      setMatches([])
      return
    }
    try {
      const data = await api.matches.list(selectedRound)
      setMatches(data)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente baner')
    }
  }

  /** Initializes page state — loads session and players. */
  const hydrate = useCallback(async () => {
    setLoading(true)
    setError(null)
    await loadSession()
    setLoading(false)
  }, [loadSession])

  // WHY: Initialize page on mount; deps are stable callbacks
  useEffect(() => { void hydrate() }, [hydrate])

  // WHY: Reload data when session or round changes; clear if no session
  useEffect(() => {
    if (!session) {
      setMatches([])
      setCheckedIn([])
      return
    }
    void loadCheckIns()
    void loadMatches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, selectedRound])


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
        // Primary sort: Gender (Herre, Dame, then null/undefined)
        const genderOrder: Record<string, number> = { Herre: 1, Dame: 2 }
        const genderA = genderOrder[a.gender ?? ''] ?? 3
        const genderB = genderOrder[b.gender ?? ''] ?? 3
        if (genderA !== genderB) {
          return genderA - genderB
        }
        
        // Secondary sort: PlayingCategory (Begge, Double, Single, then null/undefined)
        const categoryOrder: Record<string, number> = { Begge: 1, Double: 2, Single: 3 }
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
        // Primary sort: Gender (Herre, Dame, then null/undefined)
        const genderOrder: Record<string, number> = { Herre: 1, Dame: 2 }
        const genderA = genderOrder[a.gender ?? ''] ?? 3
        const genderB = genderOrder[b.gender ?? ''] ?? 3
        if (genderA !== genderB) {
          return genderA - genderB
        }
        
        // Secondary sort: PlayingCategory (Begge, Double, Single, then null/undefined)
        const categoryOrder: Record<string, number> = { Begge: 1, Double: 2, Single: 3 }
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
   * @param round - Round number to load
   */
  const loadPreviousRound = useCallback(async (round: number) => {
    if (!session || round >= selectedRound || round < 1) return
    if (previousRoundsMatches[round]) return // Already loaded
    
    try {
      const data = await api.matches.list(round)
      setPreviousRoundsMatches((prev) => ({ ...prev, [round]: data }))
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente tidligere runde')
    }
  }, [session, selectedRound, previousRoundsMatches])

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
    
    // Re-fetch previous rounds matches from state
    const updatedPreviousRounds = { ...previousRoundsMatches }
    
    // Check each previous round
    for (let round = 1; round < selectedRound; round++) {
      let previousMatches = updatedPreviousRounds[round]
      
      // If still not loaded, try loading directly
      if (!previousMatches) {
        try {
          const data = await api.matches.list(round)
          previousMatches = data
          updatedPreviousRounds[round] = data
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
      
      // Load all previous rounds first
      for (let round = 1; round < selectedRound; round++) {
        if (!previousRoundsMatches[round]) {
          try {
            const data = await api.matches.list(round)
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
          // Get previous matches - try state first, then API
          let previousMatches = previousRoundsMatches[round]
          if (!previousMatches) {
            try {
              previousMatches = await api.matches.list(round)
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

  /** Ends active training session. */
  const handleEndTraining = async () => {
    if (!session) return
    try {
      await api.session.endActive()
      setSession(null)
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

  /** Gets all courts that should be excluded from auto-match: manually locked + occupied */
  const excludedCourts = useMemo(() => {
    const excluded = new Set(lockedCourts)
    // Also exclude occupied courts (courts with players)
    occupiedCourts.forEach((courtIdx) => excluded.add(courtIdx))
    return excluded
  }, [lockedCourts, occupiedCourts])

  /** Triggers auto-matching algorithm for selected round. */
  const handleAutoMatch = async () => {
    if (!session) return
    try {
      // Check if this is a re-shuffle (button says "Omfordel") BEFORE marking as run
      const isReshuffle = hasRunAutoMatch.has(selectedRound)
      
      // Mark that auto-match has been run for this round
      setHasRunAutoMatch((prev) => new Set(prev).add(selectedRound))
      
      // For initial auto-match: only fill empty courts (excludes occupied courts)
      // For re-shuffle: reshuffle all players among non-locked courts (don't clear first)
      const courtsToExclude = isReshuffle ? lockedCourts : excludedCourts
      const result: AutoArrangeResult = await api.matches.autoArrange(selectedRound, unavailablePlayers, activatedOneRoundPlayers, courtsToExclude, isReshuffle)
      await loadMatches()
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

  /** Toggles lock state for a court. */
  const handleToggleCourtLock = (courtIdx: number) => {
    setLockedCourts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(courtIdx)) {
        newSet.delete(courtIdx)
      } else {
        newSet.add(courtIdx)
      }
      return newSet
    })
  }

  /** Resets all court assignments for current session, respecting locked courts. */
  const handleResetMatches = async () => {
    if (!session) return
    try {
      // Use bulk reset API for instant UX - no animations
      await api.matches.resetForRound(selectedRound, lockedCourts)
      await loadMatches()
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
   * Moves player to court/slot or removes from court.
   * @param playerId - Player ID to move
   * @param courtIdx - Target court index (undefined = remove from court)
   * @param slot - Target slot index (required if courtIdx provided)
   */
  const handleMove = async (playerId: string, courtIdx?: number, slot?: number) => {
    if (!session) return
    try {
      await api.matches.move({ playerId, toCourtIdx: courtIdx, toSlot: slot }, selectedRound)
      await loadMatches()
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
   * Handles drop to court slot — supports swapping if slot is occupied.
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
    const targetCourt = matches.find((c) => c.courtIdx === courtIdx)
    const targetSlotEntry = targetCourt?.slots.find((s) => s.slot === slot)
    const occupyingPlayer = targetSlotEntry?.player
    
    // Get source location from drag data
    const sourceCourtIdxStr = event.dataTransfer.getData('application/x-source-court-idx')
    const sourceSlotStr = event.dataTransfer.getData('application/x-source-slot')
    const sourceCourtIdx = sourceCourtIdxStr ? Number(sourceCourtIdxStr) : undefined
    const sourceSlot = sourceSlotStr ? Number(sourceSlotStr) : undefined
    
    if (occupyingPlayer && occupyingPlayer.id !== playerId) {
      // Slot is occupied by a different player - swap them using the swap parameter
      try {
        await api.matches.move(
          { 
            playerId, 
            toCourtIdx: courtIdx, 
            toSlot: slot, 
            swapWithPlayerId: occupyingPlayer.id 
          } as any, 
          selectedRound
        )
        await loadMatches()
        await loadCheckIns()
        
        // Add animation class to the swapped player (the one who was moved to the source location)
        setRecentlySwappedPlayers(new Set([occupyingPlayer.id]))
        // Clear animation after it completes
        setTimeout(() => {
          setRecentlySwappedPlayers(new Set())
        }, 1000)
      } catch (err: any) {
        setError(err.message ?? 'Kunne ikke bytte spillere')
      }
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
        className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold w-5 h-5 bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] border-hair ${catLetter ? 'cat-ring' : ''}`}
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
   * @returns Slot JSX
   */
  const renderPlayerSlot = (court: CourtWithPlayers, slotIndex: number) => {
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
          }
        }}
        onDragEnd={() => {
          setDragSource(null)
        }}
        className={`flex items-center gap-2 rounded-md px-2 py-2 h-[56px] w-full transition-all motion-reduce:transition-none ${
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
          setDragOverSlot({ courtIdx: court.courtIdx, slot: slotIndex })
        }}
        onDragLeave={() => {
          setDragOverSlot(null)
        }}
        onDrop={(event: React.DragEvent<HTMLDivElement>) => {
          setDragOverSlot(null)
          setDragOverCourt(null)
          // Allow dropping even if slot is occupied (for swapping)
          void onDropToSlot(event, court.courtIdx, slotIndex)
        }}
      >
        {player ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">{player.alias ?? player.name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                {getCategoryBadge(player.primaryCategory)}
                <span className="text-[10px] text-[hsl(var(--muted))] whitespace-nowrap">
                  Rangliste: {player.level ?? '–'}
                </span>
                {isDuplicatePlayer && (
                  <span className="inline-flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--destructive)/.3)] text-[8px] font-bold text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive)/.4)]">
                    !
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMove(player.id)
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="rounded px-2 py-1 text-xs font-medium text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.85)] ring-1 ring-[hsl(var(--line)/.12)] transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
              >
                BÆNK
              </button>
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

  return (
    <section className="flex h-full flex-col gap-6 pt-6">
      <header className="relative flex items-center justify-between mb-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Kampprogram</h1>
          <p className="text-base text-[hsl(var(--muted))] mt-1">
            {session ? (
              <>
                Tjekket ind: {checkedIn.length}
                {checkedIn.length > 0 && (
                  <> <span className="font-bold text-[hsl(var(--foreground))]">•</span> {genderBreakdown.male} Herrer & {genderBreakdown.female} Damer</>
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
              className="rounded-xl px-8 py-4 pr-12 text-lg font-semibold bg-gradient-to-b from-[hsl(var(--surface-glass)/.95)] to-[hsl(var(--surface)/.98)] backdrop-blur-sm text-[hsl(var(--foreground))] ring-2 ring-[hsl(var(--primary)/.25)] shadow-[0_4px_12px_hsl(var(--primary)/.15)] hover:shadow-[0_6px_20px_hsl(var(--primary)/.2)] hover:ring-[hsl(var(--primary)/.35)] focus:ring-[hsl(var(--primary)/.45)] focus:ring-2 focus:shadow-[0_6px_20px_hsl(var(--primary)/.25)] outline-none transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
              disabled={!session}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23666' d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
                backgroundSize: '16px 16px'
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

      <div className="grid gap-4 lg:grid-cols-[minmax(200px,240px)_1fr] lg:items-start">
        {/* Bench */}
        <PageCard 
          className={`space-y-2 transition-all duration-200 p-4 ${
            dragOverBench 
              ? 'ring-2 ring-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.05)]' 
              : ''
          }`}
          onDragOver={(e) => {
            // Always allow drag over, even from inactive section (treat all inactive players the same)
            e.preventDefault()
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
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">BÆNK</h3>
            <span className="rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-xs font-medium">
              {bench.length}
            </span>
          </header>
          <div className="flex flex-col space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-thin min-w-0">
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
                className={`flex items-center gap-2 rounded-md px-2 py-2 h-[56px] w-full hover:shadow-sm cursor-grab active:cursor-grabbing transition-all ring-1 ring-[hsl(var(--line)/.12)] ${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''}`}
                data-cat={catLetter || undefined}
                draggable
                onDragStart={(event) => {
                  setDragSource('bench')
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
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">{player.alias ?? player.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {getCategoryBadge(player.primaryCategory)}
                    <span className="text-[10px] text-[hsl(var(--muted))] whitespace-nowrap">
                      Rangliste: {player.level ?? '–'}
                    </span>
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
                  <div className="flex flex-col space-y-2 min-w-0">
                    {inactivePlayers.map((player) => {
                      const isOneRoundOnly = selectedRound > 1 && player.maxRounds === 1
                      const isUnavailable = unavailablePlayers.has(player.id)
                      const catLetter = getCategoryLetter(player.primaryCategory)
                      return (
                        <div
                          key={player.id}
                          className={`flex items-center gap-1.5 rounded-md px-2 py-2 h-[56px] w-full max-w-full box-border opacity-60 hover:opacity-100 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all ring-1 ring-[hsl(var(--line)/.12)] overflow-hidden ${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''}`}
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
                            <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate w-full">{player.alias ?? player.name}</p>
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
        </PageCard>

        {/* Courts */}
        <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
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
                setDragOverCourt(court.courtIdx)
              }}
              onDragLeave={() => {
                setDragOverCourt(null)
                setDragOverSlot(null)
              }}
              onDrop={(event) => void onDropToCourt(event, court.courtIdx)}
            >
              <header className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">Bane {court.courtIdx}</h3>
                  {courtsWithDuplicatesSet.has(court.courtIdx) && (
                    <span
                      className="group relative"
                      title="3+ spillere har allerede spillet sammen i en tidligere runde"
                    >
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--destructive)/.2)] text-[10px] font-bold text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive)/.3)]">
                        !
                      </span>
                      <span className="absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[hsl(var(--foreground))] px-2 py-1 text-xs text-[hsl(var(--background))] shadow-lg group-hover:block">
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
                          lockedCourts.has(court.courtIdx)
                            ? 'bg-[hsl(var(--primary))]'
                            : 'bg-[hsl(var(--surface-2))]'
                        }`}
                        role="switch"
                        aria-checked={lockedCourts.has(court.courtIdx)}
                        title={lockedCourts.has(court.courtIdx) ? 'Lås op' : 'Lås bane'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            lockedCourts.has(court.courtIdx)
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
                          lockedCourts.has(court.courtIdx)
                            ? 'text-[hsl(var(--primary))]'
                            : 'text-[hsl(var(--muted))]'
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        title={lockedCourts.has(court.courtIdx) ? 'Bane er låst - vil ikke blive ændret ved auto-match/omfordel' : 'Bane er ikke låst'}
                      >
                        {lockedCourts.has(court.courtIdx) ? (
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
                  const slotsPerSide = Math.ceil(maxCapacity / 2)
                  const topSlots = slotsPerSide
                  const bottomSlots = maxCapacity - topSlots
                  
                  return (
                    <>
                      {/* Top half */}
                      <div className="flex flex-col gap-1.5">
                        {Array.from({ length: topSlots }).map((_, idx) => renderPlayerSlot(court, idx))}
                      </div>
                      
                      {/* Net divider */}
                      <div className="relative flex items-center justify-center py-1">
                        <div className="absolute inset-0 flex items-center">
                          <div className="h-px w-full bg-[hsl(var(--line)/.3)]"></div>
                        </div>
                        <div className="relative bg-[hsl(var(--surface))] px-2">
                          <div className="h-1 w-8 rounded-full bg-[hsl(var(--primary)/.2)] ring-1 ring-[hsl(var(--primary)/.3)]"></div>
                        </div>
                      </div>
                      
                      {/* Bottom half */}
                      <div className="flex flex-col gap-1.5">
                        {Array.from({ length: bottomSlots }).map((_, idx) => renderPlayerSlot(court, idx + topSlots))}
                      </div>
                    </>
                  )
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
                      {(previousRoundsMatches[round] || []).map((court) => (
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