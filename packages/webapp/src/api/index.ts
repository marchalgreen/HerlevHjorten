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
import { createId, createBackup, restoreFromBackup, hasBackup, getStateCopy, loadState, updateState } from './storage'
import type { DatabaseState } from './storage'
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
  const state = getStateCopy()
  const term = filters?.q?.trim().toLowerCase()
  const filtered = state.players.filter((player) => {
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
  let created!: Player
  updateState((state: DatabaseState) => {
    created = {
      id: createId(),
      name: parsed.name.trim(),
      alias: parsed.alias ? parsed.alias.trim() : null,
      level: parsed.level ?? null,
      gender: parsed.gender ?? null,
      primaryCategory: parsed.primaryCategory ?? null,
      active: parsed.active ?? true,
      createdAt: new Date().toISOString()
    }
    state.players.push(created)
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
  let updated!: Player
  updateState((state: DatabaseState) => {
    const index = state.players.findIndex((player) => player.id === parsed.id)
    if (index === -1) {
      throw new Error('Spiller ikke fundet')
    }
    const existing = state.players[index]
    updated = {
      ...existing,
      ...parsed.patch,
      name: parsed.patch.name !== undefined ? parsed.patch.name.trim() : existing.name,
      alias: parsed.patch.alias !== undefined ? parsed.patch.alias : existing.alias,
      level: parsed.patch.level !== undefined ? parsed.patch.level : existing.level,
      gender: parsed.patch.gender !== undefined ? parsed.patch.gender : existing.gender,
      primaryCategory: parsed.patch.primaryCategory !== undefined ? parsed.patch.primaryCategory : existing.primaryCategory,
      active: parsed.patch.active !== undefined ? parsed.patch.active : existing.active
    }
    state.players[index] = updated
  })
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
  const state = loadState()
  const active = state.sessions
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
  const session: TrainingSession = {
    id: createId(),
    date: now,
    status: 'active',
    createdAt: now
  }
  updateState((state: DatabaseState) => {
    state.sessions.push(session)
  })
  return session
}

/**
 * Ends the active session and marks all related matches as ended.
 * @throws Error if no active session
 * @remarks Automatically creates a statistics snapshot when session ends.
 */
const endActiveSession = async (): Promise<void> => {
  let sessionId: string | null = null
  updateState((state: DatabaseState) => {
    const active = state.sessions.find((session) => session.status === 'active')
    if (!active) {
      throw new Error('Ingen aktiv træning')
    }
    sessionId = active.id
    active.status = 'ended'
    const matches = state.matches.filter((match: Match) => match.sessionId === active.id)
    const endedAt = new Date().toISOString()
    matches.forEach((match: Match) => {
      match.endedAt = endedAt
    })
  })

  // Create statistics snapshot after session is marked as ended
  if (sessionId) {
    try {
      await statsApi.snapshotSession(sessionId)
    } catch (err) {
      // Log error but don't fail the session ending
      console.error('Failed to create statistics snapshot:', err)
    }
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
  const state = loadState()
  const player = state.players.find((item) => item.id === input.playerId)
  if (!player) {
    throw new Error('Spiller ikke fundet')
  }
  if (!player.active) {
    throw new Error('Spiller er inaktiv')
  }
  const existing = state.checkIns.find(
    (checkIn) => checkIn.sessionId === session.id && checkIn.playerId === input.playerId
  )
  if (existing) {
    throw new Error('Spilleren er allerede tjekket ind')
  }
  const checkIn = {
    id: createId(),
    sessionId: session.id,
    playerId: input.playerId,
    createdAt: new Date().toISOString(),
    maxRounds: input.maxRounds ?? null
  }
  updateState((current: DatabaseState) => {
    current.checkIns.push(checkIn)
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
  const state = loadState()
  return state.checkIns
    .filter((checkIn: CheckIn) => checkIn.sessionId === session.id)
    .sort((a: CheckIn, b: CheckIn) => a.createdAt.localeCompare(b.createdAt))
    .map((checkIn: CheckIn) => {
      const player = state.players.find((p: Player) => p.id === checkIn.playerId)
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
  const state = loadState()
  const checkInIndex = state.checkIns.findIndex(
    (checkIn: CheckIn) => checkIn.sessionId === session.id && checkIn.playerId === input.playerId
  )
  if (checkInIndex === -1) {
    throw new Error('Spilleren er ikke tjekket ind')
  }
  updateState((current: DatabaseState) => {
    current.checkIns.splice(checkInIndex, 1)
    })
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
  const state = loadState()
  const session = await getActiveSession()
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
  updateState((state: DatabaseState) => {
    const matchIds = state.matches.filter((match: Match) => match.sessionId === session.id).map((m: Match) => m.id)
    state.matches = state.matches.filter((match: Match) => match.sessionId !== session.id)
    state.matchPlayers = state.matchPlayers.filter((mp) => !matchIds.includes(mp.matchId))
  })
}

/**
 * Auto-arranges players into balanced matches using smart algorithm.
 * @param round - Optional round number (1-4) for duplicate detection
 * @returns Result with filled courts count and benched players count
 * @remarks For rounds 2+, avoids repeating previous matchups (3+ same players).
 * Prioritizes Double players in 2v2 matches, balances levels, and avoids
 * duplicate partners/opponents from earlier rounds.
 */
const autoArrangeMatches = async (round?: number): Promise<AutoArrangeResult> => {
  const session = await ensureActiveSession()
  const state = loadState()
  const checkIns = state.checkIns
    .filter((checkIn: CheckIn) => checkIn.sessionId === session.id)
    .sort((a: CheckIn, b: CheckIn) => a.createdAt.localeCompare(b.createdAt))

  if (!checkIns.length) {
    return { filledCourts: 0, benched: 0 }
  }

  // Filter matches: exclude players already in the same round (allow same player in different rounds)
  const existingMatchesInRound = state.matches.filter(
    (match: Match) => match.sessionId === session.id && (match.round ?? 1) === (round ?? 1)
  )
  
  // Only exclude players who are already assigned in THIS round
  const assignedPlayers = new Set(
    state.matchPlayers
      .filter((mp) => existingMatchesInRound.some((match: Match) => match.id === mp.matchId))
      .map((mp) => mp.playerId)
  )

  // Get bench players with their full data
  const benchPlayers = checkIns
    .map((checkIn: CheckIn) => {
      const player = state.players.find((p: Player) => p.id === checkIn.playerId)
      return player ? { ...player, checkInId: checkIn.id } : null
    })
    .filter((p): p is Player & { checkInId: string } => p !== null && !assignedPlayers.has(p.id))

  if (!benchPlayers.length) {
    return { filledCourts: 0, benched: 0 }
  }

  const courts = [...state.courts].sort((a, b) => a.idx - b.idx)
  
  // Only exclude courts that are occupied in THIS round
  const occupied = new Set(
    existingMatchesInRound
      .map((match) => courts.find((court) => court.id === match.courtId)?.idx)
      .filter((idx): idx is number => typeof idx === 'number')
  )

  const availableCourtIdxs = courts
    .map((court) => court.idx)
    .filter((idx) => !occupied.has(idx))

  if (!availableCourtIdxs.length) {
    return { filledCourts: 0, benched: benchPlayers.length }
  }

  // Sort players by level (ascending - lower Rangliste = better player)
  benchPlayers.sort((a, b) => (a.level ?? 0) - (b.level ?? 0))

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
  const scoreMatchup = (player1: Player, player2: Player, isTeam: boolean): number => {
    const levelDiff = Math.abs((player1.level ?? 0) - (player2.level ?? 0))
    const isRepeat = havePlayedTogether(player1.id, player2.id)
    // If it's a repeat matchup, add a penalty (higher score = worse)
    // For teammates (2v2), we want to avoid repeat partners more
    // For opponents (1v1), we want to avoid repeat opponents more
    const repeatPenalty = isRepeat ? (isTeam ? 1000 : 500) : 0
    return levelDiff + repeatPenalty
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
  const createDoublesMatch = (players: Player[]): { courtIdx: number; playerIds: string[] } | null => {
    if (players.length !== 4) return null
    let bestSplit: [number, number] = [0, 0]
    let bestScore = Infinity
    
    // Try all combinations of splitting 4 players into 2 teams
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 4; j++) {
        const team1: [number, number] = [i, j]
        const team2: [number, number] = [0, 1, 2, 3].filter((idx) => idx !== i && idx !== j) as [number, number]
        const score = scoreTeamSplit(players, team1, team2)
        if (score < bestScore) {
          bestScore = score
          bestSplit = [i, j]
        }
      }
    }
    
    const [i, j] = bestSplit
    const team1 = [players[i].id, players[j].id]
    const team2 = players.filter((_, idx) => idx !== i && idx !== j).map((p) => p.id)
    
    return {
      courtIdx: availableCourtIdxs[courtIdxIndex++],
      playerIds: [...team1, ...team2]
    }
  }

  // Helper function to create balanced 1v1 match with variety preference
  const createSinglesMatch = (players: Player[]): { courtIdx: number; playerIds: string[] } | null => {
    if (players.length < 2) return null
    
    const player1 = players[0]
    let bestMatchIndex = 1
    let bestScore = scoreMatchup(player1, players[1], false)
    
    for (let i = 2; i < players.length; i++) {
      const score = scoreMatchup(player1, players[i], false)
      if (score < bestScore) {
        bestScore = score
        bestMatchIndex = i
      }
    }
    
    return {
      courtIdx: availableCourtIdxs[courtIdxIndex++],
      playerIds: [player1.id, players[bestMatchIndex].id]
    }
  }

  // Main strategy: Assign ALL players to courts, prioritizing balanced matches
  while (remainingPlayers.length > 0 && courtIdxIndex < availableCourtIdxs.length) {
    remainingPlayers.sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
    
    // Separate players by category
    const doublesOnly = remainingPlayers.filter((p) => p.primaryCategory === 'Double')
    const singlesEligible = remainingPlayers.filter((p) => p.primaryCategory !== 'Double')
    
    // PRIORITY 1: If we have Double players, create 2v2 matches to accommodate them
    // Use Singles players in doubles if needed to get Double players assigned
    if (doublesOnly.length > 0 && remainingPlayers.length >= 4) {
      // Take 4 players (prioritize Double players, fill with Singles if needed)
      const players: Player[] = []
      
      // Add Double players first
      for (const p of doublesOnly) {
        if (players.length < 4 && !usedPlayerIds.has(p.id)) {
          players.push(p)
          usedPlayerIds.add(p.id)
        }
      }
      
      // Fill remaining slots with Singles-eligible players
      for (const p of singlesEligible) {
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
    if (remainingPlayers.length >= 4) {
      const players = remainingPlayers.splice(0, 4)
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

  updateState((mutable: DatabaseState) => {
    const courtsByIdx = new Map(mutable.courts.map((court) => [court.idx, court]))
    assignments.forEach(({ courtIdx, playerIds }: { courtIdx: number; playerIds: string[] }) => {
      const court = courtsByIdx.get(courtIdx)
      if (!court) return
      const matchId = createId()
      mutable.matches.push({
        id: matchId,
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
        mutable.matchPlayers.push({
          id: createId(),
          matchId,
          playerId: playerIds[0],
          slot: 1
        })
        mutable.matchPlayers.push({
          id: createId(),
          matchId,
          playerId: playerIds[1],
          slot: 2
        })
      } else {
        // 2v2 match: use slots 0, 1, 2, 3
        playerIds.forEach((playerId: string, slot: number) => {
        mutable.matchPlayers.push({
          id: createId(),
          matchId,
          playerId,
          slot
        })
      })
      }
    })
  })

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
  updateState((state: DatabaseState) => {
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
        state.matchPlayers = state.matchPlayers.filter((mp) => mp.id !== currentMatchPlayer.id)
        const remaining = state.matchPlayers.filter((mp) => mp.matchId === currentMatchPlayer.matchId)
        if (remaining.length === 0) {
          state.matches = state.matches.filter((match) => match.id !== currentMatchPlayer.matchId)
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
      targetMatch = {
        id: createId(),
        sessionId: session.id,
        courtId: court.id,
        startedAt: new Date().toISOString(),
        endedAt: null,
        round: effectiveRound
      }
      state.matches.push(targetMatch)
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
        if (sourceMatch.id === targetMatch!.id) {
          // Find the actual objects in state.matchPlayers array
          const sourcePlayerIndex = state.matchPlayers.findIndex((mp) => mp.id === sourceMatchPlayer.id)
          const occupyingPlayerIndex = state.matchPlayers.findIndex((mp) => mp.id === occupyingPlayerEntry.id)
          
          if (sourcePlayerIndex === -1 || occupyingPlayerIndex === -1) {
            throw new Error('Kunne ikke finde spillerindgange til at bytte')
          }
          
          // Swap the slots
          const tempSlot = state.matchPlayers[sourcePlayerIndex].slot
          state.matchPlayers[sourcePlayerIndex].slot = state.matchPlayers[occupyingPlayerIndex].slot
          state.matchPlayers[occupyingPlayerIndex].slot = tempSlot
          // Both players are now in the correct slots - done!
          return
        } else {
          // Move occupying player to source match and slot
          // Find the actual object in state.matchPlayers array
          const occupyingPlayerIndex = state.matchPlayers.findIndex((mp) => mp.id === occupyingPlayerEntry.id)
          if (occupyingPlayerIndex === -1) {
            throw new Error('Kunne ikke finde spillerindgang til at flytte')
          }
          
          // Update occupying player to move to source location
          state.matchPlayers[occupyingPlayerIndex].matchId = sourceMatch.id
          state.matchPlayers[occupyingPlayerIndex].slot = sourceMatchPlayer.slot
          
          // Remove current player from source match
          const sourcePlayerIndex = state.matchPlayers.findIndex((mp) => mp.id === sourceMatchPlayer.id)
          if (sourcePlayerIndex !== -1) {
            state.matchPlayers.splice(sourcePlayerIndex, 1)
          }
          const remaining = state.matchPlayers.filter((mp) => mp.matchId === sourceMatch.id)
          if (remaining.length === 0) {
            state.matches = state.matches.filter((match) => match.id !== sourceMatch.id)
          }
          // After swap, slot is now free - place dragged player in target slot
          state.matchPlayers.push({
            id: createId(),
            matchId: targetMatch!.id,
            playerId: parsed.playerId,
            slot: parsed.toSlot!
          })
          return
        }
      } else {
        // Source is bench/inactive - move occupying player to bench
        state.matchPlayers = state.matchPlayers.filter((mp) => mp.id !== occupyingPlayerEntry.id)
        const remaining = state.matchPlayers.filter((mp) => mp.matchId === targetMatch!.id)
        if (remaining.length === 0) {
          state.matches = state.matches.filter((match) => match.id !== targetMatch!.id)
        }
        // Remove current player from their match if they're in one
        if (currentMatch && currentMatchPlayer) {
          state.matchPlayers = state.matchPlayers.filter((mp) => mp.id !== currentMatchPlayer.id)
          const remainingInSource = state.matchPlayers.filter((mp) => mp.matchId === currentMatch.id)
          if (remainingInSource.length === 0) {
            state.matches = state.matches.filter((match) => match.id !== currentMatch.id)
          }
        }
        // Now place dragged player in the now-free slot
        state.matchPlayers.push({
          id: createId(),
          matchId: targetMatch!.id,
          playerId: parsed.playerId,
          slot: parsed.toSlot!
        })
        return
      }
      // Swap complete - all cases handled above, should not reach here
      return
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
      state.matchPlayers = state.matchPlayers.filter((mp) => mp.id !== currentMatchPlayer.id)
      const remaining = state.matchPlayers.filter((mp) => mp.matchId === currentMatch.id)
      if (remaining.length === 0) {
        state.matches = state.matches.filter((match) => match.id !== currentMatch.id)
      }
    }

    if (slotTaken && slotTaken.playerId === parsed.playerId) {
      return
    }

    if (currentMatch && currentMatch.id === targetMatch.id && currentMatchPlayer) {
      currentMatchPlayer.slot = parsed.toSlot!
      return
    }

    state.matchPlayers.push({
      id: createId(),
      matchId: targetMatch.id,
      playerId: parsed.playerId,
      slot: parsed.toSlot!
    })
  })
}

/** Matches API — manages court assignments and player matching. */
const matchesApi = {
  autoArrange: (round?: number) => autoArrangeMatches(round),
  list: (round?: number) => listMatches(round),
  reset: resetMatches,
  move: movePlayer
}

/** Main API client — exports all API modules. */
const api = {
  players: playersApi,
  session: sessionApi,
  checkIns: checkInsApi,
  matches: matchesApi
}

/** Database backup/restore functions. */
const database = {
  createBackup,
  restoreFromBackup,
  hasBackup
}

api.database = database

export default api
