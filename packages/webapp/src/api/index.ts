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
      gender: z.enum(['Herre', 'Dame']).nullable().optional(),
      primaryCategory: z.enum(['Single', 'Double', 'Begge']).nullable().optional(),
      active: z.boolean().optional()
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
  if (parsed.patch.gender !== undefined) updateData.gender = parsed.patch.gender
  if (parsed.patch.primaryCategory !== undefined) updateData.primaryCategory = parsed.patch.primaryCategory
  if (parsed.patch.active !== undefined) updateData.active = parsed.patch.active

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
 * Ends the active session and marks all related matches as ended.
 * @throws Error if no active session
 * @remarks Automatically creates a statistics snapshot when session ends.
 */
const endActiveSession = async (): Promise<void> => {
  const active = await getActiveSession()
  if (!active) {
    throw new Error('Ingen aktiv træning')
  }

  // Update session status to ended
  await updateSessionInDb(active.id, { status: 'ended' })

  // Update all matches for this session
  const matches = await getMatches()
  const sessionMatches = matches.filter((match: Match) => match.sessionId === active.id)
  const endedAt = new Date().toISOString()
  for (const match of sessionMatches) {
    await updateMatchInDb(match.id, { endedAt })
  }

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
  endActive: endActiveSession
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
 * @returns Result with filled courts count and benched players count
 * @remarks For rounds 2+, avoids repeating previous matchups (3+ same players).
 * Prioritizes Double players in 2v2 matches, balances levels, and avoids
 * duplicate partners/opponents from earlier rounds. Excludes inactive/unavailable players
 * and players with maxRounds === 1 (unless manually activated). Includes randomization
 * to allow different outcomes on re-shuffle.
 */
const autoArrangeMatches = async (round?: number, unavailablePlayerIds?: Set<string>, activatedOneRoundPlayers?: Set<string>, lockedCourtIdxs?: Set<number>, isReshuffle?: boolean): Promise<AutoArrangeResult> => {
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
  // For reshuffle: include players from non-locked courts in the pool to be reshuffled
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
        // For reshuffle: include players from non-locked courts in the reshuffle pool
        if (isReshuffle) {
          return false // Don't exclude - they'll be reshuffled
        }
        // For initial match: exclude all players already assigned in this round
        return true
      })
      .map((mp) => mp.playerId)
  )

  // Get bench players with their full data
  // Exclude players already assigned to courts, inactive/unavailable players, and "Kun 1 runde" players (rounds 2+)
  const benchPlayers = checkIns
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

  if (!benchPlayers.length) {
    return { filledCourts: 0, benched: 0 }
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

  // For reshuffle: clear existing matches from non-locked courts BEFORE creating assignments
  if (isReshuffle && existingMatchesInRound.length > 0) {
    const matchesToClear = existingMatchesInRound.filter((match: Match) => {
      const court = stateCourts.find((c) => c.id === match.courtId)
      return court && !lockedCourtIdxs?.has(court.idx)
    })
    
    const matchIdsToClear = matchesToClear.map((m: Match) => m.id)
    const matchPlayersToDelete = state.matchPlayers.filter((mp) => 
      matchIdsToClear.includes(mp.matchId)
    )
    
    // Bulk delete match players and matches
    const deletePlayerPromises = matchPlayersToDelete.map((mp) => deleteMatchPlayerInDb(mp.id))
    const deleteMatchPromises = matchIdsToClear.map((matchId) => deleteMatchInDb(matchId))
    await Promise.all([...deletePlayerPromises, ...deleteMatchPromises])
    
    // Refresh state after clearing
    const updatedState = await getStateCopy()
    // Update benchPlayers to include players that were just cleared
    const clearedPlayerIds = new Set(matchPlayersToDelete.map((mp) => mp.playerId))
    const clearedPlayers = checkIns
      .map((checkIn: CheckIn) => {
        const player = updatedState.players.find((p: Player) => p.id === checkIn.playerId)
        if (!player || !clearedPlayerIds.has(player.id)) return null
        return { ...player, checkInId: checkIn.id, maxRounds: checkIn.maxRounds }
      })
      .filter((p): p is Player & { checkInId: string; maxRounds?: number | null } => {
        if (p === null) return false
        // Exclude inactive/unavailable players
        if (unavailablePlayerIds?.has(p.id)) return false
        // Exclude players who only want to play 1 round if we're in rounds 2+, UNLESS they've been manually activated
        if ((round ?? 1) > 1 && p.maxRounds === 1 && !activatedOneRoundPlayers?.has(p.id)) return false
        return true
      })
    
    // Add cleared players to benchPlayers
    benchPlayers.push(...clearedPlayers)
  }

  if (!availableCourtIdxs.length) {
    return { filledCourts: 0, benched: benchPlayers.length }
  }

  // Add randomization seed based on current time to allow different outcomes
  let randomSeed = Date.now() % 10000
  const random = () => {
    // Simple seeded random number generator
    randomSeed = (randomSeed * 9301 + 49297) % 233280
    return randomSeed / 233280
  }

  // Sort players by level with some randomization to allow variation
  // Still prioritize by level, but add small random factor to allow different ordering
  benchPlayers.sort((a, b) => {
    const levelA = a.level ?? 0
    const levelB = b.level ?? 0
    const levelDiff = levelA - levelB
    // Add small random factor (±0.5) to allow variation while maintaining level-based sorting
    const randomFactor = (random() - 0.5) * 0.3
    return levelDiff + randomFactor
  })

  // For rounds 2+, track previous matchups to avoid repeating partners/opponents
  const previousMatchups = new Set<string>()
  if (round !== undefined && round > 1) {
    // Get all previous matches (earlier rounds)
    const earlierMatches = state.matches.filter(
      (match: Match) => match.sessionId === session.id && match.round !== undefined && match.round !== null && match.round < round
    )
    
    // Track all player pairs that have played together (as teammates or opponents)
    earlierMatches.forEach((match: Match) => {
      const matchPlayerIds = state.matchPlayers
        .filter((mp) => mp.matchId === match.id)
        .map((mp) => mp.playerId)
      
      // Create all possible pairs from this match (both teammates and opponents)
      for (let i = 0; i < matchPlayerIds.length; i++) {
        for (let j = i + 1; j < matchPlayerIds.length; j++) {
          const pair = [matchPlayerIds[i], matchPlayerIds[j]].sort().join('|')
          previousMatchups.add(pair)
        }
  }
    })
  }

  // Helper function to check if two players have played together before
  const havePlayedTogether = (playerId1: string, playerId2: string): boolean => {
    const pair = [playerId1, playerId2].sort().join('|')
    return previousMatchups.has(pair)
  }

  // Helper function to score a match combination (lower is better)
  // Prefers new matchups over repeat matchups, and balanced levels
  // Made less absolute to allow variation - repeat matchups are discouraged but not forbidden
  const scoreMatchup = (player1: Player, player2: Player, isTeam: boolean): number => {
    const levelDiff = Math.abs((player1.level ?? 0) - (player2.level ?? 0))
    const isRepeat = havePlayedTogether(player1.id, player2.id)
    // Reduced penalty to allow some variation - repeat matchups are discouraged but not forbidden
    // Add random factor to allow different outcomes
    const randomFactor = random() * 20 // Add 0-20 random variation
    const repeatPenalty = isRepeat ? (isTeam ? 200 : 100) : 0 // Reduced from 1000/500
    return levelDiff + repeatPenalty + randomFactor
  }

  // Helper function to score a team split for 2v2
  const scoreTeamSplit = (players: Player[], team1: [number, number], team2: [number, number]): number => {
    const [i, j] = team1
    const [k, l] = team2
    
    // Score within-team balance (partners)
    const team1Score = scoreMatchup(players[i], players[j], true)
    const team2Score = scoreMatchup(players[k], players[l], true)
    
    // Score cross-team balance (opponents)
    const crossTeamScore = 
      scoreMatchup(players[i], players[k], false) +
      scoreMatchup(players[i], players[l], false) +
      scoreMatchup(players[j], players[k], false) +
      scoreMatchup(players[j], players[l], false)
    
    // Calculate level balance
    const levels = players.map((p) => p.level ?? 0)
    const team1Total = levels[i] + levels[j]
    const team2Total = levels[k] + levels[l]
    const levelBalance = Math.abs(team1Total - team2Total)
    
    // Combine all factors (lower is better)
    return team1Score + team2Score + crossTeamScore / 4 + levelBalance
  }

  // Smart matching algorithm - PRIORITY: Get ALL players assigned to a court
  // Rule: Double players NEVER play Singles
  // For rounds 2+: Prefer new partner/opponent combinations
  const assignments: Array<{ courtIdx: number; playerIds: string[] }> = []
  const usedPlayerIds = new Set<string>()
  let courtIdxIndex = 0
  const remainingPlayers = [...benchPlayers]

  // Helper function to create balanced 2v2 match with variety preference
  // Made less absolute - considers top N splits instead of just the best one
  const createDoublesMatch = (players: Player[]): { courtIdx: number; playerIds: string[] } | null => {
    if (players.length !== 4) return null
    
    // Score all possible team splits
    const splits: Array<{ team1: [number, number]; team2: [number, number]; score: number }> = []
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 4; j++) {
        const team1: [number, number] = [i, j]
        const team2: [number, number] = [0, 1, 2, 3].filter((idx) => idx !== i && idx !== j) as [number, number]
        const score = scoreTeamSplit(players, team1, team2)
        splits.push({ team1, team2, score })
      }
    }
    
    // Sort by score and pick from top 3 (or all if less than 3) to allow variation
    splits.sort((a, b) => a.score - b.score)
    const topSplits = splits.slice(0, Math.min(3, splits.length))
    
    // Randomly select from top splits (weighted towards better scores)
    const selectedSplit = topSplits[Math.floor(random() * topSplits.length)]
    
    const [i, j] = selectedSplit.team1
    const team1 = [players[i].id, players[j].id]
    const team2 = players.filter((_, idx) => idx !== i && idx !== j).map((p) => p.id)
    
    return {
      courtIdx: availableCourtIdxs[courtIdxIndex++],
      playerIds: [...team1, ...team2]
    }
  }

  // Helper function to create balanced 1v1 match with variety preference
  // Made less absolute - considers top N opponents instead of just the best one
  const createSinglesMatch = (players: Player[]): { courtIdx: number; playerIds: string[] } | null => {
    if (players.length < 2) return null
    
    const player1 = players[0]
    // Score all possible opponents
    const opponents: Array<{ index: number; score: number }> = []
    for (let i = 1; i < players.length; i++) {
      const score = scoreMatchup(player1, players[i], false)
      opponents.push({ index: i, score })
    }
    
    // Sort by score and pick from top 3 (or all if less than 3) to allow variation
    opponents.sort((a, b) => a.score - b.score)
    const topOpponents = opponents.slice(0, Math.min(3, opponents.length))
    
    // Randomly select from top opponents (weighted towards better scores)
    const selectedOpponent = topOpponents[Math.floor(random() * topOpponents.length)]
    
    return {
      courtIdx: availableCourtIdxs[courtIdxIndex++],
      playerIds: [player1.id, players[selectedOpponent.index].id]
    }
  }

  // Main strategy: Assign ALL players to courts, prioritizing balanced matches
  // Made less absolute - add randomization to player selection order
  while (remainingPlayers.length > 0 && courtIdxIndex < availableCourtIdxs.length) {
    // Re-sort with randomization to allow different outcomes
    remainingPlayers.sort((a, b) => {
      const levelA = a.level ?? 0
      const levelB = b.level ?? 0
      const levelDiff = levelA - levelB
      const randomFactor = (random() - 0.5) * 0.3
      return levelDiff + randomFactor
    })
    
    // Separate players by category
    const doublesOnly = remainingPlayers.filter((p) => p.primaryCategory === 'Double')
    const singlesEligible = remainingPlayers.filter((p) => p.primaryCategory !== 'Double')
    
    // PRIORITY 1: If we have Double players, create 2v2 matches to accommodate them
    // Use Singles players in doubles if needed to get Double players assigned
    // Made less absolute - allow some variation in player selection
    if (doublesOnly.length > 0 && remainingPlayers.length >= 4) {
      // Take 4 players (prioritize Double players, fill with Singles if needed)
      const players: Player[] = []
      
      // Shuffle doubles players to allow variation
      const shuffledDoubles = [...doublesOnly].sort(() => random() - 0.5)
      
      // Add Double players first (with some randomization)
      for (const p of shuffledDoubles) {
        if (players.length < 4 && !usedPlayerIds.has(p.id)) {
          players.push(p)
          usedPlayerIds.add(p.id)
        }
      }
      
      // Shuffle singles-eligible players to allow variation
      const shuffledSingles = [...singlesEligible].sort(() => random() - 0.5)
      
      // Fill remaining slots with Singles-eligible players
      for (const p of shuffledSingles) {
        if (players.length < 4 && !usedPlayerIds.has(p.id)) {
          players.push(p)
          usedPlayerIds.add(p.id)
        }
      }
      
      if (players.length === 4) {
        const match = createDoublesMatch(players)
        if (match) {
          assignments.push(match)
          // Remove assigned players from remaining
          players.forEach((p) => {
            const idx = remainingPlayers.findIndex((rp) => rp.id === p.id)
            if (idx >= 0) remainingPlayers.splice(idx, 1)
          })
          continue
        }
      }
    }
    
    // PRIORITY 2: Create 2v2 matches if we have 4+ players
    // Made less absolute - allow variation in which players are selected
    if (remainingPlayers.length >= 4) {
      // Instead of always taking first 4, sometimes take a random sample to allow variation
      // But still prefer balanced selection
      let players: Player[]
      if (random() > 0.7) {
        // 30% chance: take a slightly randomized selection
        const shuffled = [...remainingPlayers].sort(() => random() - 0.5)
        players = shuffled.slice(0, 4)
        // Remove selected players from remaining
        players.forEach((p) => {
          const idx = remainingPlayers.findIndex((rp) => rp.id === p.id)
          if (idx >= 0) remainingPlayers.splice(idx, 1)
        })
      } else {
        // 70% chance: take first 4 (more predictable)
        players = remainingPlayers.splice(0, 4)
      }
      
      const match = createDoublesMatch(players)
      if (match) {
        assignments.push(match)
        players.forEach((p) => usedPlayerIds.add(p.id))
        continue
      }
      // If match creation failed, put players back
      remainingPlayers.push(...players)
    }
    
    // PRIORITY 3: Create 1v1 matches with Singles-eligible players (NEVER with Double players)
    if (singlesEligible.length >= 2) {
      const eligible = singlesEligible.filter((p) => !usedPlayerIds.has(p.id))
      if (eligible.length >= 2) {
        const match = createSinglesMatch(eligible)
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
    
    // PRIORITY 4: If we have Double players left but not enough for 2v2, force Singles players into doubles
    // This ensures ALL players get assigned
    if (doublesOnly.length > 0 && remainingPlayers.length >= 2 && courtIdxIndex < availableCourtIdxs.length) {
      const players: Player[] = []
      
      // Add Double players
      for (const p of doublesOnly) {
        if (players.length < 4 && !usedPlayerIds.has(p.id)) {
          players.push(p)
          usedPlayerIds.add(p.id)
        }
      }
      
      // Fill with Singles-eligible players
      for (const p of singlesEligible) {
        if (players.length < 4 && !usedPlayerIds.has(p.id)) {
          players.push(p)
          usedPlayerIds.add(p.id)
        }
      }
      
      // If we have 4, create 2v2
      if (players.length === 4) {
        const match = createDoublesMatch(players)
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
    
    // PRIORITY 5: If we have 2-3 players left and no Double players, create best 1v1 match
    if (remainingPlayers.length >= 2 && doublesOnly.length === 0) {
      const match = createSinglesMatch(remainingPlayers)
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
    
    // If we can't create any more matches, break
    // This should rarely happen, but prevents infinite loops
    if (remainingPlayers.length < 2) {
      break
    }
    
    // If we have Double players but no Singles players to help, we can't proceed
    if (doublesOnly.length > 0 && singlesEligible.length === 0 && remainingPlayers.length < 4) {
      break
    }
    
    // Last resort: try to match any remaining players
    if (remainingPlayers.length >= 2) {
      // Only create 1v1 if no Double players
      if (doublesOnly.length === 0) {
        const match = createSinglesMatch(remainingPlayers)
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

  const leftoverPlayerIds = benchPlayers.filter((p) => !usedPlayerIds.has(p.id)).map((p) => p.id)

  if (!assignments.length) {
    return { filledCourts: 0, benched: leftoverPlayerIds.length }
  }

  // Get courts to map idx to id
  const courts = await getCourts()
  const courtsByIdx = new Map(courts.map((court) => [court.idx, court]))
  
  // Create matches and match players in Supabase
  for (const { courtIdx, playerIds } of assignments) {
    const court = courtsByIdx.get(courtIdx)
    if (!court) continue
    
    const match = await createMatchInDb({
      sessionId: session.id,
      courtId: court.id,
      startedAt: new Date().toISOString(),
      endedAt: null,
      round: round ?? null
    })
    
    // For 1v1 matches (2 players), place them in slots 1 and 2 (opposite sides of net)
    // For 2v2 matches (4 players), use slots 0, 1, 2, 3 (normal order)
    if (playerIds.length === 2) {
      // 1v1 match: place players in slots 1 and 2
      await createMatchPlayerInDb({
        matchId: match.id,
        playerId: playerIds[0],
        slot: 1
      })
      await createMatchPlayerInDb({
        matchId: match.id,
        playerId: playerIds[1],
        slot: 2
      })
    } else {
      // 2v2 match: use slots 0, 1, 2, 3
      for (let slot = 0; slot < playerIds.length; slot++) {
        await createMatchPlayerInDb({
          matchId: match.id,
          playerId: playerIds[slot],
          slot
        })
      }
    }
  }

  return {
    filledCourts: assignments.length,
    benched: leftoverPlayerIds.length
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
  autoArrange: (round?: number, unavailablePlayerIds?: Set<string>, activatedOneRoundPlayers?: Set<string>, lockedCourtIdxs?: Set<number>, isReshuffle?: boolean) => autoArrangeMatches(round, unavailablePlayerIds, activatedOneRoundPlayers, lockedCourtIdxs, isReshuffle),
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
