import { z } from 'zod'
import type {
  AutoArrangeResult,
  CheckIn,
  CheckedInPlayer,
  CourtWithPlayers,
  Match,
  MatchMovePayload,
  Player,
  PlayerCreateInput,
  PlayerListFilters,
  PlayerUpdateInput,
  TrainingSession
} from '@herlev-hjorten/common'
import {
  createId,
  createBackup,
  restoreFromBackup,
  hasBackup,
  getStateCopy,
  getPlayers,
  createPlayer as createPlayerInDb,
  updatePlayer as updatePlayerInDb,
  getSessions,
  createSession as createSessionInDb,
  updateSession as updateSessionInDb,
  getCheckIns,
  createCheckIn as createCheckInInDb,
  deleteCheckIn as deleteCheckInInDb,
  getCourts,
  getMatches,
  createMatch as createMatchInDb,
  updateMatch as updateMatchInDb,
  deleteMatch as deleteMatchInDb,
  getMatchPlayers,
  createMatchPlayer as createMatchPlayerInDb,
  updateMatchPlayer as updateMatchPlayerInDb,
  deleteMatchPlayer as deleteMatchPlayerInDb
} from './supabase'
import { getCurrentTenantConfig } from '../lib/supabase'
import statsApi from './stats'

/**
 * Normalizes player data — ensures nullable fields are null (not undefined).
 * @param player - Player to normalize
 * @returns Normalized player
 */
const normalisePlayer = (player: Player): Player => ({
  ...player,
  alias: player.alias ?? null,
  level: player.level ?? null,
  gender: player.gender ?? null,
  primaryCategory: player.primaryCategory ?? null,
  active: Boolean(player.active)
})

/** Zod schema for player creation input validation. */
const playerCreateSchema = z.object({
  name: z.string().min(1),
  alias: z.string().min(1).optional(),
  level: z.number().optional(),
  gender: z.enum(['Herre', 'Dame']).optional(),
  primaryCategory: z.enum(['Single', 'Double', 'Begge']).optional(),
  active: z.boolean().optional()
})

/** Zod schema for player update input validation. */
const playerUpdateSchema = z.object({
  id: z.string().min(1),
  patch: z
    .object({
      name: z.string().min(1).optional(),
      alias: z.string().nullable().optional(),
      level: z.number().nullable().optional(),
      levelSingle: z.number().nullable().optional(),
      levelDouble: z.number().nullable().optional(),
      levelMix: z.number().nullable().optional(),
      gender: z.enum(['Herre', 'Dame']).nullable().optional(),
      primaryCategory: z.enum(['Single', 'Double', 'Begge']).nullable().optional(),
      active: z.boolean().optional(),
      preferredDoublesPartners: z.array(z.string()).nullable().optional(),
      preferredMixedPartners: z.array(z.string()).nullable().optional()
    })
    .refine((value) => Object.keys(value).length > 0, 'patch must update mindst ét felt')
})

/**
 * Lists players with optional filters (search, active status).
 * @param filters - Optional filters (q for search, active for status)
 * @returns Array of normalized players
 */
const listPlayers = async (filters?: PlayerListFilters): Promise<Player[]> => {
  const players = await getPlayers()
  const term = filters?.q?.trim().toLowerCase()
  const filtered = players.filter((player) => {
    if (filters?.active !== undefined && Boolean(player.active) !== filters.active) {
      return false
    }
    if (!term) return true
    const alias = player.alias ?? ''
    return player.name.toLowerCase().includes(term) || alias.toLowerCase().includes(term)
  })
  return filtered
    .map(normalisePlayer)
    .sort((a: Player, b: Player) => a.name.localeCompare(b.name, 'da'))
}

/**
 * Creates a new player.
 * @param input - Player creation input
 * @returns Created and normalized player
 */
const createPlayer = async (input: PlayerCreateInput): Promise<Player> => {
  const parsed = playerCreateSchema.parse(input)
  const created = await createPlayerInDb({
    name: parsed.name.trim(),
    alias: parsed.alias ? parsed.alias.trim() : null,
    level: parsed.level ?? null,
    gender: parsed.gender ?? null,
    primaryCategory: parsed.primaryCategory ?? null,
    active: parsed.active ?? true
  })
  return normalisePlayer(created)
}

/**
 * Updates an existing player.
 * @param input - Player update input (id + patch)
 * @returns Updated and normalized player
 * @throws Error if player not found
 */
const updatePlayer = async (input: PlayerUpdateInput): Promise<Player> => {
  const parsed = playerUpdateSchema.parse(input)
  const updateData: Partial<Omit<Player, 'id' | 'createdAt'>> = {}
  if (parsed.patch.name !== undefined) updateData.name = parsed.patch.name.trim()
  if (parsed.patch.alias !== undefined) updateData.alias = parsed.patch.alias
  if (parsed.patch.level !== undefined) updateData.level = parsed.patch.level
  if (parsed.patch.levelSingle !== undefined) updateData.levelSingle = parsed.patch.levelSingle
  if (parsed.patch.levelDouble !== undefined) updateData.levelDouble = parsed.patch.levelDouble
  if (parsed.patch.levelMix !== undefined) updateData.levelMix = parsed.patch.levelMix
  if (parsed.patch.gender !== undefined) updateData.gender = parsed.patch.gender
  if (parsed.patch.primaryCategory !== undefined) updateData.primaryCategory = parsed.patch.primaryCategory
  if (parsed.patch.active !== undefined) updateData.active = parsed.patch.active
  if (parsed.patch.preferredDoublesPartners !== undefined) updateData.preferredDoublesPartners = parsed.patch.preferredDoublesPartners
  if (parsed.patch.preferredMixedPartners !== undefined) updateData.preferredMixedPartners = parsed.patch.preferredMixedPartners

  const updated = await updatePlayerInDb(parsed.id, updateData)
  return normalisePlayer(updated)
}

/** Players API — CRUD operations for players. */
const playersApi = {
  list: listPlayers,
  create: createPlayer,
  update: updatePlayer
}

/**
 * Gets the active training session (if any).
 * @returns Active session or null
 */
const getActiveSession = async (): Promise<TrainingSession | null> => {
  const sessions = await getSessions()
  const active = sessions
    .filter((session) => session.status === 'active')
    .sort((a: TrainingSession, b: TrainingSession) => b.createdAt.localeCompare(a.createdAt))[0]
  return active ?? null
}

/**
 * Ensures an active session exists (throws if none).
 * @returns Active session
 * @throws Error if no active session
 */
const ensureActiveSession = async (): Promise<TrainingSession> => {
  const active = await getActiveSession()
  if (!active) {
    throw new Error('Ingen aktiv træning')
  }
  return active
}

