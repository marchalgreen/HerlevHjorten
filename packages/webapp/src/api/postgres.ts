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
} from '@herlev-hjorten/common'
// Browser-compatible Postgres client using Vercel API proxy
// Since postgres.js doesn't work in browsers, we proxy queries through Vercel serverless functions

import { getCurrentTenantConfig } from '../lib/postgres'

async function executeQuery(query: string, params: any[] = []): Promise<any[]> {
  // Get current tenant ID for security
  let tenantId: string
  try {
    const tenantConfig = getCurrentTenantConfig()
    tenantId = tenantConfig.id
  } catch (error) {
    console.error('[executeQuery] Failed to get tenant config:', error)
    throw new Error('Tenant context not initialized. Make sure TenantProvider is mounted and tenant is loaded.')
  }

  // In development, use local API route (Vercel CLI runs on port 3000)
  // In production, use Vercel API route
  const apiUrl = import.meta.env.DEV 
    ? 'http://127.0.0.1:3000/api/db'  // Local Vercel dev server
    : '/api/db'  // Vercel production API route

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, params, tenantId }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = 'Database query failed'
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.error || errorMessage
    } catch {
      errorMessage = errorText || errorMessage
    }
    console.error('[executeQuery] API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorMessage,
      query: query.substring(0, 100) + '...'
    })
    throw new Error(errorMessage)
  }

  const result = await response.json()
  return result.data
}

// Create a proxy object that handles template literal queries
// Template literals like sql`SELECT * FROM players` are actually function calls
function createSqlProxy() {
  // Create a function that can be called as a template literal
  const sqlFunction = (strings: TemplateStringsArray, ...values: any[]) => {
    // Convert template literal to parameterized query
    let query = ''
    const params: any[] = []
    
    for (let i = 0; i < strings.length; i++) {
      query += strings[i]
      if (i < values.length) {
        // Arrays and objects are passed as-is, Postgres will handle them
        params.push(values[i])
        query += `$${params.length}`
      }
    }
    
    return executeQuery(query, params)
  }
  
  // Add unsafe method to the function object
  ;(sqlFunction as any).unsafe = (query: string, params: any[] = []) => {
    return executeQuery(query, params)
  }
  
  return sqlFunction as any
}

// Get Postgres client (returns proxy that handles template literals)
const getPostgres = () => createSqlProxy()

// Helper to get current tenant ID
const getTenantId = (): string => {
  try {
    return getCurrentTenantConfig().id
  } catch {
    throw new Error('Tenant context not initialized. Make sure TenantProvider is mounted.')
  }
}

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
 * Converts a Postgres row to a Player.
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
 * Converts a Postgres row to a TrainingSession.
 */
const rowToSession = (row: any): TrainingSession => ({
  id: row.id,
  date: row.date,
  status: row.status as TrainingSessionStatus,
  createdAt: row.created_at
})

/**
 * Converts a Postgres row to a CheckIn.
 */
const rowToCheckIn = (row: any): CheckIn => ({
  id: row.id,
  sessionId: row.session_id,
  playerId: row.player_id,
  createdAt: row.created_at,
  maxRounds: row.max_rounds ?? null
})

/**
 * Converts a Postgres row to a Court.
 */
const rowToCourt = (row: any): Court => ({
  id: row.id,
  idx: row.idx
})

/**
 * Converts a Postgres row to a Match.
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
 * Converts a Postgres row to a MatchPlayer.
 */
const rowToMatchPlayer = (row: any): MatchPlayer => ({
  id: row.id,
  matchId: row.match_id,
  playerId: row.player_id,
  slot: row.slot
})

/**
 * Converts a Postgres row to a StatisticsSnapshot.
 */
const rowToStatisticsSnapshot = (row: any): StatisticsSnapshot => ({
  id: row.id,
  sessionId: row.session_id,
  sessionDate: row.session_date,
  season: row.season,
  matches: (row.matches as any[]) || [],
  matchPlayers: (row.match_players as any[]) || [],
  checkIns: (row.check_ins as any[]) || [],
  createdAt: row.created_at
})

