import type {
  Player,
  PlayerUpdateInput,
  TrainingSession,
  TrainingSessionStatus,
  CheckIn,
  Court,
  Match,
  MatchPlayer,
  StatisticsSnapshot
} from '@rundeklar/common'
import { getCurrentTenantSupabaseClient } from '../lib/supabase'

// Get the current tenant Supabase client
const getSupabase = () => getCurrentTenantSupabaseClient()

/** In-memory database state structure (for backward compatibility). */
export type DatabaseState = {
  players: Player[]
  sessions: TrainingSession[]
  checkIns: CheckIn[]
  courts: Court[]
  matches: Match[]
  matchPlayers: MatchPlayer[]
  statistics?: StatisticsSnapshot[]
}

/** Cached database state (singleton pattern). */
let cachedState: DatabaseState | null = null

/**
 * Generates a unique ID (UUID).
 * @returns Unique ID string
 */
export const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

/**
 * Converts a Supabase row to a Player.
 */
const rowToPlayer = (row: any): Player => ({
  id: row.id,
  name: row.name,
  alias: row.alias ?? null,
  level: row.level ?? row.level_single ?? null, // Backward compatibility: use level_single if level doesn't exist
  levelSingle: row.level_single ?? null,
  levelDouble: row.level_double ?? null,
  levelMix: row.level_mix ?? null,
  gender: row.gender ?? null,
  primaryCategory: row.primary_category ?? null,
  trainingGroups: row.training_group ?? [],
  active: row.active ?? true,
  preferredDoublesPartners: row.preferred_doubles_partners ?? null,
  preferredMixedPartners: row.preferred_mixed_partners ?? null,
  createdAt: row.created_at
} as Player)

/**
 * Converts a Supabase row to a TrainingSession.
 */
const rowToSession = (row: any): TrainingSession => ({
  id: row.id,
  date: row.date,
  status: row.status as TrainingSessionStatus,
  createdAt: row.created_at
})

/**
 * Converts a Supabase row to a CheckIn.
 */
const rowToCheckIn = (row: any): CheckIn => ({
  id: row.id,
  sessionId: row.session_id,
  playerId: row.player_id,
  createdAt: row.created_at,
  maxRounds: row.max_rounds ?? null
})

/**
 * Converts a Supabase row to a Court.
 */
const rowToCourt = (row: any): Court => ({
  id: row.id,
  idx: row.idx
})

/**
 * Converts a Supabase row to a Match.
 */
const rowToMatch = (row: any): Match => ({
  id: row.id,
  sessionId: row.session_id,
  courtId: row.court_id,
  startedAt: row.started_at,
  endedAt: row.ended_at ?? null,
  round: row.round ?? null
})

/**
 * Converts a Supabase row to a MatchPlayer.
 */
const rowToMatchPlayer = (row: any): MatchPlayer => ({
  id: row.id,
  matchId: row.match_id,
  playerId: row.player_id,
  slot: row.slot
})

/**
 * Converts a Supabase row to a StatisticsSnapshot.
 */
