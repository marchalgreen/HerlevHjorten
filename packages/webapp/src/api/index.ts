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
} from '@rundeklar/common'
import {
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
  getMatches,
  createMatch as createMatchInDb,
  updateMatch as updateMatchInDb,
  deleteMatch as deleteMatchInDb,
  getMatchPlayers,
  createMatchPlayer as createMatchPlayerInDb,
  updateMatchPlayer as updateMatchPlayerInDb,
  deleteMatchPlayer as deleteMatchPlayerInDb
} from './postgres'
// (No star import needed)
import { getCurrentTenantConfig } from '../lib/postgres'
import statsApi from './stats'
import {
  createPlayerNotFoundError,
  createPlayerInactiveError,
  createSessionNotFoundError,
  createCheckInExistsError,
  createCheckInNotFoundError,
  normalizeError,
  ValidationError
} from '../lib/errors'

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
  levelSingle: z.number().optional(),
  levelDouble: z.number().optional(),
  levelMix: z.number().optional(),
  gender: z.enum(['Herre', 'Dame']).optional(),
  primaryCategory: z.enum(['Single', 'Double', 'Begge']).optional(),
  trainingGroups: z.array(z.string().min(1)).optional(),
  active: z.boolean().optional(),
  preferredDoublesPartners: z.array(z.string()).optional(),
  preferredMixedPartners: z.array(z.string()).optional()
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
      trainingGroups: z.array(z.string()).nullable().optional(),
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
 * 
 * @param input - Player creation input
 * @returns Created and normalized player
 * @throws {ValidationError} If input validation fails
 * @throws {DatabaseError} If database operation fails
 */
const createPlayer = async (input: PlayerCreateInput): Promise<Player> => {
  try {
  const parsed = playerCreateSchema.parse(input)
  const created = await createPlayerInDb({
    name: parsed.name.trim(),
    alias: parsed.alias ? parsed.alias.trim() : null,
    level: parsed.level ?? null,
      levelSingle: parsed.levelSingle ?? null,
      levelDouble: parsed.levelDouble ?? null,
      levelMix: parsed.levelMix ?? null,
    gender: parsed.gender ?? null,
    primaryCategory: parsed.primaryCategory ?? null,
      trainingGroups: parsed.trainingGroups ?? [],
      active: parsed.active ?? true,
      preferredDoublesPartners: parsed.preferredDoublesPartners ?? null,
      preferredMixedPartners: parsed.preferredMixedPartners ?? null
    } as Omit<Player, 'id' | 'createdAt'>)
  return normalisePlayer(created)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        error.errors.map((e) => e.message).join(', '),
        undefined,
        error
      )
    }
    throw normalizeError(error)
  }
}

/**
 * Updates an existing player.
 * 
 * @param input - Player update input (id + patch)
 * @returns Updated and normalized player
 * @throws {ValidationError} If input validation fails
 * @throws {PlayerError} If player not found
 * @throws {DatabaseError} If database operation fails
 */
const updatePlayer = async (input: PlayerUpdateInput): Promise<Player> => {
  try {
  const parsed = playerUpdateSchema.parse(input)
  const updateData: PlayerUpdateInput['patch'] = {}
  if (parsed.patch.name !== undefined) updateData.name = parsed.patch.name.trim()
  if (parsed.patch.alias !== undefined) updateData.alias = parsed.patch.alias
  if (parsed.patch.level !== undefined) updateData.level = parsed.patch.level
  if (parsed.patch.levelSingle !== undefined) updateData.levelSingle = parsed.patch.levelSingle
  if (parsed.patch.levelDouble !== undefined) updateData.levelDouble = parsed.patch.levelDouble
  if (parsed.patch.levelMix !== undefined) updateData.levelMix = parsed.patch.levelMix
  if (parsed.patch.gender !== undefined) updateData.gender = parsed.patch.gender
  if (parsed.patch.primaryCategory !== undefined) updateData.primaryCategory = parsed.patch.primaryCategory
  if (parsed.patch.trainingGroups !== undefined) updateData.trainingGroups = parsed.patch.trainingGroups ?? []
  if (parsed.patch.active !== undefined) updateData.active = parsed.patch.active
  if (parsed.patch.preferredDoublesPartners !== undefined) updateData.preferredDoublesPartners = parsed.patch.preferredDoublesPartners
  if (parsed.patch.preferredMixedPartners !== undefined) updateData.preferredMixedPartners = parsed.patch.preferredMixedPartners

  const updated = await updatePlayerInDb(parsed.id, updateData)
  return normalisePlayer(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        error.errors.map((e) => e.message).join(', '),
        undefined,
        error
      )
    }
    throw normalizeError(error)
  }
}

/** Players API — CRUD operations for players. */
const playersApi = {
  list: listPlayers,
  create: createPlayer,
  update: updatePlayer
}

/**
 * Automatically ends training sessions that have been active for too long.
 * @param session - Session to check
 * @returns True if session was auto-ended, false otherwise
 */
const autoEndExpiredSession = async (session: TrainingSession): Promise<boolean> => {
  const { SESSION_TIMEOUT } = await import('../constants')
  const sessionStartTime = new Date(session.createdAt).getTime()
  const now = Date.now()
  const sessionAge = now - sessionStartTime
  
  if (sessionAge > SESSION_TIMEOUT.MAX_DURATION_MS) {
    console.log(`[autoEndExpiredSession] Auto-ending session ${session.id} (age: ${Math.round(sessionAge / 1000 / 60)} minutes)`)
    
    // Update session status to ended
    await updateSessionInDb(session.id, { status: 'ended' })
    
    // Update all matches for this session with endedAt
    const matches = await getMatches()
    const sessionMatches = matches.filter((match: Match) => match.sessionId === session.id)
    const endedAt = new Date().toISOString()
    await Promise.all(sessionMatches.map((match) => updateMatchInDb(match.id, { endedAt })))
    
    // Invalidate cache
    const { invalidateCache } = await import('./postgres')
    invalidateCache('matches')
    invalidateCache('sessions')
    
    // Try to create statistics snapshot (don't fail if it errors)
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      await statsApi.snapshotSession(session.id)
      console.log('[autoEndExpiredSession] Statistics snapshot created successfully')
    } catch (err) {
      console.error('[autoEndExpiredSession] Failed to create statistics snapshot:', err)
    }
    
    return true
  }
  
  return false
}