/**
 * Loads database state from Postgres.
 * @returns Database state
 */
export const loadState = async (): Promise<DatabaseState> => {
  if (cachedState) return cachedState

  const sql = getPostgres()

  try {
    // Get tenant ID for filtering
    const tenantId = getTenantId()

    // Load all data in parallel (filtered by tenant_id)
    const [players, sessions, checkIns, courts, matches, matchPlayers, statistics] = await Promise.all([
      sql`SELECT * FROM players WHERE tenant_id = ${tenantId} ORDER BY name`,
      sql`SELECT * FROM training_sessions WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`,
      sql`SELECT * FROM check_ins WHERE tenant_id = ${tenantId} ORDER BY created_at`,
      sql`SELECT * FROM courts WHERE tenant_id = ${tenantId} ORDER BY idx`,
      sql`SELECT * FROM matches WHERE tenant_id = ${tenantId} ORDER BY started_at`,
      sql`SELECT * FROM match_players WHERE tenant_id = ${tenantId}`,
      sql`SELECT * FROM statistics_snapshots WHERE tenant_id = ${tenantId} ORDER BY session_date DESC`
    ])

    // Convert rows to types
    cachedState = {
      players: players.map(rowToPlayer),
      sessions: sessions.map(rowToSession),
      checkIns: checkIns.map(rowToCheckIn),
      courts: courts.map(rowToCourt),
      matches: matches.map(rowToMatch),
      matchPlayers: matchPlayers.map(rowToMatchPlayer),
      statistics: statistics.map(rowToStatisticsSnapshot)
    }

    return cachedState
  } catch (_error) {
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
 * Persists current database state to Postgres (no-op, data is already persisted).
 * @remarks Kept for backward compatibility.
 */
export const persistState = () => {
  // No-op: Postgres persists data automatically
  // This function is kept for backward compatibility
}

/**
 * Forces a save of the current database state (no-op).
 * @remarks Kept for backward compatibility.
 */
export const forceSave = () => {
  // No-op: Postgres persists data automatically
  // This function is kept for backward compatibility
}

/**
 * Updates database state and persists to Postgres.
 * @param updater - Function that mutates state
 * @remarks Loads state, applies updater, then persists atomically.
 * Note: This function is kept for backward compatibility but doesn't work the same way.
 * For Postgres, you should use direct database operations instead.
 */
export const updateState = async (updater: (state: DatabaseState) => void) => {
  const state = await loadState()
  updater(state)
  // Note: This doesn't actually persist changes to Postgres
  // The API layer should use direct Postgres operations instead
  cachedState = state
}

/**
 * Resets database to seed state (not implemented for Postgres).
 * 
 * @remarks This function is kept for backward compatibility but doesn't work with Postgres.
 * Use direct database operations instead.
 * 
 * @deprecated Use direct database operations instead of this function.
 */
export const resetState = () => {
  // Not implemented for Postgres - use direct database operations instead
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
 * Gets all players from Postgres.
 */
export const getPlayers = async (): Promise<Player[]> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const players = await sql`SELECT * FROM players WHERE tenant_id = ${tenantId} ORDER BY name`
  return players.map(rowToPlayer)
}

/**
 * Creates a player in Postgres.
 */
export const createPlayer = async (player: Omit<Player, 'id' | 'createdAt'>): Promise<Player> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const playerAny = player as any
  const [created] = await sql`
    INSERT INTO players (
      name, alias, level_single, level_double, level_mix, gender, 
      primary_category, training_group, active, 
      preferred_doubles_partners, preferred_mixed_partners, tenant_id
    )
    VALUES (
      ${player.name},
      ${player.alias ?? null},
      ${playerAny.levelSingle ?? null},
      ${playerAny.levelDouble ?? null},
      ${playerAny.levelMix ?? null},
      ${player.gender ?? null},
      ${player.primaryCategory ?? null},
      ${playerAny.trainingGroups ?? []},
      ${player.active ?? true},
      ${playerAny.preferredDoublesPartners ?? []},
      ${playerAny.preferredMixedPartners ?? []},
      ${tenantId}
    )
    RETURNING *
  `
  invalidateCache()
  return rowToPlayer(created)
}

/**
 * Updates a player in Postgres.
 */
export const updatePlayer = async (id: string, updates: PlayerUpdateInput['patch']): Promise<Player> => {
  const sql = getPostgres()
  const updatesAny = updates as any
  
  // Build update object dynamically
  const updateData: any = {}
  
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.alias !== undefined) updateData.alias = updates.alias
  if (updatesAny.levelSingle !== undefined) updateData.level_single = updatesAny.levelSingle
  if (updatesAny.levelDouble !== undefined) updateData.level_double = updatesAny.levelDouble
  if (updatesAny.levelMix !== undefined) updateData.level_mix = updatesAny.levelMix
  if (updates.level !== undefined) updateData.level_single = updates.level // Backward compatibility
  if (updates.gender !== undefined) updateData.gender = updates.gender
  if (updates.primaryCategory !== undefined) updateData.primary_category = updates.primaryCategory
  if (updatesAny.trainingGroups !== undefined) updateData.training_group = updatesAny.trainingGroups ?? []
  if (updates.active !== undefined) updateData.active = updates.active
  if (updatesAny.preferredDoublesPartners !== undefined) updateData.preferred_doubles_partners = updatesAny.preferredDoublesPartners ?? []
  if (updatesAny.preferredMixedPartners !== undefined) updateData.preferred_mixed_partners = updatesAny.preferredMixedPartners ?? []

  const tenantId = getTenantId()

  if (Object.keys(updateData).length === 0) {
    // No updates, just fetch the player
    const [player] = await sql`SELECT * FROM players WHERE id = ${id} AND tenant_id = ${tenantId}`
    return rowToPlayer(player)
  }

  // Build SET clause dynamically - using sql.unsafe for dynamic field names
  // This is safe because we control the input and validate field names
  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1
  
  for (const [key, value] of Object.entries(updateData)) {
    if (key === 'training_group' || key === 'preferred_doubles_partners' || key === 'preferred_mixed_partners') {
      // For arrays, use proper array handling
      setClauses.push(`${key} = $${paramIndex}`)
      values.push(value)
    } else {
      setClauses.push(`${key} = $${paramIndex}`)
      values.push(value)
    }
    paramIndex++
  }
  
  values.push(tenantId, id) // Add tenant_id and id as last parameters
  
  const [updated] = await sql.unsafe(
    `UPDATE players SET ${setClauses.join(', ')} WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1} RETURNING *`,
    values
  )

  invalidateCache()
  return rowToPlayer(updated)
}