/**
 * Starts a new session or returns existing active session.
 * @returns Active session
 */
const startOrGetActiveSession = async (): Promise<TrainingSession> => {
  const active = await getActiveSession()
  if (active) return active

  const now = new Date().toISOString()
  const session = await createSessionInDb({
    date: now,
    status: 'active'
  })
  return session
}

/**
 * Saves all match data for the active session to the database.
 * This is called when ending the training session to persist all match changes.
 * @param matchesData - Array of CourtWithPlayers for all rounds
 * @throws Error if no active session
 */
const saveAllMatches = async (matchesData: Array<{ round: number; matches: CourtWithPlayers[] }>): Promise<void> => {
  const active = await getActiveSession()
  if (!active) {
    throw new Error('Ingen aktiv træning')
  }

  const state = await getStateCopy()
  const courts = state.courts
  const startedAt = new Date().toISOString()

  // Delete all existing matches for this session (we'll recreate them)
  const existingMatches = state.matches.filter((match: Match) => match.sessionId === active.id)
  const existingMatchIds = existingMatches.map((m: Match) => m.id)
  const existingMatchPlayers = state.matchPlayers.filter((mp) => existingMatchIds.includes(mp.matchId))
  
  // Delete all match players first
  await Promise.all(existingMatchPlayers.map((mp) => deleteMatchPlayerInDb(mp.id)))
  // Then delete all matches
  await Promise.all(existingMatchIds.map((matchId) => deleteMatchInDb(matchId)))

  // Create all matches and match players for all rounds
  for (const { round, matches: roundMatches } of matchesData) {
    for (const courtMatch of roundMatches) {
      const court = courts.find((c) => c.idx === courtMatch.courtIdx)
      if (!court || courtMatch.slots.length === 0) continue

      // Create match for this court and round
      const match = await createMatchInDb({
        sessionId: active.id,
        courtId: court.id,
        startedAt,
        endedAt: null,
        round
      })

      // Create match players for all slots
      for (const slot of courtMatch.slots) {
        if (slot.player) {
          await createMatchPlayerInDb({
            matchId: match.id,
            playerId: slot.player.id,
            slot: slot.slot
          })
        }
      }
    }
  }
}

/**
 * Ends the active session and marks all related matches as ended.
 * @param matchesData - Optional array of CourtWithPlayers for all rounds to save before ending
 * @throws Error if no active session
 * @remarks Automatically creates a statistics snapshot when session ends.
 */
const endActiveSession = async (matchesData?: Array<{ round: number; matches: CourtWithPlayers[] }>): Promise<void> => {
  const active = await getActiveSession()
  if (!active) {
    throw new Error('Ingen aktiv træning')
  }

  // Save all match data if provided (in-memory changes)
  if (matchesData && matchesData.length > 0) {
    await saveAllMatches(matchesData)
  }

  // Update session status to ended
  await updateSessionInDb(active.id, { status: 'ended' })

  // Update all matches for this session with endedAt
  const matches = await getMatches()
  const sessionMatches = matches.filter((match: Match) => match.sessionId === active.id)
  const endedAt = new Date().toISOString()
  await Promise.all(sessionMatches.map((match) => updateMatchInDb(match.id, { endedAt })))

  // Create statistics snapshot after session is marked as ended
  try {
    await statsApi.snapshotSession(active.id)
  } catch (err) {
    // Log error but don't fail the session ending
    console.error('Failed to create statistics snapshot:', err)
  }
}

/** Session API — manages training sessions. */
const sessionApi = {
  startOrGetActive: startOrGetActiveSession,
  getActive: getActiveSession,
  endActive: endActiveSession,
  saveAllMatches
}

/**
 * Adds a player check-in for the active session.
 * @param input - Check-in input (playerId, optional maxRounds)
 * @returns Created check-in
 * @throws Error if player not found, inactive, or already checked in
 */
const addCheckIn = async (input: { playerId: string; maxRounds?: number }) => {
  const session = await ensureActiveSession()
  const players = await getPlayers()
  const player = players.find((item) => item.id === input.playerId)
  if (!player) {
    throw new Error('Spiller ikke fundet')
  }
  if (!player.active) {
    throw new Error('Spiller er inaktiv')
  }
  const checkIns = await getCheckIns()
  const existing = checkIns.find(
    (checkIn) => checkIn.sessionId === session.id && checkIn.playerId === input.playerId
  )
  if (existing) {
    throw new Error('Spilleren er allerede tjekket ind')
  }
  const checkIn = await createCheckInInDb({
    sessionId: session.id,
    playerId: input.playerId,
    maxRounds: input.maxRounds ?? null
  })
  return checkIn
}

/**
 * Lists checked-in players for the active session.
 * @returns Array of checked-in players with full player data
 * @throws Error if no active session
 */
const listActiveCheckIns = async (): Promise<CheckedInPlayer[]> => {
  const session = await ensureActiveSession()
  const [checkIns, players] = await Promise.all([getCheckIns(), getPlayers()])
  return checkIns
    .filter((checkIn: CheckIn) => checkIn.sessionId === session.id)
    .sort((a: CheckIn, b: CheckIn) => a.createdAt.localeCompare(b.createdAt))
    .map((checkIn: CheckIn) => {
      const player = players.find((p: Player) => p.id === checkIn.playerId)
      if (!player) throw new Error('Manglende spillerdata')
      return {
        ...normalisePlayer(player),
        checkInAt: checkIn.createdAt,
        maxRounds: checkIn.maxRounds ?? null
      }
    })
}

/**
 * Removes a player check-in for the active session.
 * @param input - Check-in input (playerId)
 * @throws Error if player not checked in or no active session
 */
const removeCheckIn = async (input: { playerId: string }) => {
  const session = await ensureActiveSession()
  const checkIns = await getCheckIns()
  const checkIn = checkIns.find(
    (checkIn: CheckIn) => checkIn.sessionId === session.id && checkIn.playerId === input.playerId
  )
  if (!checkIn) {
    throw new Error('Spilleren er ikke tjekket ind')
  }
  await deleteCheckInInDb(checkIn.id)
}

/** Check-ins API — manages player check-ins for training sessions. */
const checkInsApi = {
  add: addCheckIn,
  remove: removeCheckIn,
  listActive: listActiveCheckIns
}

/**
 * Lists court assignments for the active session (optionally filtered by round).
 * @param round - Optional round number (1-4)
 * @returns Array of courts with player slots
 */
