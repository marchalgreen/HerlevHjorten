/**
 * Custom hook for managing match program state and operations.
 * 
 * Handles all state management, persistence, and business logic for the match program.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CheckedInPlayer, CourtWithPlayers, Player, TrainingSession } from '@rundeklar/common'
import api from '../api'
import { useToast } from '../components/ui/Toast'
import {
  loadPersistedState,
  savePersistedState,
  clearPersistedState,
  type PersistedMatchProgramState
} from '../lib/matchProgramPersistence'
import {
  getAssignedPlayerIds,
  calculateGenderBreakdown,
  ensureAllCourtsPresent
} from '../lib/matchProgramUtils'
import {
  filterBenchPlayers,
  filterInactivePlayers,
  findDuplicateMatchups,
  getOccupiedCourts,
  ensureAllCourts
} from '../services/matchProgramService'
import { localAutoMatch } from '../services/localAutoMatch'

interface UseMatchProgramProps {
  session: TrainingSession | null
  checkedIn: CheckedInPlayer[]
  maxCourts: number
  startSession: () => Promise<TrainingSession | null>
  endSession: (matchesData?: Array<{ round: number; matches: CourtWithPlayers[] }>) => Promise<void>
}

interface UseMatchProgramReturn {
  // State
  matches: CourtWithPlayers[]
  selectedRound: number
  setSelectedRound: (round: number) => void
  error: string | null
  setError: (error: string | null) => void
  
  // Player management
  unavailablePlayers: Set<string>
  activatedOneRoundPlayers: Set<string>
  handleMarkUnavailable: (playerId: string) => void
  handleMarkAvailable: (playerId: string) => void
  handleActivateOneRoundPlayer: (playerId: string) => Promise<void>
  
  // Drag and drop
  dragOverInactive: boolean
  dragOverBench: boolean
  dragSource: 'bench' | 'inactive' | 'court' | null
  dragOverCourt: number | null
  dragOverSlot: { courtIdx: number; slot: number } | null
  recentlySwappedPlayers: Set<string>
  setDragSource: (source: 'bench' | 'inactive' | 'court' | null) => void
  setDragOverInactive: (value: boolean) => void
  setDragOverBench: (value: boolean) => void
  setDragOverCourt: (value: number | null) => void
  setDragOverSlot: (value: { courtIdx: number; slot: number } | null) => void
  
  // Computed values
  assignedIds: Set<string>
  bench: CheckedInPlayer[]
  inactivePlayers: CheckedInPlayer[]
  genderBreakdown: { male: number; female: number }
  occupiedCourts: Set<number>
  currentRoundLockedCourts: Set<number>
  excludedCourts: Set<number>
  
  // Court management
  extendedCapacityCourts: Map<number, number>
  setExtendedCapacityCourts: React.Dispatch<React.SetStateAction<Map<number, number>>>
  lockedCourts: Record<number, Set<number>>
  handleToggleCourtLock: (courtIdx: number) => void
  
  // Match operations
  handleMove: (playerId: string, courtIdx?: number, slot?: number) => Promise<void>
  handleAutoMatch: () => Promise<void>
  handleResetMatches: () => Promise<void>
  onDropToBench: (event: React.DragEvent<HTMLDivElement>) => Promise<void>
  onDropToInactive: (event: React.DragEvent<HTMLDivElement>) => Promise<void>
  onDropToSlot: (event: React.DragEvent<HTMLElement>, courtIdx: number, slot: number) => Promise<void>
  onDropToCourt: (event: React.DragEvent<HTMLDivElement>, courtIdx: number) => Promise<void>
  
  // Duplicate detection
  courtsWithDuplicatesSet: Set<number>
  duplicatePlayersMap: Map<number, Set<string>>
  
  // Previous rounds
  previousRoundsMatches: Record<number, CourtWithPlayers[]>
  previousRoundsVisible: Set<number>
  setPreviousRoundsVisible: React.Dispatch<React.SetStateAction<Set<number>>>
  loadPreviousRound: (round: number) => Promise<void>
  
  // UI state
  moveMenuPlayer: string | null
  setMoveMenuPlayer: (playerId: string | null) => void
  isFullScreen: boolean
  setIsFullScreen: (fullScreen: boolean) => void
  viewportSize: { width: number; height: number }
  popupPosition: { x: number; y: number }
  setPopupPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  popupSize: { width: number; height: number }
  setPopupSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>
  isDragging: boolean
  setIsDragging: (dragging: boolean) => void
  isResizing: boolean
  setIsResizing: (resizing: boolean) => void
  dragOffset: { x: number; y: number }
  setDragOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  resizeOffset: { x: number; y: number }
  setResizeOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  
  // Internal refs (for drag handlers)
  dragOverSlotRef: React.MutableRefObject<{ courtIdx: number; slot: number } | null>
  dragOverCourtRef: React.MutableRefObject<number | null>
  rafIdRef: React.MutableRefObject<number | null>
  updateDragOverState: () => void
  
  // Internal state (for handlers)
  inMemoryMatches: Record<number, CourtWithPlayers[]>
  hasRunAutoMatch: Set<number>
  updateInMemoryMatches: (round: number, newMatches: CourtWithPlayers[]) => void
  
  // State management
  clearAllState: () => void
  
  // Session handlers
  handleStartTraining: () => Promise<void>
  handleEndTraining: () => Promise<void>
  
  // UI handlers
  handleMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
  handleResizeStart: (e: React.MouseEvent<HTMLDivElement>) => void
  handleExtendedCapacityChange: (courtIdx: number, capacity: number | null) => void
  handleTogglePreviousRounds: () => Promise<void>
  
  // Drag handlers (wrappers for child components)
  handleSlotDragStart: (event: React.DragEvent<HTMLDivElement>, player: Player, courtIdx: number, slotIndex: number) => void
  handleSlotDragEnd: () => void
  handleSlotDragOver: (event: React.DragEvent<HTMLDivElement>, courtIdx: number, slotIndex: number) => void
  handleSlotDragLeave: () => void
  handleSlotDrop: (event: React.DragEvent<HTMLDivElement>, courtIdx: number, slotIndex: number) => void
  handleBenchDragStart: (event: React.DragEvent<HTMLDivElement>, playerId: string) => void
  handleBenchDragEnd: () => void
  handleInactiveDragStart: (event: React.DragEvent<HTMLDivElement>, playerId: string) => void
  handleInactiveDragEnd: () => void
  handleBenchDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  handleBenchDragLeave: () => void
  handleBenchDrop: (event: React.DragEvent<HTMLDivElement>) => void
  handleInactiveDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  handleInactiveDragLeave: (event: React.DragEvent<HTMLDivElement>) => void
  handleInactiveDrop: (event: React.DragEvent<HTMLDivElement>) => void
  handleCourtDragOver: (event: React.DragEvent<HTMLDivElement>, courtIdx: number) => void
  handleCourtDragLeave: () => void
  handleCourtDrop: (event: React.DragEvent<HTMLDivElement>, courtIdx: number) => void
}

/**
 * Custom hook for managing match program state and operations.
 * 
 * @param props - Hook configuration
 * @returns Match program state and handlers
 */