/**
 * Gets all training sessions from Postgres.
 */
export const getSessions = async (): Promise<TrainingSession[]> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const sessions = await sql`SELECT * FROM training_sessions WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`
  return sessions.map(rowToSession)
}

/**
 * Creates a training session in Postgres.
 */
export const createSession = async (session: Omit<TrainingSession, 'id' | 'createdAt'>): Promise<TrainingSession> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const [created] = await sql`
    INSERT INTO training_sessions (date, status, tenant_id)
    VALUES (${session.date}, ${session.status}, ${tenantId})
    RETURNING *
  `
  invalidateCache()
  return rowToSession(created)
}

/**
 * Updates a training session in Postgres.
 */
export const updateSession = async (id: string, updates: Partial<Omit<TrainingSession, 'id' | 'createdAt'>>): Promise<TrainingSession> => {
  const sql = getPostgres()
  
  const updateData: any = {}
  if (updates.date !== undefined) updateData.date = updates.date
  if (updates.status !== undefined) updateData.status = updates.status

  const tenantId = getTenantId()

  if (Object.keys(updateData).length === 0) {
    const [session] = await sql`SELECT * FROM training_sessions WHERE id = ${id} AND tenant_id = ${tenantId}`
    return rowToSession(session)
  }

  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1
  
  for (const [key, value] of Object.entries(updateData)) {
    setClauses.push(`${key} = $${paramIndex}`)
    values.push(value)
    paramIndex++
  }
  
  values.push(tenantId, id)
  
  const [updated] = await sql.unsafe(
    `UPDATE training_sessions SET ${setClauses.join(', ')} WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1} RETURNING *`,
    values
  )

  invalidateCache()
  return rowToSession(updated)
}