const listMatches = async (round?: number): Promise<CourtWithPlayers[]> => {
  const [state, session] = await Promise.all([getStateCopy(), getActiveSession()])
  const courts = [...state.courts].sort((a, b) => a.idx - b.idx)
  if (!session) {
    return courts.map((court) => ({ courtIdx: court.idx, slots: [] }))
  }

  let matches = state.matches.filter((match: Match) => match.sessionId === session.id)
  
  // Filter by round if specified
  if (round !== undefined) {
    matches = matches.filter((match: Match) => {
      // If round is specified, show only matches for that round
      // If round is null/undefined on match, treat as round 1 (for backward compatibility)
      const matchRound = match.round ?? 1
      return matchRound === round
    })
  }

  if (!matches.length) {
    return courts.map((court) => ({ courtIdx: court.idx, slots: [] }))
  }

  const grouped = new Map<number, CourtWithPlayers['slots']>()
  const playersMap = new Map(state.players.map((player: Player) => [player.id, normalisePlayer(player)]))

  matches.forEach((match: Match) => {
    const court = state.courts.find((court) => court.id === match.courtId)
    if (!court) return
    grouped.set(court.idx, [])
  })

  state.matchPlayers
    .filter((mp) => matches.some((match: Match) => match.id === mp.matchId))
    .forEach((mp) => {
      const match = matches.find((m: Match) => m.id === mp.matchId)
      if (!match) return
      const court = state.courts.find((court) => court.id === match.courtId)
      if (!court) return
      const player = playersMap.get(mp.playerId)
      if (!player) return
      const slots = grouped.get(court.idx) ?? []
      slots.push({ slot: mp.slot, player })
      grouped.set(court.idx, slots)
    })

  return courts.map((court) => ({
    courtIdx: court.idx,
    slots: (grouped.get(court.idx) ?? []).sort((a, b) => a.slot - b.slot)
  }))
}

/**
 * Resets all court assignments for the active session.
 * @throws Error if no active session
 */
const resetMatches = async (): Promise<void> => {
  const session = await ensureActiveSession()
  const [matches, matchPlayers] = await Promise.all([getMatches(), getMatchPlayers()])
  const sessionMatchIds = matches.filter((match: Match) => match.sessionId === session.id).map((m: Match) => m.id)
  
  // Delete all match players for these matches
  for (const mp of matchPlayers) {
    if (sessionMatchIds.includes(mp.matchId)) {
      await deleteMatchPlayerInDb(mp.id)
    }
  }
  
  // Delete all matches for this session
  for (const matchId of sessionMatchIds) {
    await deleteMatchInDb(matchId)
  }
}

/**
 * Resets court assignments for a specific round, respecting locked courts.
 * Performs bulk deletion for instant UX.
 * @param round - Round number to reset (defaults to 1)
 * @param lockedCourtIdxs - Set of court indices that should be preserved
 * @throws Error if no active session
 */
const resetMatchesForRound = async (round?: number, lockedCourtIdxs?: Set<number>): Promise<void> => {
  const session = await ensureActiveSession()
  const state = await getStateCopy()
  const stateCourts = [...state.courts].sort((a, b) => a.idx - b.idx)
  
  // Get matches for this round
  const roundMatches = state.matches.filter(
    (match: Match) => match.sessionId === session.id && (match.round ?? 1) === (round ?? 1)
  )
  
  // Filter out matches from locked courts
  const matchesToReset = roundMatches.filter((match: Match) => {
    const court = stateCourts.find((c) => c.id === match.courtId)
    return court && !lockedCourtIdxs?.has(court.idx)
  })
  
  const matchIdsToReset = matchesToReset.map((m: Match) => m.id)
  
  if (matchIdsToReset.length === 0) {
    return // Nothing to reset
  }
  
  // Get all match players for these matches
  const matchPlayersToDelete = state.matchPlayers.filter((mp) => 
    matchIdsToReset.includes(mp.matchId)
  )
  
  // Bulk delete all match players at once
  const deletePlayerPromises = matchPlayersToDelete.map((mp) => deleteMatchPlayerInDb(mp.id))
  await Promise.all(deletePlayerPromises)
  
  // Bulk delete all matches at once
  const deleteMatchPromises = matchIdsToReset.map((matchId) => deleteMatchInDb(matchId))
  await Promise.all(deleteMatchPromises)
}

/**
 * Auto-arranges players into balanced matches using smart algorithm.
 * @param round - Optional round number (1-4) for duplicate detection
 * @param unavailablePlayerIds - Optional set of player IDs to exclude from auto-matching (inactive players)
 * @param activatedOneRoundPlayers - Optional set of player IDs who have maxRounds === 1 but are manually activated
 * @param lockedCourtIdxs - Optional set of court indices that should be excluded from auto-matching
 * @param isReshuffle - If true, includes players from non-locked courts in the reshuffle pool
 * @param currentMatches - Optional current in-memory matches for this round (used to identify players on locked courts)
 * @returns Result with filled courts count and benched players count
 * @remarks For rounds 2+, avoids repeating previous matchups (3+ same players).
 * Prioritizes Double players in 2v2 matches, balances levels, and avoids
 * duplicate partners/opponents from earlier rounds. Excludes inactive/unavailable players
 * and players with maxRounds === 1 (unless manually activated). Includes randomization
 * to allow different outcomes on re-shuffle.
 */