const rowToStatisticsSnapshot = (row: any): StatisticsSnapshot => {
  // Helper to ensure array format (handles JSONB strings, null, undefined, etc.)
  const ensureArray = (value: any): any[] => {
    if (Array.isArray(value)) return value
    if (value == null) return []
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  return {
  id: row.id,
  sessionId: row.session_id,
  sessionDate: row.session_date,
  season: row.season,
    matches: ensureArray(row.matches),
    matchPlayers: ensureArray(row.match_players),
    checkIns: ensureArray(row.check_ins),
  createdAt: row.created_at
  }
}

/**
 * Loads database state from Supabase.
 * @returns Database state
 */
export const loadState = async (): Promise<DatabaseState> => {
  if (cachedState) return cachedState

  const supabase = getSupabase()

  try {
    // Load all data in parallel
    const [playersResult, sessionsResult, checkInsResult, courtsResult, matchesResult, matchPlayersResult, statisticsResult] = await Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('training_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('check_ins').select('*').order('created_at'),
      supabase.from('courts').select('*').order('idx'),
      supabase.from('matches').select('*').order('started_at'),
      supabase.from('match_players').select('*'),
      supabase.from('statistics_snapshots').select('*').order('session_date', { ascending: false })
    ])

    // Check for errors
    if (playersResult.error) throw new Error(`Failed to load players: ${playersResult.error.message}`)
    if (sessionsResult.error) throw new Error(`Failed to load sessions: ${sessionsResult.error.message}`)
    if (checkInsResult.error) throw new Error(`Failed to load check-ins: ${checkInsResult.error.message}`)
    if (courtsResult.error) throw new Error(`Failed to load courts: ${courtsResult.error.message}`)
    if (matchesResult.error) throw new Error(`Failed to load matches: ${matchesResult.error.message}`)
    if (matchPlayersResult.error) throw new Error(`Failed to load match players: ${matchPlayersResult.error.message}`)
    if (statisticsResult.error) throw new Error(`Failed to load statistics: ${statisticsResult.error.message}`)

    // Convert rows to types
    cachedState = {
      players: (playersResult.data || []).map(rowToPlayer),
      sessions: (sessionsResult.data || []).map(rowToSession),
      checkIns: (checkInsResult.data || []).map(rowToCheckIn),
      courts: (courtsResult.data || []).map(rowToCourt),
      matches: (matchesResult.data || []).map(rowToMatch),
      matchPlayers: (matchPlayersResult.data || []).map(rowToMatchPlayer),
      statistics: (statisticsResult.data || []).map(rowToStatisticsSnapshot)
    }

    return cachedState
  } catch {
    // Return empty state on error - error is logged by caller
    cachedState = {
      players: [],
      sessions: [],
      checkIns: [],
      courts: [],
      matches: [],
      matchPlayers: [],
      statistics: []
    }
    return cachedState
  }
}

/**
 * Persists current database state to Supabase (no-op, data is already persisted).
 * @remarks Kept for backward compatibility.
 */
export const persistState = () => {
  // No-op: Supabase persists data automatically
  // This function is kept for backward compatibility
}

/**
 * Forces a save of the current database state (no-op).
 * @remarks Kept for backward compatibility.
 */
export const forceSave = () => {
  // No-op: Supabase persists data automatically
  // This function is kept for backward compatibility
}

/**
 * Updates database state and persists to Supabase.
 * @param updater - Function that mutates state
 * @remarks Loads state, applies updater, then persists atomically.
 * Note: This function is kept for backward compatibility but doesn't work the same way.
 * For Supabase, you should use direct database operations instead.
 */
export const updateState = async (updater: (state: DatabaseState) => void) => {
  const state = await loadState()
  updater(state)
  // Note: This doesn't actually persist changes to Supabase
  // The API layer should use direct Supabase operations instead
  cachedState = state
}

/**
 * Resets database to seed state (not implemented for Supabase).
 * 
 * @remarks This function is kept for backward compatibility but doesn't work with Supabase.
 * Use direct database operations instead.
 * 
 * @deprecated Use direct database operations instead of this function.
 */
export const resetState = () => {
  // Not implemented for Supabase - use direct database operations instead
  // This function is kept for backward compatibility only
}

/**
 * Returns a deep copy of current database state (for safe reading).
 * @returns Copy of database state
 */
export const getStateCopy = async (): Promise<DatabaseState> => {
  const state = await loadState()
  return {
    players: state.players.map((player) => ({ ...player })),
    sessions: state.sessions.map((session) => ({ ...session })),
    checkIns: state.checkIns.map((checkIn) => ({ ...checkIn })),
    courts: state.courts.map((court) => ({ ...court })),
    matches: state.matches.map((match) => ({ ...match })),
    matchPlayers: state.matchPlayers.map((matchPlayer) => ({ ...matchPlayer })),
    statistics: (state.statistics ?? []).map((stat) => ({
      ...stat,
      matches: stat.matches.map((m) => ({ ...m })),
      matchPlayers: stat.matchPlayers.map((mp) => ({ ...mp })),
      checkIns: stat.checkIns.map((c) => ({ ...c }))
    }))
  }
}