/**
 * Gets the active training session (if any).
 * Automatically ends sessions that have been active for too long.
 * @returns Active session or null
 */
const getActiveSession = async (): Promise<TrainingSession | null> => {
  const sessions = await getSessions()
  const active = sessions
    .filter((session) => session.status === 'active')
    .sort((a: TrainingSession, b: TrainingSession) => b.createdAt.localeCompare(a.createdAt))[0]
  
  if (!active) {
    return null
  }
  
  // Check if session has expired and auto-end it
  const wasEnded = await autoEndExpiredSession(active)
  if (wasEnded) {
    // Session was auto-ended, return null
    return null
  }
  
  return active
}

/**
 * Ensures an active session exists (throws if none).
 * 
 * @returns Active session
 * @throws {SessionError} If no active session exists
 */
const ensureActiveSession = async (): Promise<TrainingSession> => {
  const active = await getActiveSession()
  if (!active) {
    throw createSessionNotFoundError()
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
  const courts = state.courts.slice()
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
      if (!court) {
        // If court doesn't exist in state, skip creating matches for this court
        // (dynamic court creation is disabled in this build)
        continue
      }
      if (courtMatch.slots.length === 0) continue

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

  // Invalidate cache before creating snapshot to ensure fresh data
  const { invalidateCache } = await import('./postgres')
  // Only invalidate matches and sessions since we updated those
  invalidateCache('matches')
  invalidateCache('sessions')

  // Create statistics snapshot after session is marked as ended
  // Add a small delay to ensure all database writes are committed
  await new Promise(resolve => setTimeout(resolve, 200))
  
  try {
    console.log('[endActiveSession] Creating statistics snapshot for session', active.id)
    await statsApi.snapshotSession(active.id)
    console.log('[endActiveSession] Statistics snapshot created successfully')
  } catch (err) {
    // Log error but don't fail the session ending
    console.error('[endActiveSession] Failed to create statistics snapshot:', err)
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
 * 
 * @param input - Check-in input (playerId, optional maxRounds)
 * @returns Created check-in
 * @throws {SessionError} If no active session exists
 * @throws {PlayerError} If player not found or inactive
 * @throws {SessionError} If player already checked in
 * @throws {DatabaseError} If database operation fails
 */
const addCheckIn = async (input: { playerId: string; maxRounds?: number }) => {
  try {
  const session = await ensureActiveSession()
  const players = await getPlayers()
  const player = players.find((item) => item.id === input.playerId)
    
  if (!player) {
      throw createPlayerNotFoundError(input.playerId)
  }
    
  if (!player.active) {
      throw createPlayerInactiveError(player.name)
  }
    
  const checkIns = await getCheckIns()
  const existing = checkIns.find(
    (checkIn) => checkIn.sessionId === session.id && checkIn.playerId === input.playerId
  )
    
  if (existing) {
      throw createCheckInExistsError(player.name)
  }
    
  const checkIn = await createCheckInInDb({
    sessionId: session.id,
    playerId: input.playerId,
    maxRounds: input.maxRounds ?? null
  })
    
  return checkIn
  } catch (error) {
    // Re-throw AppError instances as-is
    if (error instanceof Error && 'code' in error) {
      throw error
    }
    throw normalizeError(error)
  }
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
 * 
 * @param input - Check-in input (playerId)
 * @throws {SessionError} If no active session exists
 * @throws {SessionError} If player not checked in
 * @throws {DatabaseError} If database operation fails
 */
const removeCheckIn = async (input: { playerId: string }) => {
  try {
  const session = await ensureActiveSession()
  const checkIns = await getCheckIns()
  const checkIn = checkIns.find(
    (checkIn: CheckIn) => checkIn.sessionId === session.id && checkIn.playerId === input.playerId
  )
    
  if (!checkIn) {
      // Try to get player name for better error message
      const players = await getPlayers()
      const player = players.find((p) => p.id === input.playerId)
      const playerName = player?.name || 'Spilleren'
      throw createCheckInNotFoundError(playerName)
  }
    
  await deleteCheckInInDb(checkIn.id)
  } catch (error) {
    // Re-throw AppError instances as-is
    if (error instanceof Error && 'code' in error) {
      throw error
    }
    throw normalizeError(error)
  }
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
const autoArrangeMatches = async (round?: number, unavailablePlayerIds?: Set<string>, activatedOneRoundPlayers?: Set<string>, lockedCourtIdxs?: Set<number>, isReshuffle?: boolean, currentMatches?: CourtWithPlayers[], extendedCapacityCourtsParam?: Map<number, number>): Promise<{ matches: CourtWithPlayers[]; result: AutoArrangeResult }> => {
  const session = await ensureActiveSession()
  const state = await getStateCopy()
  const checkIns = state.checkIns
    .filter((checkIn: CheckIn) => checkIn.sessionId === session.id)
    .sort((a: CheckIn, b: CheckIn) => a.createdAt.localeCompare(b.createdAt))

  if (!checkIns.length) {
    return { matches: [], result: { filledCourts: 0, benched: 0 } }
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
  const benchPlayersRaw: (CheckedInPlayer | null)[] = checkIns
    .map((checkIn: CheckIn) => {
      const player = state.players.find((p: Player) => p.id === checkIn.playerId)
      return player ? { ...player, checkInAt: checkIn.createdAt, maxRounds: checkIn.maxRounds ?? null } as CheckedInPlayer : null
    })
    .filter((p): p is CheckedInPlayer => {
      if (p === null || p === undefined) return false
      // Ensure we have a valid CheckedInPlayer (has checkInAt)
      if (!('checkInAt' in p)) return false
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
  const benchPlayers: CheckedInPlayer[] = benchPlayersRaw.filter((p): p is CheckedInPlayer => {
    if (p === null || p === undefined) return false
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
  const remainingPlayersMap = new Map<string, CheckedInPlayer>()
  benchPlayers.forEach((p) => {
    if (!remainingPlayersMap.has(p.id)) {
      remainingPlayersMap.set(p.id, p)
    }
  })
  let remainingPlayers: CheckedInPlayer[] = Array.from(remainingPlayersMap.values())

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

  // Helper function to create a 3-player match (for odd total players)
  const create3PlayerMatch = (players: Player[]): { courtIdx: number; playerIds: string[] } | null => {
    if (players.length < 3) return null
    
    // Completely random selection of 3 players
    const shuffled = [...players].sort(() => random() - 0.5)
    const selected = shuffled.slice(0, 3)
    
    return {
      courtIdx: availableCourtIdxs[courtIdxIndex++],
      playerIds: selected.map(p => p.id)
    }
  }

  // Get tenant config for maxCourts
  const tenantConfig = getCurrentTenantConfig()
  const maxCourts = tenantConfig.maxCourts
  // Upper bound limit used during staging (true theoretical max if all courts promoted to 8)
  const MAX_PLAYERS_ON_COURTS = maxCourts * 8
  
  // Helper function to count total assigned players across all assignments
  const getTotalAssignedPlayers = () => {
    return assignments.reduce((total, assignment) => total + assignment.playerIds.length, 0)
  }
  
  // CRITICAL: If total players is odd, create ONE 3-player court FIRST (before other matches)
  // This ensures we have enough singles-eligible players available for the 3-player court
  // Total = bench players + players on locked courts
  const totalPlayersCount = benchPlayers.length + playersOnLockedCourts.size
  const isOddTotal = totalPlayersCount % 2 === 1
  
  if (isOddTotal) {
    // Separate singles-eligible players (only these can be in 3-player court)
    const singlesEligible = remainingPlayers.filter((p) => p.primaryCategory !== 'Double')
    
    if (singlesEligible.length >= 3 && courtIdxIndex < availableCourtIdxs.length && getTotalAssignedPlayers() + 3 <= MAX_PLAYERS_ON_COURTS) {
      // Prioritize 3 males for fairer game
      const malesEligible = singlesEligible.filter((p) => p.gender === 'Herre')
      
      let playersFor3Court: CheckedInPlayer[]
      if (malesEligible.length >= 3) {
        // Use 3 males if available
        playersFor3Court = malesEligible
      } else {
        // Fall back to any singles-eligible players
        playersFor3Court = singlesEligible
      }
      
      // Create 3-player court
      const match = create3PlayerMatch(playersFor3Court)
      if (match) {
        assignments.push(match)
        match.playerIds.forEach((id) => {
          usedPlayerIds.add(id)
          const idx = remainingPlayers.findIndex((p) => p.id === id)
          if (idx >= 0) remainingPlayers.splice(idx, 1)
        })
      }
    }
    // If we can't create a 3-player court (not enough singles-eligible players),
    // proceed with normal matching - the odd player(s) will remain on bench
  }
  
  // Main algorithm: Maximum randomization with only two constraints
  // 1. Assign ALL players (up to MAX_PLAYERS_ON_COURTS limit)
  // 2. Double players never in 1v1 matches
  while (remainingPlayers.length > 0 && courtIdxIndex < availableCourtIdxs.length && getTotalAssignedPlayers() < MAX_PLAYERS_ON_COURTS) {
    // Completely randomize player order every iteration
    remainingPlayers = [...remainingPlayers].sort(() => random() - 0.5)
    
    // Separate by category (only to enforce Double players never in singles)
    const doublesOnly: CheckedInPlayer[] = remainingPlayers.filter((p) => p.primaryCategory === 'Double')
    const singlesEligible: CheckedInPlayer[] = remainingPlayers.filter((p) => p.primaryCategory !== 'Double')
    
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
          const selectedPlayers: CheckedInPlayer[] = shuffled.slice(0, remainingSlots)
          
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
      const selectedPlayers: CheckedInPlayer[] = shuffled.slice(0, 4)
      
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
      const eligible: CheckedInPlayer[] = shuffled.filter((p) => !usedPlayerIds.has(p.id))
      
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
      const players: CheckedInPlayer[] = []
      
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
      const eligible: CheckedInPlayer[] = singlesEligible.filter((p) => !usedPlayerIds.has(p.id))
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

  // Capacity-aware leftover assignment:
  // - Create new full 8-courts when possible
  // - Promote 4-courts to 8 using blocks of 4
  // - Fill 1-player courts to 2 using singles-eligible partners (no Double in 1v1)
  const leftoverPlayers: CheckedInPlayer[] = benchPlayers.filter((p) => !usedPlayerIds.has(p.id))
  if (leftoverPlayers.length > 0 && getTotalAssignedPlayers() < MAX_PLAYERS_ON_COURTS) {
    // Helper: pop N players from leftovers
    const popN = (n: number): CheckedInPlayer[] => {
      const picked = leftoverPlayers.splice(0, n)
      picked.forEach(p => usedPlayerIds.add(p.id))
      return picked
    }
    // 1) Create new 8-courts on unused courts while we have 8+ players
    const usedCourtIdxs = new Set(assignments.map(a => a.courtIdx))
    const unusedCourtIdxs = availableCourtIdxs.filter(idx => !usedCourtIdxs.has(idx))
    while (leftoverPlayers.length >= 8 && unusedCourtIdxs.length > 0 && getTotalAssignedPlayers() + 8 <= MAX_PLAYERS_ON_COURTS) {
      const courtIdx = unusedCourtIdxs.shift()!
      const eight = popN(8)
      assignments.push({ courtIdx, playerIds: eight.map(p => p.id) })
    }
    // 2) Promote existing 4-courts to 8 using blocks of 4
    if (leftoverPlayers.length >= 4) {
      for (const a of assignments) {
        if (leftoverPlayers.length < 4) break
        if (a.playerIds.length === 4 && getTotalAssignedPlayers() + 4 <= MAX_PLAYERS_ON_COURTS) {
          const add4 = popN(4)
          a.playerIds.push(...add4.map(p => p.id))
        }
      }
    }
    // 3) Fill singletons (size 1) to 2 with singles-eligible partner only
    for (const a of assignments) {
      if (a.playerIds.length === 1) {
        const lone = benchPlayers.find(p => p.id === a.playerIds[0])
        if (!lone) continue
        if (lone.primaryCategory !== 'Double') {
          const partnerIdx = leftoverPlayers.findIndex(p => p.primaryCategory !== 'Double' && !usedPlayerIds.has(p.id))
          if (partnerIdx >= 0 && getTotalAssignedPlayers() + 1 <= MAX_PLAYERS_ON_COURTS) {
            const partner = leftoverPlayers.splice(partnerIdx, 1)[0]
            usedPlayerIds.add(partner.id)
            a.playerIds.push(partner.id)
          }
        }
      }
    }
  }

  // Note: leftoverPlayerIds will be calculated after we've assigned all leftover players
  // This happens in the merge/redistribution logic below

  // CRITICAL: Ensure only one court has an odd number of players (unless total players is odd)
  // Exception: Courts with manually configured extended capacity (5 or 7 players) are allowed
  // Get extended capacity courts from parameter (preferred) or detect from currentMatches
  const extendedCapacityCourts = new Map<number, number>()
  
  // Use parameter if provided (most reliable)
  if (extendedCapacityCourtsParam) {
    extendedCapacityCourtsParam.forEach((capacity, courtIdx) => {
      extendedCapacityCourts.set(courtIdx, capacity)
    })
  } else if (currentMatches) {
    // Fallback: detect from currentMatches (courts with slots >= 4 have extended capacity)
    for (const court of currentMatches) {
      if (court.slots.length > 0) {
        const maxSlot = Math.max(...court.slots.map(s => s.slot), -1)
        if (maxSlot >= 4) {
          // Determine capacity: maxSlot + 1 = capacity
          extendedCapacityCourts.set(court.courtIdx, maxSlot + 1)
        }
      }
    }
  }

  // Determine parity using players actually on courts in this round:
  // players on newly created assignments + players on locked courts (kept)
  // This avoids double-counting bench players.
  const playersOnLockedCourtsCount = playersOnLockedCourts.size
  const playersOnNewAssignmentsCount = assignments.reduce((sum, a) => sum + a.playerIds.length, 0)
  const totalPlayersOnCourtsThisRound = playersOnLockedCourtsCount + playersOnNewAssignmentsCount
  const hasOddTotalPlayers = totalPlayersOnCourtsThisRound % 2 === 1

  // Find courts with odd numbers of players
  const oddNumberedCourts: Array<{ courtIdx: number; playerIds: string[]; count: number }> = []
  const evenNumberedCourts: Array<{ courtIdx: number; playerIds: string[]; count: number }> = []
  
  for (const assignment of assignments) {
    const count = assignment.playerIds.length
    if (count % 2 === 1) {
      // Odd number of players
      oddNumberedCourts.push({ ...assignment, count })
    } else {
      // Even number of players
      evenNumberedCourts.push({ ...assignment, count })
    }
  }

  // CRITICAL: First, merge single-player courts into 2-player courts (no singletons allowed)
  while (true) {
    const singlePlayerCourts = assignments.filter(a => a.playerIds.length === 1)
    if (singlePlayerCourts.length === 0) {
      break
    }
    
    if (singlePlayerCourts.length >= 2) {
      // Merge the first two single-player courts
      const court1 = singlePlayerCourts[0]
      const court2 = singlePlayerCourts[1]
      
      // Merge court2 into court1, remove court2
      court1.playerIds.push(...court2.playerIds)
      const court2Index = assignments.findIndex(a => a.courtIdx === court2.courtIdx)
      if (court2Index >= 0) {
        assignments.splice(court2Index, 1)
      }
    } else if (singlePlayerCourts.length === 1) {
      // Only one single-player court left - try to move player to another court with space
      const singleCourt = singlePlayerCourts[0]
      const playerToMove = singleCourt.playerIds[0]
      const lonePlayer = benchPlayers.find(p => p.id === playerToMove)
      
      // Try to find a court with space (less than 4 players)
      const targetCourt = assignments.find(
        a => a.courtIdx !== singleCourt.courtIdx && a.playerIds.length < 4
      )
      
      if (targetCourt) {
        // For Double players, only move to courts with 2+ players (avoid 1v1)
        if (lonePlayer?.primaryCategory === 'Double' && targetCourt.playerIds.length < 2) {
          // Try to find a better target with 2+ players
          const betterTarget = assignments.find(
            a => a.courtIdx !== singleCourt.courtIdx && 
            a.playerIds.length >= 2 && 
            a.playerIds.length < 4
          )
          if (betterTarget) {
            betterTarget.playerIds.push(playerToMove)
            const singleIndex = assignments.findIndex(a => a.courtIdx === singleCourt.courtIdx)
            if (singleIndex >= 0) {
              assignments.splice(singleIndex, 1)
            }
            break
          }
          // No better target - remove single-player court (player goes to bench)
          // Players cannot play alone, even with odd total - the odd player stays on bench
          const singleIndex = assignments.findIndex(a => a.courtIdx === singleCourt.courtIdx)
          if (singleIndex >= 0) {
            assignments.splice(singleIndex, 1)
            usedPlayerIds.delete(playerToMove)
          }
          break
        }
        
        // Move player to target court
        targetCourt.playerIds.push(playerToMove)
        const singleIndex = assignments.findIndex(a => a.courtIdx === singleCourt.courtIdx)
        if (singleIndex >= 0) {
          assignments.splice(singleIndex, 1)
        }
        break
      } else {
        // No court with space - remove single-player court (player goes to bench)
        // Players cannot play alone, even with odd total - the odd player stays on bench
        const singleIndex = assignments.findIndex(a => a.courtIdx === singleCourt.courtIdx)
        if (singleIndex >= 0) {
          assignments.splice(singleIndex, 1)
          usedPlayerIds.delete(playerToMove)
        }
        break
      }
    }
  }
  
  // CRITICAL: Assign any leftover players to existing courts with space
  // This prevents players from being left on the bench when courts have space
  const stillLeftoverPlayers = benchPlayers.filter((p) => !usedPlayerIds.has(p.id))
  
  // Check if we already have a 3-player court (created upfront for odd totals)
  const has3PlayerCourt = assignments.some(a => a.playerIds.length === 3)
  
  // If we have an odd total but no 3-player court yet, try to create one from leftovers FIRST
  // This ensures we prioritize 3 males before other leftover assignment logic runs
  if (isOddTotal && !has3PlayerCourt && stillLeftoverPlayers.length > 0) {
    const leftoverSinglesEligible = stillLeftoverPlayers.filter(
      p => !usedPlayerIds.has(p.id) && p.primaryCategory !== 'Double'
    )
    
    // Prioritize 3 males
    const leftoverMales = leftoverSinglesEligible.filter(p => p.gender === 'Herre')
    const playersFor3Court = leftoverMales.length >= 3 ? leftoverMales : leftoverSinglesEligible
    
    if (playersFor3Court.length >= 3 && courtIdxIndex < availableCourtIdxs.length && getTotalAssignedPlayers() + 3 <= MAX_PLAYERS_ON_COURTS) {
      const match = create3PlayerMatch(playersFor3Court.slice(0, 3))
      if (match) {
        assignments.push(match)
        match.playerIds.forEach((id) => {
          usedPlayerIds.add(id)
        })
      }
    }
  }
  
  // Recalculate leftover players after potential 3-player court creation
  const finalLeftoverPlayers = benchPlayers.filter((p) => !usedPlayerIds.has(p.id))
  const finalHas3PlayerCourt = assignments.some(a => a.playerIds.length === 3)
  
  if (finalLeftoverPlayers.length > 0) {
    for (const leftoverPlayer of finalLeftoverPlayers) {
      if (usedPlayerIds.has(leftoverPlayer.id)) continue
      if (getTotalAssignedPlayers() >= MAX_PLAYERS_ON_COURTS) break
      
      // Try to add to existing courts with space (less than 4 players)
      let added = false
      for (const assignment of assignments) {
        if (getTotalAssignedPlayers() >= MAX_PLAYERS_ON_COURTS) break
        if (assignment.playerIds.length < 4) {
          // For Double players, only add to courts with 2+ players (avoid 1v1)
          if (leftoverPlayer.primaryCategory === 'Double' && assignment.playerIds.length < 2) {
            continue
          }
          
          // CRITICAL: If we have an odd total and already have a 3-player court,
          // don't add a third player to any 2-player court (would create another 3-player court)
          // Only fill to 2 or 4 players
          if (isOddTotal && finalHas3PlayerCourt && assignment.playerIds.length === 2) {
            // Skip adding third player - would create another 3-player court
            continue
          }
          
          assignment.playerIds.push(leftoverPlayer.id)
          usedPlayerIds.add(leftoverPlayer.id)
          added = true
          break
        }
      }
      
      // If couldn't add to existing court, try to pair with another leftover
      if (!added && leftoverPlayer.primaryCategory !== 'Double') {
        const otherLeftover = finalLeftoverPlayers.find(
          p => p.id !== leftoverPlayer.id && 
          !usedPlayerIds.has(p.id) && 
          p.primaryCategory !== 'Double'
        )
        if (otherLeftover && getTotalAssignedPlayers() + 2 <= MAX_PLAYERS_ON_COURTS) {
          // Find an available court
          const usedCourtIdxs = new Set(assignments.map(a => a.courtIdx))
          const availableCourtIdx = availableCourtIdxs.find(idx => !usedCourtIdxs.has(idx))
          if (availableCourtIdx !== undefined) {
            assignments.push({
              courtIdx: availableCourtIdx,
              playerIds: [leftoverPlayer.id, otherLeftover.id]
            })
            usedPlayerIds.add(leftoverPlayer.id)
            usedPlayerIds.add(otherLeftover.id)
            added = true
          }
        }
      }
      
      // No unsafe last-resort fill: avoid creating 5/6/7 by skipping arbitrary adds here
    }
  }

  // FINAL INVARIANT ENFORCEMENT:
  // If any courts have exactly 1 player AND there are still unassigned bench players,
  // try hard to avoid leaving 1-player courts.
  {
    let singles = assignments.filter(a => a.playerIds.length === 1)
    let remaining = benchPlayers.filter((p) => !usedPlayerIds.has(p.id))
    if (singles.length > 0 && remaining.length > 0) {
      // Prefer pairing singles-eligible players together
      const remainingSinglesEligible = remaining.filter(p => p.primaryCategory !== 'Double')
      // 1) For each single-player court whose lone player is singles-eligible, try to pair with another singles-eligible
      for (const single of singles) {
        if (remaining.length === 0) break
        const lonePlayerId = single.playerIds[0]
        const lonePlayer = benchPlayers.find(p => p.id === lonePlayerId)
        if (!lonePlayer) continue
        if (lonePlayer.primaryCategory !== 'Double') {
          const partner = remainingSinglesEligible.find(p => p.id !== lonePlayerId)
          if (partner && getTotalAssignedPlayers() + 1 <= MAX_PLAYERS_ON_COURTS) {
            single.playerIds.push(partner.id)
            usedPlayerIds.add(partner.id)
            remaining = remaining.filter(p => p.id !== partner.id)
          }
        }
      }
      // 2) For any remaining single-player courts:
      //    - If the lone player is Double, avoid creating a 1v1. Move them to any court with >=2 players and <4.
      //    - Otherwise, add any remaining player (even if it creates an odd court temporarily).
      singles = assignments.filter(a => a.playerIds.length === 1)
      for (const single of singles) {
        if (remaining.length === 0) break
        const lonePlayerId = single.playerIds[0]
        const lonePlayer = benchPlayers.find(p => p.id === lonePlayerId)
        if (!lonePlayer) continue
        if (lonePlayer.primaryCategory === 'Double') {
          // Try to move the Double player into an existing court with >=2 and <4 players
          const target = assignments.find(a => a.courtIdx !== single.courtIdx && a.playerIds.length >= 2 && a.playerIds.length < 4)
          if (target) {
            // Move the lone player to target and free up this court index
            target.playerIds.push(lonePlayerId)
            single.playerIds = []
            // Remove empty assignment
            const idxToRemove = assignments.findIndex(a => a.courtIdx === single.courtIdx)
            if (idxToRemove >= 0) assignments.splice(idxToRemove, 1)
            continue
          }
          // If we have at least 3 singles-eligible remaining, create a 2v2 with the Double
          const singlesEligibles = remaining.filter(p => p.primaryCategory !== 'Double').slice(0, 3)
          if (singlesEligibles.length === 3 && getTotalAssignedPlayers() + 3 <= MAX_PLAYERS_ON_COURTS) {
            single.playerIds.push(...singlesEligibles.map(p => p.id))
            singlesEligibles.forEach(p => usedPlayerIds.add(p.id))
            remaining = remaining.filter(p => !singlesEligibles.some(s => s.id === p.id))
            continue
          }
          // Otherwise, skip (better leave on bench than create a Double 1v1)
        } else {
          // Lone singles-eligible player: add any remaining player to avoid 1-player court
          const partner = remaining.find(p => p.id !== lonePlayerId)
          if (partner && getTotalAssignedPlayers() + 1 <= MAX_PLAYERS_ON_COURTS) {
            // If partner is Double and this would create a 1v1 with a Double, try another partner
            if (partner.primaryCategory === 'Double') {
              const alt = remaining.find(p => p.id !== lonePlayerId && p.primaryCategory !== 'Double')
              if (alt) {
                single.playerIds.push(alt.id)
                usedPlayerIds.add(alt.id)
                remaining = remaining.filter(p => p.id !== alt.id)
              }
            } else {
              single.playerIds.push(partner.id)
              usedPlayerIds.add(partner.id)
              remaining = remaining.filter(p => p.id !== partner.id)
            }
          }
        }
      }
    }
  }

  // If we have multiple courts with odd numbers, redistribute players
  // Goal: 
  // - If total players is EVEN: ALL courts must be EVEN (no odd-numbered courts allowed)
  // - If total players is ODD: ONE court must be 3, all others EVEN
  // Reclassify courts after merging
  oddNumberedCourts.length = 0
  evenNumberedCourts.length = 0
  for (const assignment of assignments) {
    const count = assignment.playerIds.length
    if (count % 2 === 1) {
      oddNumberedCourts.push({ ...assignment, count })
    } else {
      evenNumberedCourts.push({ ...assignment, count })
    }
  }

  // Enforce odd-total rule: if total is odd, ensure exactly one 3-player court
  if (hasOddTotalPlayers) {
    // Identify current odd courts and pick the one to keep (prefer size 3)
    const currentOdd = assignments.filter(a => a.playerIds.length % 2 === 1)
    const keep = currentOdd.find(a => a.playerIds.length === 3) ?? currentOdd[0]
    if (keep) {
      // Reduce kept odd court to exactly 3 by moving pairs of players out
      const usedCourtIdxsSet = new Set(assignments.map(a => a.courtIdx))
      const unusedCourtIdxsLocal = availableCourtIdxs.filter(idx => !usedCourtIdxsSet.has(idx))
      while (keep.playerIds.length > 3) {
        const moved = keep.playerIds.splice(0, 2)
        const nextIdx = unusedCourtIdxsLocal.shift()
        if (nextIdx !== undefined) {
          assignments.push({ courtIdx: nextIdx, playerIds: moved })
        } else {
          // If no unused courts, try to add to any even court with <=2 to keep evenness
          const target = assignments.find(a => a.courtIdx !== keep!.courtIdx && a.playerIds.length <= 2)
          if (target) {
            target.playerIds.push(...moved)
          } else {
            // Cannot place safely; put them back and break (rare)
            keep.playerIds.push(...moved)
            break
          }
        }
      }
      // If kept odd court is a singleton, raise it to 3 by moving two players from an even court
      if (keep.playerIds.length === 1) {
        // Prefer taking two from a 2-court; else take two from a 4/8 (reduces to even)
        const donor =
          assignments.find(a => a.courtIdx !== keep.courtIdx && a.playerIds.length === 2) ??
          assignments.find(a => a.courtIdx !== keep.courtIdx && a.playerIds.length >= 4)
        if (donor && donor.playerIds.length >= 2) {
          keep.playerIds.push(donor.playerIds.pop()!)
          keep.playerIds.push(donor.playerIds.pop()!)
        }
      }
      // Make all other odd courts even by moving one player to some even court with <4
      const others = currentOdd.filter(a => a.courtIdx !== keep!.courtIdx)
      for (const oc of others) {
        while (oc.playerIds.length % 2 === 1) {
          const p = oc.playerIds.pop()
          if (!p) break
          const target = assignments.find(a => a.courtIdx !== oc.courtIdx && a.playerIds.length < 4)
          if (target) {
            target.playerIds.push(p)
          } else {
            // If no even court with space, try to pair into new 2 on unused court
            const nextIdx = unusedCourtIdxsLocal.shift()
            if (nextIdx !== undefined) {
              // Need another player to make 2; pull from another odd court if available
              const donor = others.find(x => x.courtIdx !== oc.courtIdx && x.playerIds.length >= 1)
              if (donor) {
                const p2 = donor.playerIds.pop()
                if (p2) {
                  assignments.push({ courtIdx: nextIdx, playerIds: [p, p2] })
                  continue
                }
              }
              // Fallback: return player
              oc.playerIds.push(p)
              break
            } else {
              // No placement possible; return and break
              oc.playerIds.push(p)
              break
            }
          }
        }
      }
    }
  }

  if (oddNumberedCourts.length > 1 || (oddNumberedCourts.length > 0 && !hasOddTotalPlayers)) {
    // We have multiple odd-numbered courts OR we have odd-numbered courts when total is even
    // Strategy: Move players from odd-numbered courts to even-numbered courts to make them even
    // Keep one odd-numbered court (the first one) ONLY if total players is odd
    
    // Sort odd-numbered courts by player count (smallest first) to prioritize redistributing from smaller courts
    oddNumberedCourts.sort((a, b) => a.count - b.count)
    
    // If total players is EVEN: fix ALL odd-numbered courts (make them all even)
    // If total players is ODD: keep the first one, fix the rest
    const courtsToFix = hasOddTotalPlayers 
      ? oddNumberedCourts.slice(1) // Keep first one, fix the rest
      : oddNumberedCourts // Fix all of them (total is even, so no odd courts allowed)
    
    for (const oddCourt of courtsToFix) {
      // Try to move one player from this odd-numbered court to an even-numbered court
      // Handle both single-player courts (length === 1) and multi-player odd courts (length > 1)
      if (oddCourt.playerIds.length >= 1) {
        // Find an even-numbered court with space (less than 4 players)
        const targetCourt = evenNumberedCourts.find(c => c.count < 4)
        if (targetCourt) {
          // Move one player from odd court to even court
          const playerToMove = oddCourt.playerIds.pop()!
          targetCourt.playerIds.push(playerToMove)
          targetCourt.count++
          oddCourt.count--
          
          // Update the assignment
          const oddAssignment = assignments.find(a => a.courtIdx === oddCourt.courtIdx)
          const targetAssignment = assignments.find(a => a.courtIdx === targetCourt.courtIdx)
          if (oddAssignment && targetAssignment) {
            oddAssignment.playerIds = oddCourt.playerIds
            targetAssignment.playerIds = targetCourt.playerIds
          }
          
          // Reclassify courts
          if (oddCourt.count % 2 === 0) {
            // Odd court is now even
            const index = oddNumberedCourts.indexOf(oddCourt)
            if (index >= 0) {
              oddNumberedCourts.splice(index, 1)
              evenNumberedCourts.push(oddCourt)
            }
          }
          if (targetCourt.count % 2 === 1) {
            // Even court is now odd
            const index = evenNumberedCourts.indexOf(targetCourt)
            if (index >= 0) {
              evenNumberedCourts.splice(index, 1)
              oddNumberedCourts.push(targetCourt)
            }
          }
        } else {
          // No even-numbered court with space - try to merge with another odd-numbered court
          // or create a new even-numbered court by combining players
          if (oddCourt.playerIds.length === 1) {
            // Single-player court - try to merge with another single-player court
            const otherSingleCourt = oddNumberedCourts.find(
              c => c.courtIdx !== oddCourt.courtIdx && c.playerIds.length === 1
            )
            if (otherSingleCourt) {
              // Merge the two single-player courts into one 2-player court
              oddCourt.playerIds.push(...otherSingleCourt.playerIds)
              oddCourt.count = 2
              
              // Update the assignment
              const oddAssignment = assignments.find(a => a.courtIdx === oddCourt.courtIdx)
              if (oddAssignment) {
                oddAssignment.playerIds = oddCourt.playerIds
              }
              
              // Remove the other single-player court
              const otherAssignment = assignments.find(a => a.courtIdx === otherSingleCourt.courtIdx)
              if (otherAssignment) {
                const otherIndex = assignments.indexOf(otherAssignment)
                if (otherIndex >= 0) {
                  assignments.splice(otherIndex, 1)
                }
              }
              
              // Remove from oddNumberedCourts and add to evenNumberedCourts
              const oddIndex = oddNumberedCourts.indexOf(oddCourt)
              const otherOddIndex = oddNumberedCourts.indexOf(otherSingleCourt)
              if (oddIndex >= 0) {
                oddNumberedCourts.splice(oddIndex, 1)
                evenNumberedCourts.push(oddCourt)
              }
              if (otherOddIndex >= 0) {
                oddNumberedCourts.splice(otherOddIndex, 1)
              }
            }
          } else if (oddCourt.playerIds.length >= 3) {
            // Multi-player odd court - take 2 players to create a new 2-player match
            const playersToMove = oddCourt.playerIds.splice(0, 2)
            oddCourt.count -= 2
            
            // Find an available court index
            const usedCourtIdxs = new Set(assignments.map(a => a.courtIdx))
            const availableCourtIdx = availableCourtIdxs.find(idx => !usedCourtIdxs.has(idx))
            if (availableCourtIdx) {
              assignments.push({
                courtIdx: availableCourtIdx,
                playerIds: playersToMove
              })
              evenNumberedCourts.push({ courtIdx: availableCourtIdx, playerIds: playersToMove, count: 2 })
            }
            
            // Update the assignment
            const oddAssignment = assignments.find(a => a.courtIdx === oddCourt.courtIdx)
            if (oddAssignment) {
              oddAssignment.playerIds = oddCourt.playerIds
            }
            
            // Reclassify court
            if (oddCourt.count % 2 === 0) {
              const index = oddNumberedCourts.indexOf(oddCourt)
              if (index >= 0) {
                oddNumberedCourts.splice(index, 1)
                evenNumberedCourts.push(oddCourt)
              }
            }
          }
        }
      }
    }
  }

  // FINAL CHECK: Ensure no single-player courts exist (regardless of total parity)
  // This is a critical invariant - players cannot play alone
  // Even with odd total, the odd player should stay on bench, not be alone on a court
  const finalSingles = assignments.filter(a => a.playerIds.length === 1)
  if (finalSingles.length > 0) {
    for (const single of finalSingles) {
      // Try to merge with another single-player court first
      const otherSingle = assignments.find(
        a => a.courtIdx !== single.courtIdx && a.playerIds.length === 1
      )
      if (otherSingle) {
        // Merge the two single-player courts
        single.playerIds.push(...otherSingle.playerIds)
        const otherIndex = assignments.findIndex(a => a.courtIdx === otherSingle.courtIdx)
        if (otherIndex >= 0) {
          assignments.splice(otherIndex, 1)
        }
        continue
      }
      
      // If no other single-player court, try to move this player to any court with space
      const targetCourt = assignments.find(
        a => a.courtIdx !== single.courtIdx && a.playerIds.length < 4
      )
      if (targetCourt) {
        const playerToMove = single.playerIds[0]
        const lonePlayer = benchPlayers.find(p => p.id === playerToMove)
        
        // For Double players, only move to courts with 2+ players (avoid 1v1)
        if (lonePlayer?.primaryCategory === 'Double' && targetCourt.playerIds.length < 2) {
          // Try to find a court with 2+ players instead
          const betterTarget = assignments.find(
            a => a.courtIdx !== single.courtIdx && 
            a.playerIds.length >= 2 && 
            a.playerIds.length < 4
          )
          if (betterTarget) {
            betterTarget.playerIds.push(playerToMove)
            const singleIndex = assignments.findIndex(a => a.courtIdx === single.courtIdx)
            if (singleIndex >= 0) {
              assignments.splice(singleIndex, 1)
            }
            continue
          }
          // If no better target, leave on bench rather than create Double 1v1
          const singleIndex = assignments.findIndex(a => a.courtIdx === single.courtIdx)
          if (singleIndex >= 0) {
            assignments.splice(singleIndex, 1)
            usedPlayerIds.delete(playerToMove)
          }
          continue
        }
        
        // Move player to target court
        targetCourt.playerIds.push(playerToMove)
        const singleIndex = assignments.findIndex(a => a.courtIdx === single.courtIdx)
        if (singleIndex >= 0) {
          assignments.splice(singleIndex, 1)
        }
      } else {
        // No court with space - remove this single-player court (player goes back to bench)
        const playerToMove = single.playerIds[0]
        const singleIndex = assignments.findIndex(a => a.courtIdx === single.courtIdx)
        if (singleIndex >= 0) {
          assignments.splice(singleIndex, 1)
          usedPlayerIds.delete(playerToMove)
        }
      }
    }
  }

  // Calculate final leftover players (after all assignments and merges)
  const leftoverPlayerIds = benchPlayers.filter((p) => !usedPlayerIds.has(p.id)).map((p) => p.id)

  // FINAL VALIDATION: Log and fix any remaining single-player courts (should never happen)
  // Players cannot play alone - always remove single-player courts, regardless of total parity
  // The odd player (if any) should stay on the bench, not be alone on a court
  const remainingSingles = assignments.filter(a => a.playerIds.length === 1)
  if (remainingSingles.length > 0) {
    console.warn(`[autoArrange] WARNING: Found ${remainingSingles.length} single-player court(s) after all fixes:`, 
      remainingSingles.map(s => ({ courtIdx: s.courtIdx, playerId: s.playerIds[0] }))
    )
    
    // Always remove single-player courts - players cannot play alone
    for (const single of remainingSingles) {
      const playerId = single.playerIds[0]
      console.warn(`[autoArrange] Removing single-player court ${single.courtIdx} with player ${playerId} (players cannot play alone)`)
      const singleIndex = assignments.findIndex(a => a.courtIdx === single.courtIdx)
      if (singleIndex >= 0) {
        assignments.splice(singleIndex, 1)
        usedPlayerIds.delete(playerId)
      }
    }
  }

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
      toCourtIdx: z.number().int().min(1).optional(),
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
    throw new Error('Ukendt bane')
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
      // If any player is in slot 4+, allow up to 8 capacity
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
    autoArrange: (round?: number, unavailablePlayerIds?: Set<string>, activatedOneRoundPlayers?: Set<string>, lockedCourtIdxs?: Set<number>, isReshuffle?: boolean, currentMatches?: CourtWithPlayers[], extendedCapacityCourts?: Map<number, number>) => autoArrangeMatches(round, unavailablePlayerIds, activatedOneRoundPlayers, lockedCourtIdxs, isReshuffle, currentMatches, extendedCapacityCourts),
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