const autoArrangeMatches = async (round?: number, unavailablePlayerIds?: Set<string>, activatedOneRoundPlayers?: Set<string>, lockedCourtIdxs?: Set<number>, isReshuffle?: boolean, currentMatches?: CourtWithPlayers[]): Promise<{ matches: CourtWithPlayers[]; result: AutoArrangeResult }> => {
  const session = await ensureActiveSession()
  const state = await getStateCopy()
  const checkIns = state.checkIns
    .filter((checkIn: CheckIn) => checkIn.sessionId === session.id)
    .sort((a: CheckIn, b: CheckIn) => a.createdAt.localeCompare(b.createdAt))

  if (!checkIns.length) {
    return { filledCourts: 0, benched: 0 }
  }

  const stateCourts = [...state.courts].sort((a, b) => a.idx - b.idx)
  
  // Filter matches: exclude players already in the same round (allow same player in different rounds)
  const existingMatchesInRound = state.matches.filter(
    (match: Match) => match.sessionId === session.id && (match.round ?? 1) === (round ?? 1)
  )
  
  // Only exclude players who are already assigned in THIS round
  // BUT: exclude players on locked courts from being reassigned (they should stay on locked courts)
  // For both initial auto-match and reshuffle: include players from non-locked courts in the pool to be reshuffled
  // First, get players from locked courts from current in-memory matches (if provided)
  const playersOnLockedCourts = new Set<string>()
  if (currentMatches && lockedCourtIdxs) {
    for (const court of currentMatches) {
      if (lockedCourtIdxs.has(court.courtIdx)) {
        for (const slot of court.slots) {
          if (slot.player?.id) {
            playersOnLockedCourts.add(slot.player.id)
          }
        }
      }
    }
  }
  
  const assignedPlayers = new Set(
    state.matchPlayers
      .filter((mp) => {
        const match = existingMatchesInRound.find((m) => m.id === mp.matchId)
        if (!match) return false
        // If court is locked, exclude this player from being reassigned
        const court = stateCourts.find((c) => c.id === match.courtId)
        if (court && lockedCourtIdxs?.has(court.idx)) {
          return true // Exclude players on locked courts from being reassigned
        }
        // For initial auto-match: exclude all players already on courts (they stay where they are)
        // For reshuffle: include players from non-locked courts in the reshuffle pool
        if (isReshuffle) {
          return false // Don't exclude - they'll be reshuffled
        }
        // For initial auto-match: exclude all players already assigned (keep them on their courts)
        return true
      })
      .map((mp) => mp.playerId)
  )
  
  // Also add players from locked courts from in-memory matches (if provided)
  playersOnLockedCourts.forEach((playerId) => assignedPlayers.add(playerId))

  // Get bench players with their full data
  // Exclude players already assigned to courts, inactive/unavailable players, and "Kun 1 runde" players (rounds 2+)
  const benchPlayersRaw = checkIns
    .map((checkIn: CheckIn) => {
      const player = state.players.find((p: Player) => p.id === checkIn.playerId)
      return player ? { ...player, checkInId: checkIn.id, maxRounds: checkIn.maxRounds } : null
    })
    .filter((p): p is Player & { checkInId: string; maxRounds?: number | null } => {
      if (p === null) return false
      // Exclude players already assigned to courts
      if (assignedPlayers.has(p.id)) return false
      // Exclude inactive/unavailable players
      if (unavailablePlayerIds?.has(p.id)) return false
      // Exclude players who only want to play 1 round if we're in rounds 2+, UNLESS they've been manually activated
      if ((round ?? 1) > 1 && p.maxRounds === 1 && !activatedOneRoundPlayers?.has(p.id)) return false
      return true
    })

  // Deduplicate benchPlayers by player ID (in case of duplicates)
  const seenPlayerIds = new Set<string>()
  const benchPlayers = benchPlayersRaw.filter((p) => {
    if (seenPlayerIds.has(p.id)) {
      return false // Skip duplicate
    }
    seenPlayerIds.add(p.id)
    return true
  })

  if (!benchPlayers.length) {
    return { matches: [], result: { filledCourts: 0, benched: 0 } }
  }
  
  // Only exclude courts that are occupied in THIS round
  // For reshuffle: include occupied non-locked courts (they'll be cleared and reused)
  const occupied = new Set(
    existingMatchesInRound
      .map((match) => stateCourts.find((court) => court.id === match.courtId)?.idx)
      .filter((idx): idx is number => typeof idx === 'number')
  )

  const availableCourtIdxs = stateCourts
    .map((court) => court.idx)
    .filter((idx) => {
      // Always exclude locked courts
      if (lockedCourtIdxs?.has(idx)) return false
      // For reshuffle: include occupied courts (they'll be cleared and reused)
      if (isReshuffle) return true
      // For initial match: exclude occupied courts
      return !occupied.has(idx)
    })

  // For reshuffle: players from non-locked courts are already included in benchPlayers
  // (because assignedPlayers excludes them when isReshuffle is true)
  // No database clearing needed - we're working in memory only

  if (!availableCourtIdxs.length) {
    return { matches: [], result: { filledCourts: 0, benched: benchPlayers.length } }
  }

  // Add randomization seed based on current time to allow different outcomes
  let randomSeed = Date.now() % 10000
  const random = () => {
    // Simple seeded random number generator
    randomSeed = (randomSeed * 9301 + 49297) % 233280
    return randomSeed / 233280
  }

  // Completely randomize player order - no level influence at all
  // Pure randomization for maximum variation
  benchPlayers.sort(() => random() - 0.5)

  // No scoring functions needed - pure randomization!
  // All match creation is completely random, respecting only:
  // 1. All players must be assigned
  // 2. Double players never in 1v1 matches

  // Simplified matching algorithm - MAXIMUM RANDOMIZATION
  // Only two hard rules:
  // 1. All players must be assigned to a court
  // 2. Double players (primaryCategory === 'Double') NEVER play singles (1v1)
  //    - "Begge" players CAN play singles
  const assignments: Array<{ courtIdx: number; playerIds: string[] }> = []
  const usedPlayerIds = new Set<string>()
  let courtIdxIndex = 0
  
  // Deduplicate remainingPlayers to prevent duplicate assignments
  const remainingPlayersMap = new Map<string, Player & { checkInId: string; maxRounds?: number | null }>()
  benchPlayers.forEach((p) => {
    if (!remainingPlayersMap.has(p.id)) {
      remainingPlayersMap.set(p.id, p)
    }
  })
  let remainingPlayers = Array.from(remainingPlayersMap.values())

  // Helper function to randomly split 4 players into 2 teams for 2v2
  const createRandomDoublesMatch = (players: Player[]): { courtIdx: number; playerIds: string[] } | null => {
    if (players.length !== 4) return null
    
    // Completely random team split - no scoring, just pure randomization
    const shuffled = [...players].sort(() => random() - 0.5)
    // Randomly pick 2 players for team 1, rest for team 2
    const team1Indices = new Set<number>()
    while (team1Indices.size < 2) {
      team1Indices.add(Math.floor(random() * 4))
    }
    
    const team1 = Array.from(team1Indices).map((idx) => shuffled[idx].id)
    const team2 = shuffled.filter((_, idx) => !team1Indices.has(idx)).map((p) => p.id)
    
    return {
      courtIdx: availableCourtIdxs[courtIdxIndex++],
      playerIds: [...team1, ...team2]
    }
  }

  // Helper function to randomly pick opponent for 1v1
  const createRandomSinglesMatch = (players: Player[]): { courtIdx: number; playerIds: string[] } | null => {
    if (players.length < 2) return null
    
    // Completely random opponent selection - no scoring
    const shuffled = [...players].sort(() => random() - 0.5)
    const player1 = shuffled[0]
    const player2 = shuffled[Math.floor(random() * (shuffled.length - 1)) + 1]
    
    return {
      courtIdx: availableCourtIdxs[courtIdxIndex++],
      playerIds: [player1.id, player2.id]
    }
  }

  // Get tenant config for maxCourts
  const tenantConfig = getCurrentTenantConfig()
  const maxCourts = tenantConfig.maxCourts
  // Hard limit: Maximum players can be assigned (maxCourts × 4 players)
  const MAX_PLAYERS_ON_COURTS = maxCourts * 4
  
  // Helper function to count total assigned players across all assignments
  const getTotalAssignedPlayers = () => {
    return assignments.reduce((total, assignment) => total + assignment.playerIds.length, 0)
  }
  
  // Main algorithm: Maximum randomization with only two constraints
  // 1. Assign ALL players (up to MAX_PLAYERS_ON_COURTS limit)
  // 2. Double players never in 1v1 matches
  while (remainingPlayers.length > 0 && courtIdxIndex < availableCourtIdxs.length && getTotalAssignedPlayers() < MAX_PLAYERS_ON_COURTS) {
    // Completely randomize player order every iteration
    remainingPlayers = [...remainingPlayers].sort(() => random() - 0.5)
    
    // Separate by category (only to enforce Double players never in singles)
    const doublesOnly = remainingPlayers.filter((p) => p.primaryCategory === 'Double')
    const singlesEligible = remainingPlayers.filter((p) => p.primaryCategory !== 'Double')
    
    // Try to create a match - completely random selection
    // Randomly decide: 2v2 or 1v1 (if possible)
    const canCreateDoubles = remainingPlayers.length >= 4
    const canCreateSingles = singlesEligible.length >= 2
    
    if (!canCreateDoubles && !canCreateSingles) {
      // Not enough players for any match
      break
    }
    
    // Randomly choose match type (prefer doubles if we have 4+ players, but allow singles too)
    const preferDoubles = canCreateDoubles && (remainingPlayers.length >= 6 || random() > 0.3)
    
    if (preferDoubles && canCreateDoubles) {
      // Create random 2v2 match
      // Randomly select 4 players (but check limit first)
      const currentTotal = getTotalAssignedPlayers()
      if (currentTotal + 4 > MAX_PLAYERS_ON_COURTS) {
        // Can't create full 2v2, try to add remaining slots if any
        const remainingSlots = MAX_PLAYERS_ON_COURTS - currentTotal
        if (remainingSlots >= 2) {
          // Create smaller match with remaining slots
          const shuffled = [...remainingPlayers].sort(() => random() - 0.5)
          const selectedPlayers = shuffled.slice(0, remainingSlots)
          
          if (selectedPlayers.length >= 2) {
            const match = createRandomSinglesMatch(selectedPlayers)
            if (match) {
              assignments.push(match)
              selectedPlayers.forEach((p) => {
                usedPlayerIds.add(p.id)
                const idx = remainingPlayers.findIndex((rp) => rp.id === p.id)
                if (idx >= 0) remainingPlayers.splice(idx, 1)
              })
              continue
            }
          }
        }
        break // Reached limit
      }
      
      const shuffled = [...remainingPlayers].sort(() => random() - 0.5)
      const selectedPlayers = shuffled.slice(0, 4)
      
      const match = createRandomDoublesMatch(selectedPlayers)
      if (match) {
        assignments.push(match)
        selectedPlayers.forEach((p) => {
          usedPlayerIds.add(p.id)
          const idx = remainingPlayers.findIndex((rp) => rp.id === p.id)
          if (idx >= 0) remainingPlayers.splice(idx, 1)
        })
        continue
      }
    } else if (canCreateSingles) {
      // Create random 1v1 match (only with singles-eligible players)
      const currentTotal = getTotalAssignedPlayers()
      if (currentTotal + 2 > MAX_PLAYERS_ON_COURTS) {
        // Can't create full 1v1, check if we have exactly 1 slot left
        const remainingSlots = MAX_PLAYERS_ON_COURTS - currentTotal
        if (remainingSlots < 1) {
          break // Reached limit
        }
        // Can't create 1v1 with only 1 slot, skip
        break
      }
      
      const shuffled = [...singlesEligible].sort(() => random() - 0.5)
      const eligible = shuffled.filter((p) => !usedPlayerIds.has(p.id))
      
      if (eligible.length >= 2) {
        const match = createRandomSinglesMatch(eligible)
        if (match) {
          assignments.push(match)
          match.playerIds.forEach((id) => {
            usedPlayerIds.add(id)
            const idx = remainingPlayers.findIndex((p) => p.id === id)
            if (idx >= 0) remainingPlayers.splice(idx, 1)
          })
          continue
        }
      }
    }
    
    // If we couldn't create a match, try to handle edge cases
    // If we have Double players but not enough for 2v2, we need to wait for more players
    // or force singles-eligible players into doubles
    if (doublesOnly.length > 0 && remainingPlayers.length >= 2 && remainingPlayers.length < 4) {
      // We have Double players but not enough for 2v2
      // Force singles-eligible players into doubles to accommodate Double players
      const players: Player[] = []
      
      // Add all Double players
      for (const p of doublesOnly) {
        if (!usedPlayerIds.has(p.id)) {
          players.push(p)
          usedPlayerIds.add(p.id)
        }
      }
      
      // Fill with singles-eligible players (randomly selected)
      const shuffledSingles = [...singlesEligible].sort(() => random() - 0.5)
      for (const p of shuffledSingles) {
        if (players.length < 4 && !usedPlayerIds.has(p.id)) {
          players.push(p)
          usedPlayerIds.add(p.id)
        }
      }
      
      // If we have 4, create 2v2 (but check limit first)
      if (players.length === 4) {
        const currentTotal = getTotalAssignedPlayers()
        if (currentTotal + 4 > MAX_PLAYERS_ON_COURTS) {
          break // Reached limit
        }
        const match = createRandomDoublesMatch(players)
        if (match) {
          assignments.push(match)
          players.forEach((p) => {
            const idx = remainingPlayers.findIndex((rp) => rp.id === p.id)
            if (idx >= 0) remainingPlayers.splice(idx, 1)
          })
          continue
        }
      }
    }
    
    // If we have 2-3 players left and no Double players, create 1v1 (but check limit first)
    if (remainingPlayers.length >= 2 && doublesOnly.length === 0) {
      const currentTotal = getTotalAssignedPlayers()
      if (currentTotal + 2 > MAX_PLAYERS_ON_COURTS) {
        break // Reached limit
      }
      const match = createRandomSinglesMatch(remainingPlayers)
      if (match) {
        assignments.push(match)
        match.playerIds.forEach((id) => {
          usedPlayerIds.add(id)
          const idx = remainingPlayers.findIndex((p) => p.id === id)
          if (idx >= 0) remainingPlayers.splice(idx, 1)
        })
        continue
      }
    }
    
    // Safety break to prevent infinite loops
    if (remainingPlayers.length < 2) {
      break
    }
    
    // If we have Double players but no singles-eligible players to help, we can't proceed
    if (doublesOnly.length > 0 && singlesEligible.length === 0 && remainingPlayers.length < 4) {
      break
    }
    
    // Last resort: try to match any remaining players (only singles-eligible, but check limit first)
    if (remainingPlayers.length >= 2 && singlesEligible.length >= 2) {
      const currentTotal = getTotalAssignedPlayers()
      if (currentTotal + 2 > MAX_PLAYERS_ON_COURTS) {
        break // Reached limit
      }
      const eligible = singlesEligible.filter((p) => !usedPlayerIds.has(p.id))
      if (eligible.length >= 2) {
        const match = createRandomSinglesMatch(eligible)
        if (match) {
          assignments.push(match)
          match.playerIds.forEach((id) => {
            usedPlayerIds.add(id)
            const idx = remainingPlayers.findIndex((p) => p.id === id)
            if (idx >= 0) remainingPlayers.splice(idx, 1)
          })
          continue
        }
      }
    }
    
    // If we've tried everything and still have players, break to avoid infinite loop
    break
  }

  // CRITICAL: Ensure ALL remaining players are assigned (key strategy)
  // BUT: Hard limit of MAX_PLAYERS_ON_COURTS (32 players) - any additional must stay on bench
  // If we have leftover players, we must assign them to courts (up to the limit)
  const leftoverPlayers = benchPlayers.filter((p) => !usedPlayerIds.has(p.id))
  
  if (leftoverPlayers.length > 0 && getTotalAssignedPlayers() < MAX_PLAYERS_ON_COURTS) {
    // Strategy 1: Add leftover players to existing matches that have space
    for (const leftoverPlayer of leftoverPlayers) {
      if (usedPlayerIds.has(leftoverPlayer.id)) continue
      if (getTotalAssignedPlayers() >= MAX_PLAYERS_ON_COURTS) break // Reached limit
      
      let added = false
      // Try to add to existing matches with space (1-3 players)
      for (const assignment of assignments) {
        if (getTotalAssignedPlayers() >= MAX_PLAYERS_ON_COURTS) break // Reached limit
        if (assignment.playerIds.length < 4) {
          assignment.playerIds.push(leftoverPlayer.id)
          usedPlayerIds.add(leftoverPlayer.id)
          added = true
          break
        }
      }
      
      // Strategy 2: If couldn't add to existing match, try to create new matches
      if (!added && courtIdxIndex < availableCourtIdxs.length && getTotalAssignedPlayers() < MAX_PLAYERS_ON_COURTS) {
        // Find other leftover players to pair with
        const otherLeftovers = leftoverPlayers.filter((p) => p.id !== leftoverPlayer.id && !usedPlayerIds.has(p.id))
        
        // If this is a Double player, we MUST create a 2v2 match (need 4 players)
        if (leftoverPlayer.primaryCategory === 'Double') {
          const currentTotal = getTotalAssignedPlayers()
          if (currentTotal + 4 > MAX_PLAYERS_ON_COURTS) {
            // Can't create full 2v2 due to limit, skip
            continue
          }
          
          // Collect all available players (leftovers + can take from existing matches if needed)
          const neededForDoubles = [leftoverPlayer, ...otherLeftovers].slice(0, 4)
          
          // If we don't have 4 from leftovers, try to take from existing matches
          if (neededForDoubles.length < 4) {
            for (const assignment of assignments) {
              if (neededForDoubles.length >= 4) break
              // Take one player from matches with 2+ players
              if (assignment.playerIds.length >= 2) {
                const playerToMove = assignment.playerIds[0]
                const playerData = benchPlayers.find((p) => p.id === playerToMove)
                if (playerData && !neededForDoubles.find((np) => np.id === playerToMove)) {
                  neededForDoubles.push(playerData)
                  assignment.playerIds = assignment.playerIds.filter((id) => id !== playerToMove)
                  usedPlayerIds.delete(playerToMove)
                }
              }
            }
          }
          
          // If we have 4 players now, create 2v2 match
          if (neededForDoubles.length === 4) {
            assignments.push({
              courtIdx: availableCourtIdxs[courtIdxIndex++],
              playerIds: neededForDoubles.map((p) => p.id)
            })
            neededForDoubles.forEach((p) => usedPlayerIds.add(p.id))
            added = true
          }
        } else {
          // This is a singles-eligible player - try to create 1v1 or add to existing
          const currentTotal = getTotalAssignedPlayers()
          if (currentTotal + 2 > MAX_PLAYERS_ON_COURTS) {
            // Can't create full 1v1 due to limit, skip
            continue
          }
          
          const singlesEligible = [leftoverPlayer, ...otherLeftovers.filter((p) => p.primaryCategory !== 'Double')]
          
          if (singlesEligible.length >= 2) {
            const pair = singlesEligible.slice(0, 2)
            assignments.push({
              courtIdx: availableCourtIdxs[courtIdxIndex++],
              playerIds: pair.map((p) => p.id)
            })
            pair.forEach((p) => usedPlayerIds.add(p.id))
            added = true
          }
        }
      }
      
      // Strategy 3: If still not added, force add to any match with space (but check limit)
      // For Double players: only add to matches with 2+ players (to avoid 1v1)
      // For others: can add to any match with space
      if (!added && getTotalAssignedPlayers() < MAX_PLAYERS_ON_COURTS) {
        for (const assignment of assignments) {
          if (getTotalAssignedPlayers() >= MAX_PLAYERS_ON_COURTS) break // Reached limit
          if (assignment.playerIds.length < 8) {
            // If this is a Double player, only add to matches with 2+ players (avoid 1v1)
            if (leftoverPlayer.primaryCategory === 'Double' && assignment.playerIds.length < 2) {
              continue
            }
            assignment.playerIds.push(leftoverPlayer.id)
            usedPlayerIds.add(leftoverPlayer.id)
            added = true
            break
          }
        }
      }
      
      // Strategy 4: Last resort - create incomplete match (better than leaving on bench)
      // Only for singles-eligible players (Double players should have been handled above)
      // BUT: Only if we haven't reached the limit
      if (!added && courtIdxIndex < availableCourtIdxs.length && leftoverPlayer.primaryCategory !== 'Double' && getTotalAssignedPlayers() < MAX_PLAYERS_ON_COURTS) {
        assignments.push({
          courtIdx: availableCourtIdxs[courtIdxIndex++],
          playerIds: [leftoverPlayer.id]
        })
        usedPlayerIds.add(leftoverPlayer.id)
      } else if (!added && leftoverPlayer.primaryCategory === 'Double' && getTotalAssignedPlayers() < MAX_PLAYERS_ON_COURTS) {
        // For Double players, if we still can't assign them, force add to any match (violates rule but ensures assignment)
        for (const assignment of assignments) {
          if (getTotalAssignedPlayers() >= MAX_PLAYERS_ON_COURTS) break // Reached limit
          if (assignment.playerIds.length < 8) {
            assignment.playerIds.push(leftoverPlayer.id)
            usedPlayerIds.add(leftoverPlayer.id)
            break
          }
        }
      }
    }
  }

  const leftoverPlayerIds = benchPlayers.filter((p) => !usedPlayerIds.has(p.id)).map((p) => p.id)

  if (!assignments.length) {
    return { 
      matches: [],
      result: { filledCourts: 0, benched: leftoverPlayerIds.length }
    }
  }

  // Build matches structure in memory (no database writes)
  const playersMap = new Map(state.players.map((player: Player) => [player.id, normalisePlayer(player)]))
  const matchesByCourt = new Map<number, CourtWithPlayers['slots']>()
  
  // Track assigned player IDs to prevent duplicates
  const assignedInThisRound = new Set<string>()
  for (const { courtIdx, playerIds } of assignments) {
    // Validate: ensure no duplicate players in this assignment
    const uniquePlayerIds = Array.from(new Set(playerIds))
    if (uniquePlayerIds.length !== playerIds.length) {
      console.warn(`Duplicate players detected in assignment for court ${courtIdx}, removing duplicates`)
    }
    
    // Validate: ensure no player is assigned to multiple courts
    const duplicatePlayers = uniquePlayerIds.filter((id) => assignedInThisRound.has(id))
    if (duplicatePlayers.length > 0) {
      console.warn(`Players ${duplicatePlayers.join(', ')} already assigned to another court, skipping this assignment`)
      continue
    }
    
    // Mark players as assigned
    uniquePlayerIds.forEach((id) => assignedInThisRound.add(id))
    
    // Build slots for this court
    const slots: CourtWithPlayers['slots'] = []
    
    // For 1v1 matches (2 players), place them in slots 1 and 2 (opposite sides of net)
    // For 2v2 matches (4 players), use slots 0, 1, 2, 3 (normal order)
    if (uniquePlayerIds.length === 2) {
      // 1v1 match: place players in slots 1 and 2
      const player1 = playersMap.get(uniquePlayerIds[0])
      const player2 = playersMap.get(uniquePlayerIds[1])
      if (player1) slots.push({ slot: 1, player: player1 })
      if (player2) slots.push({ slot: 2, player: player2 })
    } else {
      // 2v2 match: use slots 0, 1, 2, 3
      for (let slot = 0; slot < uniquePlayerIds.length; slot++) {
        const player = playersMap.get(uniquePlayerIds[slot])
        if (player) {
          slots.push({ slot, player })
        }
      }
    }
    
    matchesByCourt.set(courtIdx, slots)
  }

  // Build final matches array - ALWAYS include all courts up to maxCourts, even if empty
  // Ensure we have exactly maxCourts courts in the result
  const allCourtIdxs = Array.from({ length: maxCourts }, (_, i) => i + 1)
  const matches: CourtWithPlayers[] = allCourtIdxs.map((courtIdx) => ({
    courtIdx,
    slots: (matchesByCourt.get(courtIdx) ?? []).sort((a, b) => a.slot - b.slot)
  }))

  return {
    matches,
    result: {
      filledCourts: assignments.length,
      benched: leftoverPlayerIds.length
    }
  }
}