export const useMatchProgram = ({
  session,
  checkedIn,
  maxCourts,
  startSession,
  endSession
}: UseMatchProgramProps): UseMatchProgramReturn => {
  const { notify } = useToast()
  
  // Core state
  const [matches, setMatches] = useState<CourtWithPlayers[]>([])
  const [selectedRound, setSelectedRound] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  
  // Player management
  const [unavailablePlayers, setUnavailablePlayers] = useState<Set<string>>(new Set())
  const [activatedOneRoundPlayers, setActivatedOneRoundPlayers] = useState<Set<string>>(new Set())
  
  // Drag and drop state
  const [dragOverInactive, setDragOverInactive] = useState(false)
  const [dragOverBench, setDragOverBench] = useState(false)
  const [dragSource, setDragSource] = useState<'bench' | 'inactive' | 'court' | null>(null)
  const [dragOverCourt, setDragOverCourt] = useState<number | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<{ courtIdx: number; slot: number } | null>(null)
  const [recentlySwappedPlayers, setRecentlySwappedPlayers] = useState<Set<string>>(new Set())
  
  // Drag refs
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
  
  // Previous rounds
  const [previousRoundsVisible, setPreviousRoundsVisible] = useState<Set<number>>(new Set())
  const [previousRoundsMatches, setPreviousRoundsMatches] = useState<Record<number, CourtWithPlayers[]>>({})
  
  // UI state
  const [moveMenuPlayer, setMoveMenuPlayer] = useState<string | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [viewportSize, setViewportSize] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 1920, 
    height: typeof window !== 'undefined' ? window.innerHeight : 1080 
  })
  const [popupPosition, setPopupPosition] = useState({ x: 16, y: 16 })
  const [popupSize, setPopupSize] = useState({ width: 400, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeOffset, setResizeOffset] = useState({ x: 0, y: 0 })
  
  // Court management
  const [extendedCapacityCourts, setExtendedCapacityCourts] = useState<Map<number, number>>(new Map())
  const [lockedCourts, setLockedCourts] = useState<Record<number, Set<number>>>({})
  const [hasRunAutoMatch, setHasRunAutoMatch] = useState<Set<number>>(new Set())
  
  // Track if auto-match just ran to prevent duplicate toast from useEffect
  const justRanAutoMatchRef = useRef<boolean>(false)
  
  // In-memory matches (per round)
  const [inMemoryMatches, setInMemoryMatches] = useState<Record<number, CourtWithPlayers[]>>({})
  
  // Refs for event handlers
  const hasRestoredStateRef = useRef(false)
  const inMemoryMatchesRef = useRef(inMemoryMatches)
  const lockedCourtsRef = useRef(lockedCourts)
  const hasRunAutoMatchRef = useRef(hasRunAutoMatch)
  const extendedCapacityCourtsRef = useRef(extendedCapacityCourts)
  const sessionRef = useRef(session)
  
  // Keep refs in sync with state
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
  
  // Computed values
  const assignedIds = useMemo(() => {
    return getAssignedPlayerIds(matches)
  }, [matches])
  
  const bench = useMemo(
    () => filterBenchPlayers(checkedIn, assignedIds, selectedRound, unavailablePlayers, activatedOneRoundPlayers),
    [checkedIn, assignedIds, selectedRound, unavailablePlayers, activatedOneRoundPlayers]
  )

  // Track when bench becomes empty and show toast reminder
  const prevBenchLengthRef = useRef<number>(bench.length)
  useEffect(() => {
    const prevBenchLength = prevBenchLengthRef.current
    const currentBenchLength = bench.length
    
    // Show toast when bench becomes empty and there are matches
    // But skip if auto-match just ran (to avoid duplicate toast)
    if (prevBenchLength > 0 && currentBenchLength === 0 && session && !justRanAutoMatchRef.current) {
      const hasMatches = matches.some(court => 
        court.slots.some(slot => slot.player)
      )
      if (hasMatches) {
        notify({
          variant: 'default',
          title: 'Alle spillere er placeret!',
          description: 'Tryk på "Vis runde" eller F11 for at vise spillerne deres baner',
          duration: 5000
        })
      }
    }
    
    prevBenchLengthRef.current = currentBenchLength
  }, [bench.length, matches, session, notify])
  
  const inactivePlayers = useMemo<CheckedInPlayer[]>(
    () => filterInactivePlayers(checkedIn, assignedIds, selectedRound, unavailablePlayers, activatedOneRoundPlayers),
    [checkedIn, assignedIds, selectedRound, unavailablePlayers, activatedOneRoundPlayers]
  )
  
  const genderBreakdown = useMemo(() => {
    const breakdown = calculateGenderBreakdown(checkedIn)
    return { male: breakdown.men, female: breakdown.women }
  }, [checkedIn])
  
  const occupiedCourts = useMemo(() => {
    return getOccupiedCourts(matches)
  }, [matches])
  
  const currentRoundLockedCourts = useMemo(() => {
    return lockedCourts[selectedRound] || new Set<number>()
  }, [selectedRound, lockedCourts])
  
  const excludedCourts = useMemo(() => {
    const excluded = new Set(currentRoundLockedCourts)
    occupiedCourts.forEach((courtIdx) => excluded.add(courtIdx))
    return excluded
  }, [currentRoundLockedCourts, occupiedCourts])
  
  // Duplicate detection
  const [courtsWithDuplicatesSet, setCourtsWithDuplicatesSet] = useState<Set<number>>(new Set())
  const [duplicatePlayersMap, setDuplicatePlayersMap] = useState<Map<number, Set<string>>>(new Map())
  
  // Handlers
  const handleMarkUnavailable = useCallback((playerId: string) => {
    setUnavailablePlayers((prev) => new Set(prev).add(playerId))
  }, [])
  
  const handleMarkAvailable = useCallback((playerId: string) => {
    setUnavailablePlayers((prev) => {
      const newSet = new Set(prev)
      newSet.delete(playerId)
      return newSet
    })
  }, [])
  
  const handleToggleCourtLock = useCallback((courtIdx: number) => {
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
  }, [selectedRound])
  
  // Save state helper
  const saveCurrentState = useCallback((
    matches: Record<number, CourtWithPlayers[]>,
    locked: Record<number, Set<number>>,
    autoMatch: Set<number>,
    extended: Map<number, number>
  ) => {
    const currentSession = sessionRef.current
    if (!currentSession) {
      return
    }
    if (!hasRestoredStateRef.current) {
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
    
    savePersistedState(stateToPersist)
  }, [])
  
  // Update in-memory matches
  const updateInMemoryMatches = useCallback((round: number, newMatches: CourtWithPlayers[]) => {
    // Ensure all courts are always present (1-maxCourts)
    const completeMatches = ensureAllCourts(newMatches, maxCourts)
    
    // Update state and immediately save to localStorage to prevent data loss
    setInMemoryMatches((prev) => {
      const updated = { ...prev, [round]: completeMatches }
      // Immediately save using the updated state we're about to set
      if (session && hasRestoredStateRef.current) {
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
  }, [selectedRound, session, saveCurrentState, maxCourts])
  
  // Load matches for selected round
  const loadMatches = useCallback(async () => {
    if (!session) {
      // Even without session, show all empty courts
      const allCourts: CourtWithPlayers[] = Array.from({ length: maxCourts }, (_, i) => ({
        courtIdx: i + 1,
        slots: []
      }))
      setMatches(allCourts)
      return
    }
    try {
      // Check in-memory state first
      const currentInMemoryMatches = inMemoryMatchesRef.current
      if (currentInMemoryMatches[selectedRound]) {
        const currentMatches = currentInMemoryMatches[selectedRound]
        const data = ensureAllCourts(currentMatches, maxCourts)
        setMatches(data)
        return
      }
      
      // Check persisted state
      const persisted = loadPersistedState(session.id)
      if (persisted?.inMemoryMatches?.[selectedRound]) {
        const persistedMatches = persisted.inMemoryMatches[selectedRound]
        const data = ensureAllCourtsPresent(persistedMatches, maxCourts)
        setInMemoryMatches((prev) => ({ ...prev, [selectedRound]: data }))
        setMatches(data)
        return
      }
      
      // Fall back to database
      const data = await api.matches.list(selectedRound)
      // Ensure data is always an array
      const safeData = Array.isArray(data) ? data : []
      const completeData = ensureAllCourts(safeData, maxCourts)
      setInMemoryMatches((prev) => ({ ...prev, [selectedRound]: completeData }))
      setMatches(completeData)
    } catch (err: any) {
      console.error('[useMatchProgram] Error loading matches:', err)
      setError(err.message ?? 'Kunne ikke hente baner')
      // Ensure matches is always an array even on error
      setMatches([])
    }
  }, [session, selectedRound, maxCourts])
  
  // Load previous round
  const loadPreviousRound = useCallback(async (round: number) => {
    if (!session || round >= selectedRound || round < 1) return
    if (previousRoundsMatches[round]) return
    
    try {
      let data: CourtWithPlayers[]
      if (inMemoryMatches[round]) {
        data = inMemoryMatches[round]
      } else {
        const result = await api.matches.list(round)
        // Ensure result is always an array
        if (!Array.isArray(result)) {
          throw new Error('API returned invalid data format')
        }
        data = result
        const allCourts = Array.from({ length: maxCourts }, (_, i) => i + 1)
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
  }, [session, selectedRound, previousRoundsMatches, inMemoryMatches, maxCourts])
  
  // Restore persisted state on mount
  useEffect(() => {
    if (!session) {
      setMatches([])
      hasRestoredStateRef.current = false
      return
    }
    
    if (!hasRestoredStateRef.current) {
      const persisted = loadPersistedState(session.id)
      if (persisted) {
        if (persisted.inMemoryMatches && Object.keys(persisted.inMemoryMatches).length > 0) {
          setInMemoryMatches(persisted.inMemoryMatches)
          inMemoryMatchesRef.current = persisted.inMemoryMatches
        }
        
        if (persisted.lockedCourts) {
          const restored: Record<number, Set<number>> = {}
          for (const [round, courtIndices] of Object.entries(persisted.lockedCourts)) {
            restored[Number(round)] = new Set(courtIndices)
          }
          setLockedCourts(restored)
          lockedCourtsRef.current = restored
        }
        
        if (persisted.hasRunAutoMatch) {
          const restored = new Set(persisted.hasRunAutoMatch)
          setHasRunAutoMatch(restored)
          hasRunAutoMatchRef.current = restored
        }
        
        if (persisted.extendedCapacityCourts) {
          const restored = new Map(persisted.extendedCapacityCourts)
          setExtendedCapacityCourts(restored)
          extendedCapacityCourtsRef.current = restored
        }
        
        hasRestoredStateRef.current = true
        void loadMatches()
      } else {
        hasRestoredStateRef.current = true
        void loadMatches()
      }
    } else {
      void loadMatches()
    }
  }, [session, selectedRound, loadMatches])
  
  // Persist state on changes
  useEffect(() => {
    if (!session || !hasRestoredStateRef.current) return
    saveCurrentState(inMemoryMatches, lockedCourts, hasRunAutoMatch, extendedCapacityCourts)
  }, [session, inMemoryMatches, lockedCourts, hasRunAutoMatch, extendedCapacityCourts, saveCurrentState])
  
  // Save on unmount/page unload
  useEffect(() => {
    if (!session || !hasRestoredStateRef.current) return
    
    const handleBeforeUnload = () => {
      saveCurrentState(
        inMemoryMatchesRef.current,
        lockedCourtsRef.current,
        hasRunAutoMatchRef.current,
        extendedCapacityCourtsRef.current
      )
    }
    
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
  
  // Sync in-memory matches to previousRoundsMatches
  useEffect(() => {
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
  
  // Check for duplicates
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
      // Load all previous rounds first
      for (let round = 1; round < selectedRound; round++) {
        if (!previousRoundsMatches[round]) {
          try {
            let data: CourtWithPlayers[]
            if (inMemoryMatches[round]) {
              data = inMemoryMatches[round]
            } else {
              const result = await api.matches.list(round)
              // Ensure result is always an array
              if (!Array.isArray(result)) {
                throw new Error('API returned invalid data format')
              }
              data = result
              const allCourts = Array.from({ length: maxCourts }, (_, i) => i + 1)
              const matchesByCourt = new Map(data.map((court) => [court.courtIdx, court]))
              data = allCourts.map((courtIdx) => {
                const existing = matchesByCourt.get(courtIdx)
                return existing || { courtIdx, slots: [] }
              })
            }
            setPreviousRoundsMatches((prev) => ({ ...prev, [round]: data }))
          } catch {
            // Continue even if one round fails
          }
        }
      }
      
      await new Promise((resolve) => setTimeout(resolve, 100))
      
      // Check duplicates using service function
      const allPreviousRoundsMatches: Record<number, CourtWithPlayers[]> = {}
      for (let round = 1; round < selectedRound; round++) {
        allPreviousRoundsMatches[round] = inMemoryMatches[round] || previousRoundsMatches[round] || []
      }
      
      const result = findDuplicateMatchups(matches, allPreviousRoundsMatches, selectedRound)
      setCourtsWithDuplicatesSet(result.courtsWithDuplicates)
      setDuplicatePlayersMap(result.duplicatePlayersMap)
    }
    
    void checkDuplicates()
  }, [matches, selectedRound, previousRoundsMatches, inMemoryMatches, maxCourts])
  
  // Handle ESC key for full-screen
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
  
  // Track viewport size
  useEffect(() => {
    if (!isFullScreen) return
    
    let resizeTimeout: number | null = null
    const updateViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    }
    const throttledUpdateViewportSize = () => {
      if (resizeTimeout !== null) {
        clearTimeout(resizeTimeout)
      }
      resizeTimeout = window.setTimeout(() => {
        updateViewportSize()
        resizeTimeout = null
      }, 150) // 150ms debounce
    }
    
    updateViewportSize()
    window.addEventListener('resize', throttledUpdateViewportSize)
    return () => {
      window.removeEventListener('resize', throttledUpdateViewportSize)
      if (resizeTimeout !== null) {
        clearTimeout(resizeTimeout)
      }
    }
  }, [isFullScreen])
  
  // Handle popup dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      
      const maxX = window.innerWidth - popupSize.width
      const maxY = window.innerHeight - 100
      
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
  }, [isDragging, dragOffset, popupSize.width])
  
  // Handle popup resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const newWidth = e.clientX - popupPosition.x - resizeOffset.x
      const newHeight = e.clientY - popupPosition.y - resizeOffset.y
      
      const minWidth = 300
      const minHeight = 200
      const maxWidth = window.innerWidth - popupPosition.x
      const maxHeight = window.innerHeight - popupPosition.y
      
      setPopupSize({
        width: Math.max(minWidth, Math.min(newWidth, maxWidth)),
        height: Math.max(minHeight, Math.min(newHeight, maxHeight))
      })
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
    }
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing, popupPosition, resizeOffset])
  
  // Match operations (to be continued in next part due to size)
  const handleMove = useCallback(async (playerId: string, courtIdx?: number, slot?: number) => {
    if (!session) return
    try {
      // Use ref to get the latest in-memory matches to avoid stale state
      const currentMatches = inMemoryMatchesRef.current[selectedRound] || matches || await api.matches.list(selectedRound)
      const player = checkedIn.find((p) => p.id === playerId)
      if (!player) return

      const updatedMatches = currentMatches.map((court) => {
        // Remove the player from this court's slots
        const updatedSlots = court.slots.filter((s) => s.player?.id !== playerId)
        
        // If this is the target court and slot, add the player
        if (courtIdx !== undefined && court.courtIdx === courtIdx && slot !== undefined) {
          const slotEntry = updatedSlots.find((s) => s.slot === slot)
          if (!slotEntry) {
            updatedSlots.push({ slot, player })
          }
        }
        
        return { ...court, slots: updatedSlots }
      })

      // Ensure all courts are present
      const allCourts = Array.from({ length: maxCourts }, (_, i) => i + 1)
      const matchesByCourt = new Map(updatedMatches.map((court) => [court.courtIdx, court]))
      
      // If target court doesn't exist, create it
      if (courtIdx !== undefined && slot !== undefined) {
        if (!matchesByCourt.has(courtIdx)) {
          matchesByCourt.set(courtIdx, { courtIdx, slots: [{ slot, player }] })
        }
      }
      
      const completeMatches: CourtWithPlayers[] = allCourts.map((idx) => {
        const existing = matchesByCourt.get(idx)
        return existing || { courtIdx: idx, slots: [] }
      })

      updateInMemoryMatches(selectedRound, completeMatches)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke flytte spiller')
    }
  }, [session, selectedRound, checkedIn, maxCourts, matches, updateInMemoryMatches])
  
  const handleAutoMatch = useCallback(async () => {
    if (!session) return
    try {
      const isReshuffle = hasRunAutoMatch.has(selectedRound)
      
      let courtsToExclude: Set<number>
      if (!isReshuffle) {
        const currentMatchesForAutoLock = inMemoryMatches[selectedRound] || []
        const courtsToAutoLock = new Set<number>()
        
        currentMatchesForAutoLock.forEach((court) => {
          if (court.slots.some((slot) => slot.player)) {
            courtsToAutoLock.add(court.courtIdx)
          }
        })
        
        if (courtsToAutoLock.size > 0) {
          setLockedCourts((prev) => {
            const roundLocks = prev[selectedRound] || new Set<number>()
            const newSet = new Set(roundLocks)
            courtsToAutoLock.forEach((courtIdx) => newSet.add(courtIdx))
            return { ...prev, [selectedRound]: newSet }
          })
        }
        
        const allLockedCourts = new Set(currentRoundLockedCourts)
        courtsToAutoLock.forEach((courtIdx) => allLockedCourts.add(courtIdx))
        courtsToExclude = allLockedCourts
      } else {
        courtsToExclude = currentRoundLockedCourts
      }
      
      setHasRunAutoMatch((prev) => new Set(prev).add(selectedRound))
      
      const currentMatchesForLocal = inMemoryMatches[selectedRound] || []
      
      // OPTIMISTIC UPDATE: Calculate matches locally for instant UI update
      const { matches: newMatches, result } = localAutoMatch({
        checkedIn,
        currentMatches: currentMatchesForLocal,
        maxCourts,
        selectedRound,
        unavailablePlayers,
        activatedOneRoundPlayers,
        lockedCourtIdxs: courtsToExclude,
        isReshuffle,
        extendedCapacityCourts
      })
      
      // Merge with locked courts
      const keptCourtsMatches = currentMatchesForLocal.filter((court) => courtsToExclude.has(court.courtIdx))
      const newMatchesWithoutKept = newMatches.filter((court) => !courtsToExclude.has(court.courtIdx))
      const finalMatches = [...keptCourtsMatches, ...newMatchesWithoutKept]
      
      // Update UI immediately (optimistic)
      updateInMemoryMatches(selectedRound, finalMatches)
      
      notify({
        variant: 'success',
        title: isReshuffle
          ? `Omfordelt spillere på ${result.filledCourts} baner (Runde ${selectedRound})`
          : `Fordelte spillere på ${result.filledCourts} baner (Runde ${selectedRound})`
      })

      // Mark that auto-match just ran to prevent duplicate toast from useEffect
      justRanAutoMatchRef.current = true
      setTimeout(() => {
        justRanAutoMatchRef.current = false
      }, 1000)
      
      // Sync with database in background (non-blocking, matches saved on session end anyway)
      // This is optional - matches are already saved when ending session
      api.matches.autoArrange(
        selectedRound,
        unavailablePlayers,
        activatedOneRoundPlayers,
        courtsToExclude,
        isReshuffle,
        currentMatchesForLocal,
        extendedCapacityCourts
      ).catch((err) => {
        // Log error but don't block UI - matches will be saved on session end
        console.warn('[handleAutoMatch] Background sync failed (non-critical):', err)
      })
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke matche spillere')
    }
  }, [session, selectedRound, checkedIn, unavailablePlayers, activatedOneRoundPlayers, inMemoryMatches, currentRoundLockedCourts, extendedCapacityCourts, hasRunAutoMatch, maxCourts, updateInMemoryMatches, notify])
  
  const handleResetMatches = useCallback(async () => {
    if (!session) return
    try {
      const currentMatches = inMemoryMatches[selectedRound] || []
      const allCourts = Array.from({ length: maxCourts }, (_, i) => i + 1)
      const matchesByCourt = new Map(currentMatches.map((court) => [court.courtIdx, court]))
      
      const updatedMatches: CourtWithPlayers[] = allCourts.map((courtIdx) => {
        const existing = matchesByCourt.get(courtIdx)
        if (currentRoundLockedCourts.has(courtIdx) && existing) {
          return existing
        }
        return existing ? { ...existing, slots: [] } : { courtIdx, slots: [] }
      })
      
      updateInMemoryMatches(selectedRound, updatedMatches)
      
      notify({
        variant: 'success',
        title: 'Kampe nulstillet (låste baner bevares)'
      })
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke nulstille kampe')
    }
  }, [session, selectedRound, inMemoryMatches, currentRoundLockedCourts, maxCourts, updateInMemoryMatches, notify])
  
  const _handleActivateOneRoundPlayer = useCallback(async (playerId: string) => {
    if (!session) return
    try {
      // Ensure player is not on a court
      // This will be handled by handleMove
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
  }, [session, unavailablePlayers, handleMarkAvailable, handleMove])
  
  const onDropToBench = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    const playerId = event.dataTransfer.getData('application/x-player-id')
    if (!playerId) return
    event.preventDefault()
    
    // Player will be automatically placed in the correct gender section based on their gender
    // No need to validate target gender - just move the player to bench
    await handleMove(playerId)
    if (unavailablePlayers.has(playerId)) {
      handleMarkAvailable(playerId)
    }
  }, [handleMove, unavailablePlayers, handleMarkAvailable])
  
  const onDropToInactive = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    const playerId = event.dataTransfer.getData('application/x-player-id')
    if (!playerId) return
    event.preventDefault()
    await handleMove(playerId)
    handleMarkUnavailable(playerId)
  }, [handleMove, handleMarkUnavailable])
  
  const onDropToSlot = useCallback(async (
    event: React.DragEvent<HTMLElement>,
    courtIdx: number,
    slot: number
  ) => {
    const playerId = event.dataTransfer.getData('application/x-player-id')
    if (!playerId) return
    event.preventDefault()
    
    // Use ref to get the latest in-memory matches to avoid stale state
    const currentMatches = inMemoryMatchesRef.current[selectedRound] || matches
    const targetCourt = currentMatches.find((c) => c.courtIdx === courtIdx)
    const targetSlotEntry = targetCourt?.slots.find((s) => s.slot === slot)
    const occupyingPlayer = targetSlotEntry?.player
    
    const sourceCourtIdxStr = event.dataTransfer.getData('application/x-source-court-idx')
    const sourceSlotStr = event.dataTransfer.getData('application/x-source-slot')
    const sourceCourtIdx = sourceCourtIdxStr ? Number(sourceCourtIdxStr) : undefined
    const sourceSlot = sourceSlotStr ? Number(sourceSlotStr) : undefined
    
    const player = checkedIn.find((p) => p.id === playerId)
    if (!player) return

    if (occupyingPlayer && occupyingPlayer.id !== playerId) {
      // Swap logic (simplified - full implementation in component)
      const updatedMatches = currentMatches.map((court) => {
        if (court.courtIdx === courtIdx) {
          if (sourceCourtIdx === courtIdx && sourceSlot !== undefined) {
            const updatedSlots = court.slots.map((s) => {
              if (s.slot === slot) {
                return { slot: s.slot, player }
              } else if (s.slot === sourceSlot) {
                return { slot: s.slot, player: occupyingPlayer }
              }
              return s
            })
            return { ...court, slots: updatedSlots }
          } else {
            const updatedSlots = court.slots
              .filter((s) => s.slot !== slot && s.player?.id !== playerId)
              .map((s) => {
                if (sourceCourtIdx === courtIdx && sourceSlot !== undefined && s.slot === sourceSlot) {
                  return { slot: s.slot, player: occupyingPlayer }
                }
                return s
              })
            updatedSlots.push({ slot, player })
            if (sourceCourtIdx === courtIdx && sourceSlot !== undefined && !updatedSlots.find((s) => s.slot === sourceSlot)) {
              updatedSlots.push({ slot: sourceSlot, player: occupyingPlayer })
            }
            return { ...court, slots: updatedSlots }
          }
        } else if (sourceCourtIdx !== undefined && court.courtIdx === sourceCourtIdx) {
          const updatedSlots = court.slots
            .filter((s) => s.player?.id !== playerId)
            .map((s) => {
              if (sourceSlot !== undefined && s.slot === sourceSlot && occupyingPlayer) {
                return { slot: s.slot, player: occupyingPlayer }
              }
              return s
            })
          if (sourceSlot !== undefined && !updatedSlots.find((s) => s.slot === sourceSlot) && occupyingPlayer) {
            updatedSlots.push({ slot: sourceSlot, player: occupyingPlayer })
          }
          return { ...court, slots: updatedSlots }
        } else {
          return { ...court, slots: court.slots.filter((s) => s.player?.id !== playerId) }
        }
      })

      const allCourts = Array.from({ length: maxCourts }, (_, i) => i + 1)
      const matchesByCourt = new Map(updatedMatches.map((court) => [court.courtIdx, court]))
      const completeMatches: CourtWithPlayers[] = allCourts.map((idx) => {
        const existing = matchesByCourt.get(idx)
        return existing || { courtIdx: idx, slots: [] }
      })
      
      updateInMemoryMatches(selectedRound, completeMatches)
      
      setRecentlySwappedPlayers(new Set([playerId, occupyingPlayer.id]))
      setTimeout(() => {
        setRecentlySwappedPlayers(new Set())
      }, 1000)
    } else {
      await handleMove(playerId, courtIdx, slot)
    }
  }, [selectedRound, matches, checkedIn, maxCourts, updateInMemoryMatches, handleMove])
  
  const onDropToCourt = useCallback(async (event: React.DragEvent<HTMLDivElement>, _courtIdx: number) => {
    event.preventDefault()
    setDragOverCourt(null)
  }, [])
  
  // State management
  const clearAllState = useCallback(() => {
    setInMemoryMatches({})
    setLockedCourts({})
    setHasRunAutoMatch(new Set())
    setExtendedCapacityCourts(new Map())
    setMatches([])
    setSelectedRound(1)
    setUnavailablePlayers(new Set())
    setActivatedOneRoundPlayers(new Set())
    setPreviousRoundsMatches({})
    setPreviousRoundsVisible(new Set())
    hasRestoredStateRef.current = false
    clearPersistedState()
  }, [])
  
  // Session handlers
  const handleStartTraining = useCallback(async () => {
    try {
      await startSession()
      notify({ variant: 'success', title: 'Træning startet' })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Kunne ikke starte træning'
      setError(errorMessage)
    }
  }, [startSession, notify, setError])
  
  const handleEndTraining = useCallback(async () => {
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
      await endSession(allMatchesData)
      clearAllState() // Clear all match program state and persisted state
      notify({ variant: 'success', title: 'Træning afsluttet' })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Kunne ikke afslutte træning'
      setError(errorMessage)
    }
  }, [session, inMemoryMatches, endSession, notify, setError, clearAllState])
  
  // UI handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return // Don't drag if clicking buttons
    setIsDragging(true)
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }, [])
  
  const handleResizeStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    setResizeOffset({
      x: e.clientX - rect.right,
      y: e.clientY - rect.bottom
    })
  }, [])
  
  
  const handleExtendedCapacityChange = useCallback((courtIdx: number, capacity: number | null) => {
    setExtendedCapacityCourts((prev) => {
      const newMap = new Map(prev)
      if (capacity === null) {
        newMap.delete(courtIdx)
      } else {
        newMap.set(courtIdx, capacity)
      }
      return newMap
    })
  }, [])
  
  const handleTogglePreviousRounds = useCallback(async () => {
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
  }, [selectedRound, previousRoundsMatches, loadPreviousRound, previousRoundsVisible])
  
  // Drag handlers (wrappers for child components)
  const handleSlotDragStart = useCallback((event: React.DragEvent<HTMLDivElement>, player: Player, courtIdx: number, slotIndex: number) => {
    setDragSource('court')
    event.dataTransfer.setData('application/x-player-id', player.id)
    event.dataTransfer.setData('application/x-source-court-idx', String(courtIdx))
    event.dataTransfer.setData('application/x-source-slot', String(slotIndex))
    event.dataTransfer.effectAllowed = 'move'
  }, [])
  
  const handleSlotDragEnd = useCallback(() => {
    setDragSource(null)
    dragOverSlotRef.current = null
    dragOverCourtRef.current = null
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    setDragOverSlot(null)
    setDragOverCourt(null)
  }, [])
  
  const handleSlotDragOver = useCallback((event: React.DragEvent<HTMLDivElement>, courtIdx: number, slotIndex: number) => {
    event.preventDefault()
    const newSlot = { courtIdx, slot: slotIndex }
    if (dragOverSlotRef.current?.courtIdx !== newSlot.courtIdx || dragOverSlotRef.current?.slot !== newSlot.slot) {
      dragOverSlotRef.current = newSlot
      updateDragOverState()
    }
  }, [updateDragOverState])
  
  const handleSlotDragLeave = useCallback(() => {
    dragOverSlotRef.current = null
    updateDragOverState()
  }, [updateDragOverState])
  
  const handleSlotDrop = useCallback((event: React.DragEvent<HTMLDivElement>, courtIdx: number, slotIndex: number) => {
    dragOverSlotRef.current = null
    dragOverCourtRef.current = null
    setDragOverSlot(null)
    setDragOverCourt(null)
    void onDropToSlot(event, courtIdx, slotIndex)
  }, [onDropToSlot])
  
  const handleBenchDragStart = useCallback((event: React.DragEvent<HTMLDivElement>, playerId: string) => {
    setDragSource('bench')
    event.dataTransfer.setData('application/x-player-id', playerId)
    event.dataTransfer.effectAllowed = 'move'
  }, [])
  
  const handleBenchDragEnd = useCallback(() => {
    setDragSource(null)
  }, [])
  
  const handleInactiveDragStart = useCallback((event: React.DragEvent<HTMLDivElement>, playerId: string) => {
    setDragSource('inactive')
    event.dataTransfer.setData('application/x-player-id', playerId)
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
  }, [])
  
  const handleInactiveDragEnd = useCallback(() => {
    setDragSource(null)
  }, [])
  
  const handleBenchDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOverBench(true)
  }, [])
  
  const handleBenchDragLeave = useCallback(() => {
    setDragOverBench(false)
  }, [])
  
  const handleBenchDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    setDragOverBench(false)
    setDragSource(null)
    onDropToBench(event)
  }, [onDropToBench])
  
  const handleInactiveDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (dragSource === 'inactive') {
      return
    }
    event.preventDefault()
    setDragOverInactive(true)
  }, [dragSource])
  
  const handleInactiveDragLeave = useCallback((_event: React.DragEvent<HTMLDivElement>) => {
    if (dragSource === 'inactive') {
      return
    }
    setDragOverInactive(false)
  }, [dragSource])
  
  const handleInactiveDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (dragSource === 'inactive') {
      return
    }
    setDragOverInactive(false)
    event.preventDefault()
    onDropToInactive(event)
  }, [dragSource, onDropToInactive])
  
  const handleCourtDragOver = useCallback((event: React.DragEvent<HTMLDivElement>, courtIdx: number) => {
    event.preventDefault()
    if (dragOverCourtRef.current !== courtIdx) {
      dragOverCourtRef.current = courtIdx
      updateDragOverState()
    }
  }, [updateDragOverState])
  
  const handleCourtDragLeave = useCallback(() => {
    dragOverCourtRef.current = null
    dragOverSlotRef.current = null
    updateDragOverState()
  }, [updateDragOverState])
  
  const handleCourtDrop = useCallback((event: React.DragEvent<HTMLDivElement>, courtIdx: number) => {
    void onDropToCourt(event, courtIdx)
  }, [onDropToCourt])
  
  // Side effects: keyboard and click outside handlers
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
  
  useEffect(() => {
    setMoveMenuPlayer(null)
  }, [selectedRound])
  
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
  
  // Fix handleActivateOneRoundPlayer dependency
  const handleActivateOneRoundPlayerFixed = useCallback(async (playerId: string) => {
    if (!session) return
    try {
      await handleMove(playerId)
      if (unavailablePlayers.has(playerId)) {
        handleMarkAvailable(playerId)
      }
      setActivatedOneRoundPlayers((prev) => new Set(prev).add(playerId))
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke aktivere spiller')
    }
  }, [session, handleMove, unavailablePlayers, handleMarkAvailable])
  
  return {
    // State
    matches,
    selectedRound,
    setSelectedRound,
    error,
    setError,
    
    // Player management
    unavailablePlayers,
    activatedOneRoundPlayers,
    handleMarkUnavailable,
    handleMarkAvailable,
    handleActivateOneRoundPlayer: handleActivateOneRoundPlayerFixed,
    
    // Drag and drop
    dragOverInactive,
    dragOverBench,
    dragSource,
    dragOverCourt,
    dragOverSlot,
    recentlySwappedPlayers,
    setDragSource,
    setDragOverInactive,
    setDragOverBench,
    setDragOverCourt,
    setDragOverSlot,
    
    // Computed values
    assignedIds,
    bench,
    inactivePlayers,
    genderBreakdown,
    occupiedCourts,
    currentRoundLockedCourts,
    excludedCourts,
    
    // Court management
    extendedCapacityCourts,
    setExtendedCapacityCourts,
    lockedCourts,
    handleToggleCourtLock,
    
    // Match operations
    handleMove,
    handleAutoMatch,
    handleResetMatches,
    onDropToBench,
    onDropToInactive,
    onDropToSlot,
    onDropToCourt,
    
    // Duplicate detection
    courtsWithDuplicatesSet,
    duplicatePlayersMap,
    
    // Previous rounds
    previousRoundsMatches,
    previousRoundsVisible,
    setPreviousRoundsVisible,
    loadPreviousRound,
    
    // UI state
    moveMenuPlayer,
    setMoveMenuPlayer,
    isFullScreen,
    setIsFullScreen,
    viewportSize,
    popupPosition,
    setPopupPosition,
    popupSize,
    setPopupSize,
    isDragging,
    setIsDragging,
    isResizing,
    setIsResizing,
    dragOffset,
    setDragOffset,
    resizeOffset,
    setResizeOffset,
    
    // Internal refs
    dragOverSlotRef,
    dragOverCourtRef,
    rafIdRef,
    updateDragOverState,
    
    // Internal state
    inMemoryMatches,
    hasRunAutoMatch,
    updateInMemoryMatches,
    
    // State management
    clearAllState,
    
    // Session handlers
    handleStartTraining,
    handleEndTraining,
    
    // UI handlers
    handleMouseDown,
    handleResizeStart,
    handleExtendedCapacityChange,
    handleTogglePreviousRounds,
    
    // Drag handlers (wrappers for child components)
    handleSlotDragStart,
    handleSlotDragEnd,
    handleSlotDragOver,
    handleSlotDragLeave,
    handleSlotDrop,
    handleBenchDragStart,
    handleBenchDragEnd,
    handleInactiveDragStart,
    handleInactiveDragEnd,
    handleBenchDragOver,
    handleBenchDragLeave,
    handleBenchDrop,
    handleInactiveDragOver,
    handleInactiveDragLeave,
    handleInactiveDrop,
    handleCourtDragOver,
    handleCourtDragLeave,
    handleCourtDrop
  }
}