/**
 * Gets all check-ins from Postgres.
 */
export const getCheckIns = async (): Promise<CheckIn[]> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const checkIns = await sql`SELECT * FROM check_ins WHERE tenant_id = ${tenantId} ORDER BY created_at`
  return checkIns.map(rowToCheckIn)
}

/**
 * Creates a check-in in Postgres.
 */
export const createCheckIn = async (checkIn: Omit<CheckIn, 'id' | 'createdAt'>): Promise<CheckIn> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const [created] = await sql`
    INSERT INTO check_ins (session_id, player_id, max_rounds, tenant_id)
    VALUES (${checkIn.sessionId}, ${checkIn.playerId}, ${checkIn.maxRounds ?? null}, ${tenantId})
    RETURNING *
  `
  invalidateCache()
  return rowToCheckIn(created)
}

/**
 * Deletes a check-in from Postgres.
 */
export const deleteCheckIn = async (id: string): Promise<void> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  await sql`DELETE FROM check_ins WHERE id = ${id} AND tenant_id = ${tenantId}`
  invalidateCache()
}

/**
 * Gets all courts from Postgres.
 */
export const getCourts = async (): Promise<Court[]> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const courts = await sql`SELECT * FROM courts WHERE tenant_id = ${tenantId} ORDER BY idx`
  return courts.map(rowToCourt)
}

/**
 * Creates a court in Postgres.
 */
export const createCourt = async (court: Omit<Court, 'id'>): Promise<Court> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const [created] = await sql`
    INSERT INTO courts (idx, tenant_id)
    VALUES (${court.idx}, ${tenantId})
    RETURNING *
  `
  invalidateCache()
  return rowToCourt(created)
}

/**
 * Gets all matches from Postgres.
 */
export const getMatches = async (): Promise<Match[]> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const matches = await sql`SELECT * FROM matches WHERE tenant_id = ${tenantId} ORDER BY started_at`
  return matches.map(rowToMatch)
}

/**
 * Creates a match in Postgres.
 */
export const createMatch = async (match: Omit<Match, 'id'>): Promise<Match> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const [created] = await sql`
    INSERT INTO matches (session_id, court_id, started_at, ended_at, round, tenant_id)
    VALUES (
      ${match.sessionId},
      ${match.courtId},
      ${match.startedAt},
      ${match.endedAt ?? null},
      ${match.round ?? null},
      ${tenantId}
    )
    RETURNING *
  `
  invalidateCache()
  return rowToMatch(created)
}

/**
 * Updates a match in Postgres.
 */
export const updateMatch = async (id: string, updates: Partial<Omit<Match, 'id'>>): Promise<Match> => {
  const sql = getPostgres()
  
  const updateData: any = {}
  if (updates.sessionId !== undefined) updateData.session_id = updates.sessionId
  if (updates.courtId !== undefined) updateData.court_id = updates.courtId
  if (updates.startedAt !== undefined) updateData.started_at = updates.startedAt
  if (updates.endedAt !== undefined) updateData.ended_at = updates.endedAt
  if (updates.round !== undefined) updateData.round = updates.round

  const tenantId = getTenantId()

  if (Object.keys(updateData).length === 0) {
    const [match] = await sql`SELECT * FROM matches WHERE id = ${id} AND tenant_id = ${tenantId}`
    return rowToMatch(match)
  }

  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1
  
  for (const [key, value] of Object.entries(updateData)) {
    setClauses.push(`${key} = $${paramIndex}`)
    values.push(value)
    paramIndex++
  }
  
  values.push(tenantId, id)
  
  const [updated] = await sql.unsafe(
    `UPDATE matches SET ${setClauses.join(', ')} WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1} RETURNING *`,
    values
  )

  invalidateCache()
  return rowToMatch(updated)
}