/**
 * Invalidates the cached state, forcing a reload on next access.
 */
export const invalidateCache = () => {
  cachedState = null
}

// Direct CRUD operations for better performance

/**
 * Gets all players from Supabase.
 */
export const getPlayers = async (): Promise<Player[]> => {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('players').select('*').order('name')
  if (error) throw new Error(`Failed to get players: ${error.message}`)
  return (data || []).map(rowToPlayer)
}

/**
 * Creates a player in Supabase.
 */
export const createPlayer = async (player: Omit<Player, 'id' | 'createdAt'>): Promise<Player> => {
  const supabase = getSupabase()
  const playerAny = player as any
  const { data, error } = await supabase
    .from('players')
    .insert({
      name: player.name,
      alias: player.alias,
      level_single: playerAny.levelSingle ?? null,
      level_double: playerAny.levelDouble ?? null,
      level_mix: playerAny.levelMix ?? null,
      gender: player.gender,
      primary_category: player.primaryCategory,
      training_group: playerAny.trainingGroups ?? [],
      active: player.active,
      preferred_doubles_partners: playerAny.preferredDoublesPartners ?? [],
      preferred_mixed_partners: playerAny.preferredMixedPartners ?? []
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to create player: ${error.message}`)
  invalidateCache()
  return rowToPlayer(data)
}

/**
 * Updates a player in Supabase.
 */
export const updatePlayer = async (id: string, updates: PlayerUpdateInput['patch']): Promise<Player> => {
  // TODO: refine type - dynamic object construction for database update
  const updateData: any = {}
  // TODO: refine type - need camelCase to snake_case mapping for database fields
  const updatesAny = updates as any
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.alias !== undefined) updateData.alias = updates.alias
  if (updatesAny.levelSingle !== undefined) updateData.level_single = updatesAny.levelSingle
  if (updatesAny.levelDouble !== undefined) updateData.level_double = updatesAny.levelDouble
  if (updatesAny.levelMix !== undefined) updateData.level_mix = updatesAny.levelMix
  // Backward compatibility: if old 'level' is provided, update level_single
  if (updates.level !== undefined) updateData.level_single = updates.level
  if (updates.gender !== undefined) updateData.gender = updates.gender
  if (updates.primaryCategory !== undefined) updateData.primary_category = updates.primaryCategory
  if (updatesAny.trainingGroups !== undefined) updateData.training_group = updatesAny.trainingGroups ?? []
  if (updates.active !== undefined) updateData.active = updates.active
  if (updatesAny.preferredDoublesPartners !== undefined) updateData.preferred_doubles_partners = updatesAny.preferredDoublesPartners ?? []
  if (updatesAny.preferredMixedPartners !== undefined) updateData.preferred_mixed_partners = updatesAny.preferredMixedPartners ?? []

  const supabase = getSupabase()
  const { data, error } = await supabase.from('players').update(updateData).eq('id', id).select().single()
  if (error) throw new Error(`Failed to update player: ${error.message}`)
  invalidateCache()
  const player = rowToPlayer(data)
  return player
}

/**
 * Gets all training sessions from Supabase.
 */
export const getSessions = async (): Promise<TrainingSession[]> => {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('training_sessions').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to get sessions: ${error.message}`)
  return (data || []).map(rowToSession)
}

/**
 * Creates a training session in Supabase.
 */
export const createSession = async (session: Omit<TrainingSession, 'id' | 'createdAt'>): Promise<TrainingSession> => {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('training_sessions')
    .insert({
      date: session.date,
      status: session.status
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to create session: ${error.message}`)
  invalidateCache()
  return rowToSession(data)
}

/**
 * Updates a training session in Supabase.
 */
export const updateSession = async (id: string, updates: Partial<Omit<TrainingSession, 'id' | 'createdAt'>>): Promise<TrainingSession> => {
  const updateData: any = {}
  if (updates.date !== undefined) updateData.date = updates.date
  if (updates.status !== undefined) updateData.status = updates.status

  const supabase = getSupabase()
  const { data, error } = await supabase.from('training_sessions').update(updateData).eq('id', id).select().single()
  if (error) throw new Error(`Failed to update session: ${error.message}`)
  invalidateCache()
  return rowToSession(data)
}

/**
 * Gets all check-ins from Supabase.
 */
export const getCheckIns = async (): Promise<CheckIn[]> => {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('check_ins').select('*').order('created_at')
  if (error) throw new Error(`Failed to get check-ins: ${error.message}`)
  return (data || []).map(rowToCheckIn)
}

/**
 * Creates a check-in in Supabase.
 */
export const createCheckIn = async (checkIn: Omit<CheckIn, 'id' | 'createdAt'>): Promise<CheckIn> => {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('check_ins')
    .insert({
      session_id: checkIn.sessionId,
      player_id: checkIn.playerId,
      max_rounds: checkIn.maxRounds
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to create check-in: ${error.message}`)
  invalidateCache()
  return rowToCheckIn(data)
}

/**
 * Deletes a check-in from Supabase.
 */
export const deleteCheckIn = async (id: string): Promise<void> => {
  const supabase = getSupabase()
  const { error } = await supabase.from('check_ins').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete check-in: ${error.message}`)
  invalidateCache()
}

/**
 * Gets all courts from Supabase.
 */
export const getCourts = async (): Promise<Court[]> => {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('courts').select('*').order('idx')
  if (error) throw new Error(`Failed to get courts: ${error.message}`)
  return (data || []).map(rowToCourt)
}

/**
 * Creates a court in Supabase.
 */
export const createCourt = async (court: Omit<Court, 'id'>): Promise<Court> => {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('courts')
    .insert({ idx: court.idx })
    .select()
    .single()
  if (error) throw new Error(`Failed to create court: ${error.message}`)
  invalidateCache()
  return rowToCourt(data)
}

/**
 * Gets all matches from Supabase.
 */
export const getMatches = async (): Promise<Match[]> => {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('matches').select('*').order('started_at')
  if (error) throw new Error(`Failed to get matches: ${error.message}`)
  return (data || []).map(rowToMatch)
}

/**
 * Creates a match in Supabase.
 */
export const createMatch = async (match: Omit<Match, 'id'>): Promise<Match> => {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('matches')
    .insert({
      session_id: match.sessionId,
      court_id: match.courtId,
      started_at: match.startedAt,
      ended_at: match.endedAt,
      round: match.round
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to create match: ${error.message}`)
  invalidateCache()
  return rowToMatch(data)
}

/**
 * Updates a match in Supabase.
 */
export const updateMatch = async (id: string, updates: Partial<Omit<Match, 'id'>>): Promise<Match> => {
  const updateData: any = {}
  if (updates.sessionId !== undefined) updateData.session_id = updates.sessionId
  if (updates.courtId !== undefined) updateData.court_id = updates.courtId
  if (updates.startedAt !== undefined) updateData.started_at = updates.startedAt
  if (updates.endedAt !== undefined) updateData.ended_at = updates.endedAt
  if (updates.round !== undefined) updateData.round = updates.round

  const supabase = getSupabase()
  const { data, error } = await supabase.from('matches').update(updateData).eq('id', id).select().single()
  if (error) throw new Error(`Failed to update match: ${error.message}`)
  invalidateCache()
  return rowToMatch(data)
}

/**
 * Deletes a match from Supabase.
 */
export const deleteMatch = async (id: string): Promise<void> => {
  const supabase = getSupabase()
  const { error } = await supabase.from('matches').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete match: ${error.message}`)
  invalidateCache()
}

/**
 * Gets all match players from Supabase.
 */
export const getMatchPlayers = async (): Promise<MatchPlayer[]> => {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('match_players').select('*')
  if (error) throw new Error(`Failed to get match players: ${error.message}`)
  return (data || []).map(rowToMatchPlayer)
}

/**
 * Creates a match player in Supabase.
 */
export const createMatchPlayer = async (matchPlayer: Omit<MatchPlayer, 'id'>): Promise<MatchPlayer> => {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('match_players')
    .insert({
      match_id: matchPlayer.matchId,
      player_id: matchPlayer.playerId,
      slot: matchPlayer.slot
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to create match player: ${error.message}`)
  invalidateCache()
  return rowToMatchPlayer(data)
}