/**
 * Moves a player to a court/slot or removes from court (supports swapping).
 * @param payload - Move payload (playerId, toCourtIdx, toSlot, optional swapWithPlayerId)
 * @param round - Optional round number (defaults to 1)
 * @throws Error if player not checked in, slot occupied, or court full
 * @remarks Supports swapping: if target slot is occupied, swaps players.
 */
const movePlayer = async (payload: MatchMovePayload, round?: number): Promise<void> => {
  const parsed = z
    .object({
      playerId: z.string().min(1),
      toCourtIdx: z.number().int().min(1).max(8).optional(),
      toSlot: z.number().int().min(0).max(7).optional(),
      round: z.number().int().min(1).max(4).optional(),
      swapWithPlayerId: z.string().optional()
    })
    .superRefine((value, ctx) => {
      if (value.toCourtIdx !== undefined && value.toSlot === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'toSlot kræves når toCourtIdx er sat' })
      }
    })
    .parse({ ...payload, round: payload.round ?? round })

  const effectiveRound = parsed.round ?? round ?? 1
  const session = await ensureActiveSession()
  const state = await getStateCopy()
  
  const checkedIn = state.checkIns.some(
    (checkIn: CheckIn) => checkIn.sessionId === session.id && checkIn.playerId === parsed.playerId
  )
  if (!checkedIn) {
    throw new Error('Spilleren er ikke tjekket ind')
  }

  // Only check matches in the current round
  const matchesInRound = state.matches.filter(
    (match: Match) => match.sessionId === session.id && (match.round ?? 1) === effectiveRound
  )

  // Find current match player only in the current round
  const currentMatchPlayer = state.matchPlayers.find((mp) => {
    if (mp.playerId !== parsed.playerId) return false
    const match = matchesInRound.find((m: Match) => m.id === mp.matchId)
    return match !== undefined
  })
  const currentMatch = currentMatchPlayer
    ? matchesInRound.find((match: Match) => match.id === currentMatchPlayer.matchId)
    : undefined

  if (parsed.toCourtIdx === undefined) {
    if (currentMatchPlayer) {
      await deleteMatchPlayerInDb(currentMatchPlayer.id)
      // Check if match has any remaining players
      const remaining = state.matchPlayers.filter((mp) => mp.matchId === currentMatchPlayer.matchId && mp.id !== currentMatchPlayer.id)
      if (remaining.length === 0) {
        await deleteMatchInDb(currentMatchPlayer.matchId)
      }
    }
    return
  }

  const court = state.courts.find((court) => court.idx === parsed.toCourtIdx)
  if (!court) {
    throw new Error('Banen findes ikke')
  }

  // Only find matches in the current round for this court
  let targetMatch = matchesInRound.find((match: Match) => match.courtId === court.id)
  if (!targetMatch) {
    targetMatch = await createMatchInDb({
      sessionId: session.id,
      courtId: court.id,
      startedAt: new Date().toISOString(),
      endedAt: null,
      round: effectiveRound
    })
  }

    // Only check slots in the current round's match
    // Filter matchPlayers by matchId to ensure we only check the current match
    const existingSlots = state.matchPlayers.filter((mp) => mp.matchId === targetMatch!.id)
    
    // When checking if a slot is taken, exclude the current player if they're already in this match
    // This prevents false positives when the player is already in the slot
    const slotTaken = existingSlots.find((mp) => {
      // Skip the current player's existing slot if they're already in this match
      if (currentMatch?.id === targetMatch!.id && currentMatchPlayer && mp.id === currentMatchPlayer.id) {
        return false
      }
      return mp.slot === parsed.toSlot
    })
    
    // Check if we're swapping - find the occupying player separately
    const occupyingPlayerForSwap = parsed.swapWithPlayerId 
      ? existingSlots.find((mp) => mp.slot === parsed.toSlot && mp.playerId === parsed.swapWithPlayerId)
      : null
    
    // Only throw error if slot is taken by a different player (and we're not swapping)
    if (slotTaken && slotTaken.playerId !== parsed.playerId && !occupyingPlayerForSwap) {
      throw new Error('Pladsen er optaget')
    }
    
    // Handle swapping: move the occupying player to the source location
    if (parsed.swapWithPlayerId && occupyingPlayerForSwap) {
      // Find where the current player is coming from (source location)
      const sourceMatchPlayer = currentMatchPlayer
      const sourceMatch = sourceMatchPlayer
        ? matchesInRound.find((match: Match) => match.id === sourceMatchPlayer.matchId)
        : undefined
      
      // Find the actual occupying player entry in state.matchPlayers array
      const occupyingPlayerEntry = state.matchPlayers.find((mp) => 
        mp.matchId === targetMatch!.id && mp.slot === parsed.toSlot && mp.playerId === parsed.swapWithPlayerId
      )
      
      if (!occupyingPlayerEntry) {
        throw new Error('Kunne ikke finde spiller at bytte med')
      }
      
      if (sourceMatch && sourceMatchPlayer) {
        // If source match is the same as target match, just swap slots
        if (sourceMatch.id === targetMatch.id) {
          // Swap the slots using Supabase
          await updateMatchPlayerInDb(occupyingPlayerEntry.id, { slot: sourceMatchPlayer.slot })
          await updateMatchPlayerInDb(sourceMatchPlayer.id, { slot: parsed.toSlot! })
          return
        } else {
          // Move occupying player to source match and slot
          // Update occupying player to move to source location
          await updateMatchPlayerInDb(occupyingPlayerEntry.id, { matchId: sourceMatch.id, slot: sourceMatchPlayer.slot })
          
          // Remove current player from source match
          if (currentMatchPlayer) {
            await deleteMatchPlayerInDb(currentMatchPlayer.id)
          }
          
          // Check if source match has any remaining players
          const remaining = state.matchPlayers.filter((mp) => mp.matchId === sourceMatch.id && mp.id !== currentMatchPlayer?.id)
          if (remaining.length === 0) {
            await deleteMatchInDb(sourceMatch.id)
          }
          
          // After swap, slot is now free - place dragged player in target slot
          await createMatchPlayerInDb({
            matchId: targetMatch.id,
            playerId: parsed.playerId,
            slot: parsed.toSlot!
          })
          return
        }
      } else {
        // Source is bench/inactive - move occupying player to bench
        await deleteMatchPlayerInDb(occupyingPlayerEntry.id)
        const remaining = state.matchPlayers.filter((mp) => mp.matchId === targetMatch.id && mp.id !== occupyingPlayerEntry.id)
        if (remaining.length === 0) {
          await deleteMatchInDb(targetMatch.id)
        }
        
        // Remove current player from their match if they're in one
        if (currentMatch && currentMatchPlayer) {
          await deleteMatchPlayerInDb(currentMatchPlayer.id)
          const remainingInSource = state.matchPlayers.filter((mp) => mp.matchId === currentMatch.id && mp.id !== currentMatchPlayer.id)
          if (remainingInSource.length === 0) {
            await deleteMatchInDb(currentMatch.id)
          }
        }
        
        // Now place dragged player in the now-free slot
        await createMatchPlayerInDb({
          matchId: targetMatch.id,
          playerId: parsed.playerId,
          slot: parsed.toSlot!
        })
        return
      }
    }

    const effectiveCount = existingSlots.length - (currentMatch?.id === targetMatch.id ? 1 : 0)
    // Check if court has extended capacity (any slot >= 4 indicates extended capacity)
    // Determine max capacity: if any slot >= 4 exists, check the highest slot to determine capacity
    const hasExtendedCapacity = existingSlots.some((mp) => mp.slot >= 4)
    let maxCapacity = 4
    if (hasExtendedCapacity) {
      // If any player is in slot 4+, check the highest slot to determine if it's 5, 6, 7, or 8
      const maxSlot = Math.max(...existingSlots.map((mp) => mp.slot))
      // If max slot is 4, could be 5 capacity; if 5, could be 6; if 6, could be 7; if 7, must be 8
      // For safety, if slot >= 4 exists, allow up to 8 (we'll validate based on actual slot being added)
      maxCapacity = 8
    }
    if (!slotTaken && effectiveCount >= maxCapacity) {
      throw new Error('Banen er fuld')
    }

    if (currentMatch && currentMatch.id !== targetMatch.id && currentMatchPlayer) {
      await deleteMatchPlayerInDb(currentMatchPlayer.id)
      const remaining = state.matchPlayers.filter((mp) => mp.matchId === currentMatch.id && mp.id !== currentMatchPlayer.id)
      if (remaining.length === 0) {
        await deleteMatchInDb(currentMatch.id)
      }
    }

    if (slotTaken && slotTaken.playerId === parsed.playerId) {
      return
    }

    if (currentMatch && currentMatch.id === targetMatch.id && currentMatchPlayer) {
      await updateMatchPlayerInDb(currentMatchPlayer.id, { slot: parsed.toSlot! })
      return
    }

    await createMatchPlayerInDb({
      matchId: targetMatch.id,
      playerId: parsed.playerId,
      slot: parsed.toSlot!
    })
}

/** Matches API — manages court assignments and player matching. */
const matchesApi = {
  autoArrange: (round?: number, unavailablePlayerIds?: Set<string>, activatedOneRoundPlayers?: Set<string>, lockedCourtIdxs?: Set<number>, isReshuffle?: boolean, currentMatches?: CourtWithPlayers[]) => autoArrangeMatches(round, unavailablePlayerIds, activatedOneRoundPlayers, lockedCourtIdxs, isReshuffle, currentMatches),
  list: (round?: number) => listMatches(round),
  reset: resetMatches,
  resetForRound: resetMatchesForRound,
  move: movePlayer
}

/** Main API client — exports all API modules. */
const api = {
  players: playersApi,
  session: sessionApi,
  checkIns: checkInsApi,
  matches: matchesApi,
  database: {
    createBackup,
    restoreFromBackup,
    hasBackup
  }
}

export default api