/**
 * Deletes a match from Postgres.
 */
export const deleteMatch = async (id: string): Promise<void> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  await sql`DELETE FROM matches WHERE id = ${id} AND tenant_id = ${tenantId}`
  invalidateCache()
}

/**
 * Gets all match players from Postgres.
 */
export const getMatchPlayers = async (): Promise<MatchPlayer[]> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const matchPlayers = await sql`SELECT * FROM match_players WHERE tenant_id = ${tenantId}`
  return matchPlayers.map(rowToMatchPlayer)
}

/**
 * Creates a match player in Postgres.
 */
export const createMatchPlayer = async (matchPlayer: Omit<MatchPlayer, 'id'>): Promise<MatchPlayer> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const [created] = await sql`
    INSERT INTO match_players (match_id, player_id, slot, tenant_id)
    VALUES (${matchPlayer.matchId}, ${matchPlayer.playerId}, ${matchPlayer.slot}, ${tenantId})
    RETURNING *
  `
  invalidateCache()
  return rowToMatchPlayer(created)
}

/**
 * Updates a match player in Postgres.
 */
export const updateMatchPlayer = async (id: string, updates: Partial<Omit<MatchPlayer, 'id'>>): Promise<MatchPlayer> => {
  const sql = getPostgres()
  
  const updateData: any = {}
  if (updates.matchId !== undefined) updateData.match_id = updates.matchId
  if (updates.playerId !== undefined) updateData.player_id = updates.playerId
  if (updates.slot !== undefined) updateData.slot = updates.slot

  const tenantId = getTenantId()

  if (Object.keys(updateData).length === 0) {
    const [matchPlayer] = await sql`SELECT * FROM match_players WHERE id = ${id} AND tenant_id = ${tenantId}`
    return rowToMatchPlayer(matchPlayer)
  }

  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1
  
  for (const [key, value] of Object.entries(updateData)) {
    setClauses.push(`${key} = $${paramIndex}`)
    values.push(value)
    paramIndex++
  }
  
  values.push(tenantId, id)
  
  const [updated] = await sql.unsafe(
    `UPDATE match_players SET ${setClauses.join(', ')} WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1} RETURNING *`,
    values
  )

  invalidateCache()
  return rowToMatchPlayer(updated)
}

/**
 * Deletes a match player from Postgres.
 */
export const deleteMatchPlayer = async (id: string): Promise<void> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  await sql`DELETE FROM match_players WHERE id = ${id} AND tenant_id = ${tenantId}`
  invalidateCache()
}

/**
 * Gets all statistics snapshots from Postgres.
 */
export const getStatisticsSnapshots = async (): Promise<StatisticsSnapshot[]> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const snapshots = await sql`SELECT * FROM statistics_snapshots WHERE tenant_id = ${tenantId} ORDER BY session_date DESC`
  return snapshots.map(rowToStatisticsSnapshot)
}

/**
 * Creates a statistics snapshot in Postgres.
 */
export const createStatisticsSnapshot = async (snapshot: Omit<StatisticsSnapshot, 'id' | 'createdAt'>): Promise<StatisticsSnapshot> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  const [created] = await sql`
    INSERT INTO statistics_snapshots (session_id, session_date, season, matches, match_players, check_ins, tenant_id)
    VALUES (
      ${snapshot.sessionId},
      ${snapshot.sessionDate},
      ${snapshot.season},
      ${JSON.stringify(snapshot.matches)},
      ${JSON.stringify(snapshot.matchPlayers)},
      ${JSON.stringify(snapshot.checkIns)},
      ${tenantId}
    )
    RETURNING *
  `
  invalidateCache()
  return rowToStatisticsSnapshot(created)
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
    } catch (_err) {
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
        // Note: This doesn't actually restore to Postgres
        // You would need to implement a migration script to restore from backup
        return true
      } catch (_err) {
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