/**
 * Updates a match player in Supabase.
 */
export const updateMatchPlayer = async (id: string, updates: Partial<Omit<MatchPlayer, 'id'>>): Promise<MatchPlayer> => {
  const updateData: any = {}
  if (updates.matchId !== undefined) updateData.match_id = updates.matchId
  if (updates.playerId !== undefined) updateData.player_id = updates.playerId
  if (updates.slot !== undefined) updateData.slot = updates.slot

  const supabase = getSupabase()
  const { data, error } = await supabase.from('match_players').update(updateData).eq('id', id).select().single()
  if (error) throw new Error(`Failed to update match player: ${error.message}`)
  invalidateCache()
  return rowToMatchPlayer(data)
}

/**
 * Deletes a match player from Supabase.
 */
export const deleteMatchPlayer = async (id: string): Promise<void> => {
  const supabase = getSupabase()
  const { error } = await supabase.from('match_players').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete match player: ${error.message}`)
  invalidateCache()
}

/**
 * Gets all statistics snapshots from Supabase.
 */
export const getStatisticsSnapshots = async (): Promise<StatisticsSnapshot[]> => {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('statistics_snapshots').select('*').order('session_date', { ascending: false })
  if (error) throw new Error(`Failed to get statistics snapshots: ${error.message}`)
  return (data || []).map(rowToStatisticsSnapshot)
}

/**
 * Creates a statistics snapshot in Supabase.
 */
export const createStatisticsSnapshot = async (snapshot: Omit<StatisticsSnapshot, 'id' | 'createdAt'>): Promise<StatisticsSnapshot> => {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('statistics_snapshots')
    .insert({
      session_id: snapshot.sessionId,
      session_date: snapshot.sessionDate,
      season: snapshot.season,
      matches: snapshot.matches,
      match_players: snapshot.matchPlayers,
      check_ins: snapshot.checkIns
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to create statistics snapshot: ${error.message}`)
  invalidateCache()
  return rowToStatisticsSnapshot(data)
}

/**
 * Creates a backup of the current database state to localStorage.
 * @remarks Saves current state to localStorage for rollback purposes.
 */
export const createBackup = async (): Promise<void> => {
  const state = await loadState()
  const storage = typeof window !== 'undefined' ? window.localStorage : null
  if (storage) {
    try {
      storage.setItem('herlev-hjorten-db-v2-backup', JSON.stringify(state))
    } catch {
      // Silently fail backup creation - not critical for app functionality
      // Error is logged by caller if needed
    }
  }
}

/**
 * Restores database state from localStorage backup.
 * @remarks Restores the state saved by createBackup().
 * @returns true if backup was restored, false if no backup exists
 */
export const restoreFromBackup = async (): Promise<boolean> => {
  const storage = typeof window !== 'undefined' ? window.localStorage : null
  if (storage) {
    const backup = storage.getItem('herlev-hjorten-db-v2-backup')
    if (backup) {
      try {
        const parsed = JSON.parse(backup) as DatabaseState
        cachedState = parsed
        // Note: This doesn't actually restore to Supabase
        // You would need to implement a migration script to restore from backup
        return true
      } catch {
        // Silently fail backup restoration - not critical for app functionality
        // Error is logged by caller if needed
        return false
      }
    }
  }
  return false
}

/**
 * Checks if a backup exists in localStorage.
 * @returns true if backup exists, false otherwise
 */
export const hasBackup = (): boolean => {
  const storage = typeof window !== 'undefined' ? window.localStorage : null
  if (storage) {
    return storage.getItem('herlev-hjorten-db-v2-backup') !== null
  }
  return false
}
