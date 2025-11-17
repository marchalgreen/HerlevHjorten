import type {
  Player,
  PlayerUpdateInput,
  TrainingSession,
  CheckIn,
  Court,
  Match,
  MatchPlayer,
  StatisticsSnapshot
} from '@rundeklar/common'
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
    let errorDetails: any = null
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.error || errorMessage
      errorDetails = errorJson
    } catch {
      errorMessage = errorText || errorMessage
    }
    console.error('[executeQuery] API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorMessage,
      errorDetails,
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      params: params.slice(0, 5) // Show first 5 params
    })
    throw new Error(errorMessage)
  }

  const result = await response.json()
  // Safety check: ensure result.data is always an array
  if (!Array.isArray(result.data)) {
    console.error('[executeQuery] API returned non-array data:', result)
    return []
  }
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
  // TODO: refine type - postgres client proxy requires dynamic method attachment
  ;(sqlFunction as any).unsafe = (query: string, params: any[] = []) => {
    return executeQuery(query, params)
  }
  
  // TODO: refine type - postgres client proxy returns function with unsafe method
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

/** Individual table caches for better performance */
const tableCaches = {
  players: null as Player[] | null,
  sessions: null as TrainingSession[] | null,
  checkIns: null as CheckIn[] | null,
  courts: null as Court[] | null,
  matches: null as Match[] | null,
  matchPlayers: null as MatchPlayer[] | null,
  statistics: null as StatisticsSnapshot[] | null
}

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
  alias: row.alias,
  level: row.level_single, // Default to single level for backward compatibility
  levelSingle: row.level_single,
  levelDouble: row.level_double,
  levelMix: row.level_mix,
  gender: row.gender,
  primaryCategory: row.primary_category,
  trainingGroups: row.training_group || [],
  active: row.active,
  preferredDoublesPartners: row.preferred_doubles_partners || [],
  preferredMixedPartners: row.preferred_mixed_partners || [],
  createdAt: row.created_at
})

/**
 * Converts a Postgres row to a TrainingSession.
 */
const rowToSession = (row: any): TrainingSession => ({
  id: row.id,
  date: row.date,
  status: row.status,
  createdAt: row.created_at
})

/**
 * Converts a Postgres row to a CheckIn.
 */
const rowToCheckIn = (row: any): CheckIn => ({
  id: row.id,
  sessionId: row.session_id,
  playerId: row.player_id,
  maxRounds: row.max_rounds,
  createdAt: row.created_at
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
  endedAt: row.ended_at,
  round: row.round
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
    const results = await Promise.all([
      sql`SELECT * FROM players WHERE tenant_id = ${tenantId} ORDER BY name`.catch(err => {
        console.error('[loadState] Error loading players:', err)
        return []
      }),
      sql`SELECT * FROM training_sessions WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`.catch(err => {
        console.error('[loadState] Error loading sessions:', err)
        return []
      }),
      sql`SELECT * FROM check_ins WHERE tenant_id = ${tenantId} ORDER BY created_at`.catch(err => {
        console.error('[loadState] Error loading checkIns:', err)
        return []
      }),
      sql`SELECT * FROM courts WHERE tenant_id = ${tenantId} ORDER BY idx`.catch(err => {
        console.error('[loadState] Error loading courts:', err)
        return []
      }),
      sql`SELECT * FROM matches WHERE tenant_id = ${tenantId} ORDER BY started_at`.catch(err => {
        console.error('[loadState] Error loading matches:', err)
        return []
      }),
      sql`SELECT * FROM match_players WHERE tenant_id = ${tenantId}`.catch(err => {
        console.error('[loadState] Error loading matchPlayers:', err)
        return []
      }),
      sql`SELECT * FROM statistics_snapshots WHERE tenant_id = ${tenantId} ORDER BY session_date DESC`.catch(err => {
        console.error('[loadState] Error loading statistics:', err)
        return []
      })
    ])
    
    const [players, sessions, checkIns, courts, matches, matchPlayers, statistics] = results

    // Safety check: ensure all results are arrays before mapping
    const safePlayers = Array.isArray(players) ? players : []
    const safeSessions = Array.isArray(sessions) ? sessions : []
    const safeCheckIns = Array.isArray(checkIns) ? checkIns : []
    const safeCourts = Array.isArray(courts) ? courts : []
    const safeMatches = Array.isArray(matches) ? matches : []
    const safeMatchPlayers = Array.isArray(matchPlayers) ? matchPlayers : []
    const safeStatistics = Array.isArray(statistics) ? statistics : []

    // Convert rows to types and update individual caches
    const convertedPlayers = safePlayers.map(rowToPlayer)
    const convertedSessions = safeSessions.map(rowToSession)
    const convertedCheckIns = safeCheckIns.map(rowToCheckIn)
    const convertedCourts = safeCourts.map(rowToCourt)
    const convertedMatches = safeMatches.map(rowToMatch)
    const convertedMatchPlayers = safeMatchPlayers.map(rowToMatchPlayer)
    const convertedStatistics = safeStatistics.map(rowToStatisticsSnapshot)

    // Update individual table caches
    tableCaches.players = convertedPlayers
    tableCaches.sessions = convertedSessions
    tableCaches.checkIns = convertedCheckIns
    tableCaches.courts = convertedCourts
    tableCaches.matches = convertedMatches
    tableCaches.matchPlayers = convertedMatchPlayers
    tableCaches.statistics = convertedStatistics

    // Convert rows to types
    cachedState = {
      players: convertedPlayers,
      sessions: convertedSessions,
      checkIns: convertedCheckIns,
      courts: convertedCourts,
      matches: convertedMatches,
      matchPlayers: convertedMatchPlayers,
      statistics: convertedStatistics
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
 * Persists current database state to Postgres (no-op, data is already persisted).
 * @remarks Kept for backward compatibility.
 */
export const persistState = async (): Promise<void> => {
  // No-op, data is persisted directly via CRUD operations
}

/**
 * Gets a copy of the current database state.
 * @returns Deep copy of the database state
 */
export const getStateCopy = async (): Promise<DatabaseState> => {
  const state = await loadState()
  // Safety checks: ensure all arrays exist before mapping
  const safePlayers = Array.isArray(state.players) ? state.players : []
  const safeSessions = Array.isArray(state.sessions) ? state.sessions : []
  const safeCheckIns = Array.isArray(state.checkIns) ? state.checkIns : []
  const safeCourts = Array.isArray(state.courts) ? state.courts : []
  const safeMatches = Array.isArray(state.matches) ? state.matches : []
  const safeMatchPlayers = Array.isArray(state.matchPlayers) ? state.matchPlayers : []
  const safeStatistics = Array.isArray(state.statistics) ? state.statistics : []
  
  return {
    players: safePlayers.map((player) => ({ ...player })),
    sessions: safeSessions.map((session) => ({ ...session })),
    checkIns: safeCheckIns.map((checkIn) => ({ ...checkIn })),
    courts: safeCourts.map((court) => ({ ...court })),
    matches: safeMatches.map((match) => ({ ...match })),
    matchPlayers: safeMatchPlayers.map((matchPlayer) => ({ ...matchPlayer })),
    statistics: safeStatistics.map((stat) => ({
      ...stat,
      matches: Array.isArray(stat.matches) ? stat.matches.map((m) => ({ ...m })) : [],
      matchPlayers: Array.isArray(stat.matchPlayers) ? stat.matchPlayers.map((mp) => ({ ...mp })) : [],
      checkIns: Array.isArray(stat.checkIns) ? stat.checkIns.map((c) => ({ ...c })) : []
    }))
  }
}

/**
 * Invalidates the cached state, forcing a reload on next access.
 * @param table - Optional table name to invalidate only that table's cache
 */
export const invalidateCache = (table?: 'players' | 'sessions' | 'checkIns' | 'courts' | 'matches' | 'matchPlayers' | 'statistics') => {
  if (table) {
    // Selective invalidation - only clear the specified table cache
    tableCaches[table] = null
    // Also clear the full cache so it reloads
    cachedState = null
  } else {
    // Full invalidation - clear everything
    cachedState = null
    tableCaches.players = null
    tableCaches.sessions = null
    tableCaches.checkIns = null
    tableCaches.courts = null
    tableCaches.matches = null
    tableCaches.matchPlayers = null
    tableCaches.statistics = null
  }
}

// Direct CRUD operations for better performance

/**
 * Gets all players from Postgres (uses cache if available).
 */
export const getPlayers = async (): Promise<Player[]> => {
  // Check cache first
  if (tableCaches.players) {
    return tableCaches.players
  }

  const sql = getPostgres()
  const tenantId = getTenantId()
  const players = await sql`SELECT * FROM players WHERE tenant_id = ${tenantId} ORDER BY name`
  const converted = players.map(rowToPlayer)
  
  // Update cache
  tableCaches.players = converted
  if (cachedState) {
    cachedState.players = converted
  }
  
  return converted
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
  const converted = rowToPlayer(created)
  
  // Optimistic cache update - no need to invalidate, just update cache
  if (tableCaches.players) {
    tableCaches.players = [...tableCaches.players, converted]
  }
  if (cachedState) {
    cachedState.players = [...cachedState.players, converted]
  }
  
  return converted
}

/**
 * Updates a player in Postgres.
 */
export const updatePlayer = async (id: string, updates: PlayerUpdateInput['patch']): Promise<Player> => {
  const sql = getPostgres()
  // TODO: refine type - need camelCase to snake_case mapping for database fields
  const updatesAny = updates as any
  
  // Build update object dynamically
  // TODO: refine type - dynamic object construction for database update
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

  const converted = rowToPlayer(updated)
  
  // Optimistic cache update
  if (tableCaches.players) {
    tableCaches.players = tableCaches.players.map(p => p.id === id ? converted : p)
  }
  if (cachedState) {
    cachedState.players = cachedState.players.map(p => p.id === id ? converted : p)
  }

  return converted
}

/**
 * Deletes a player from Postgres.
 */
export const deletePlayer = async (id: string): Promise<void> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  await sql`DELETE FROM players WHERE id = ${id} AND tenant_id = ${tenantId}`
  
  // Optimistic cache update
  if (tableCaches.players) {
    tableCaches.players = tableCaches.players.filter(p => p.id !== id)
  }
  if (cachedState) {
    cachedState.players = cachedState.players.filter(p => p.id !== id)
  }
}

/**
 * Gets all training sessions from Postgres (uses cache if available).
 */
export const getSessions = async (): Promise<TrainingSession[]> => {
  // Check cache first
  if (tableCaches.sessions) {
    return tableCaches.sessions
  }

  const sql = getPostgres()
  const tenantId = getTenantId()
  const sessions = await sql`SELECT * FROM training_sessions WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`
  const converted = sessions.map(rowToSession)
  
  // Update cache
  tableCaches.sessions = converted
  if (cachedState) {
    cachedState.sessions = converted
  }
  
  return converted
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
  const converted = rowToSession(created)
  
  // Optimistic cache update
  if (tableCaches.sessions) {
    tableCaches.sessions = [converted, ...tableCaches.sessions]
  }
  if (cachedState) {
    cachedState.sessions = [converted, ...cachedState.sessions]
  }
  
  return converted
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

  const converted = rowToSession(updated)
  
  // Optimistic cache update
  if (tableCaches.sessions) {
    tableCaches.sessions = tableCaches.sessions.map(s => s.id === id ? converted : s)
  }
  if (cachedState) {
    cachedState.sessions = cachedState.sessions.map(s => s.id === id ? converted : s)
  }

  return converted
}

/**
 * Deletes a training session from Postgres.
 */
export const deleteSession = async (id: string): Promise<void> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  await sql`DELETE FROM training_sessions WHERE id = ${id} AND tenant_id = ${tenantId}`
  
  // Optimistic cache update
  if (tableCaches.sessions) {
    tableCaches.sessions = tableCaches.sessions.filter(s => s.id !== id)
  }
  if (cachedState) {
    cachedState.sessions = cachedState.sessions.filter(s => s.id !== id)
  }
}

/**
 * Gets all check-ins from Postgres (uses cache if available).
 */
export const getCheckIns = async (): Promise<CheckIn[]> => {
  // Check cache first
  if (tableCaches.checkIns) {
    return tableCaches.checkIns
  }

  const sql = getPostgres()
  const tenantId = getTenantId()
  const checkIns = await sql`SELECT * FROM check_ins WHERE tenant_id = ${tenantId} ORDER BY created_at`
  const converted = checkIns.map(rowToCheckIn)
  
  // Update cache
  tableCaches.checkIns = converted
  if (cachedState) {
    cachedState.checkIns = converted
  }
  
  return converted
}

/**
 * Creates a check-in in Postgres.
 * Uses INSERT ... ON CONFLICT DO NOTHING to handle race conditions gracefully.
 */
export const createCheckIn = async (checkIn: Omit<CheckIn, 'id' | 'createdAt'>): Promise<CheckIn> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  
  // Try to insert, but if it already exists (duplicate key), return the existing one
  // Uses the unique constraint on (session_id, player_id, tenant_id)
  const result = await sql`
    INSERT INTO check_ins (session_id, player_id, max_rounds, tenant_id)
    VALUES (${checkIn.sessionId}, ${checkIn.playerId}, ${checkIn.maxRounds ?? null}, ${tenantId})
    ON CONFLICT ON CONSTRAINT check_ins_session_id_player_id_tenant_id_key DO NOTHING
    RETURNING *
  `
  
  // If no row was inserted (conflict), fetch the existing one
  if (result.length === 0) {
    const existing = await sql`
      SELECT * FROM check_ins 
      WHERE session_id = ${checkIn.sessionId} 
        AND player_id = ${checkIn.playerId} 
        AND tenant_id = ${tenantId}
      LIMIT 1
    `
    if (existing.length === 0) {
      throw new Error('Failed to create or find check-in')
    }
    const converted = rowToCheckIn(existing[0])
    
    // Update cache with existing check-in
    if (tableCaches.checkIns) {
      const existsInCache = tableCaches.checkIns.some(c => c.id === converted.id)
      if (!existsInCache) {
        tableCaches.checkIns = [...tableCaches.checkIns, converted]
      }
    }
    if (cachedState) {
      const existsInCache = cachedState.checkIns.some(c => c.id === converted.id)
      if (!existsInCache) {
        cachedState.checkIns = [...cachedState.checkIns, converted]
      }
    }
    
    return converted
  }
  
  const converted = rowToCheckIn(result[0])
  
  // Optimistic cache update
  if (tableCaches.checkIns) {
    const existsInCache = tableCaches.checkIns.some(c => c.id === converted.id)
    if (!existsInCache) {
      tableCaches.checkIns = [...tableCaches.checkIns, converted]
    }
  }
  if (cachedState) {
    const existsInCache = cachedState.checkIns.some(c => c.id === converted.id)
    if (!existsInCache) {
      cachedState.checkIns = [...cachedState.checkIns, converted]
    }
  }
  
  return converted
}

/**
 * Deletes a check-in from Postgres.
 */
export const deleteCheckIn = async (id: string): Promise<void> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  await sql`DELETE FROM check_ins WHERE id = ${id} AND tenant_id = ${tenantId}`
  
  // Invalidate cache to ensure fresh data on next check
  // This prevents race conditions when checking in immediately after checkout
  invalidateCache('checkIns')
}

/**
 * Gets all courts from Postgres (uses cache if available).
 */
export const getCourts = async (): Promise<Court[]> => {
  // Check cache first
  if (tableCaches.courts) {
    return tableCaches.courts
  }

  const sql = getPostgres()
  const tenantId = getTenantId()
  const courts = await sql`SELECT * FROM courts WHERE tenant_id = ${tenantId} ORDER BY idx`
  const converted = courts.map(rowToCourt)
  
  // Update cache
  tableCaches.courts = converted
  if (cachedState) {
    cachedState.courts = converted
  }
  
  return converted
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
  const converted = rowToCourt(created)
  
  // Optimistic cache update
  if (tableCaches.courts) {
    tableCaches.courts = [...tableCaches.courts, converted]
  }
  if (cachedState) {
    cachedState.courts = [...cachedState.courts, converted]
  }
  
  return converted
}

/**
 * Deletes a court from Postgres.
 */
export const deleteCourt = async (id: string): Promise<void> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  await sql`DELETE FROM courts WHERE id = ${id} AND tenant_id = ${tenantId}`
  
  // Optimistic cache update
  if (tableCaches.courts) {
    tableCaches.courts = tableCaches.courts.filter(c => c.id !== id)
  }
  if (cachedState) {
    cachedState.courts = cachedState.courts.filter(c => c.id !== id)
  }
}

/**
 * Gets all matches from Postgres (uses cache if available).
 */
export const getMatches = async (): Promise<Match[]> => {
  // Check cache first
  if (tableCaches.matches) {
    return tableCaches.matches
  }

  const sql = getPostgres()
  const tenantId = getTenantId()
  const matches = await sql`SELECT * FROM matches WHERE tenant_id = ${tenantId} ORDER BY started_at`
  const converted = matches.map(rowToMatch)
  
  // Update cache
  tableCaches.matches = converted
  if (cachedState) {
    cachedState.matches = converted
  }
  
  return converted
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
  const converted = rowToMatch(created)
  
  // Optimistic cache update
  if (tableCaches.matches) {
    tableCaches.matches = [...tableCaches.matches, converted]
  }
  if (cachedState) {
    cachedState.matches = [...cachedState.matches, converted]
  }
  
  return converted
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

  const converted = rowToMatch(updated)
  
  // Optimistic cache update
  if (tableCaches.matches) {
    tableCaches.matches = tableCaches.matches.map(m => m.id === id ? converted : m)
  }
  if (cachedState) {
    cachedState.matches = cachedState.matches.map(m => m.id === id ? converted : m)
  }

  return converted
}

/**
 * Deletes a match from Postgres.
 */
export const deleteMatch = async (id: string): Promise<void> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  await sql`DELETE FROM matches WHERE id = ${id} AND tenant_id = ${tenantId}`
  
  // Optimistic cache update
  if (tableCaches.matches) {
    tableCaches.matches = tableCaches.matches.filter(m => m.id !== id)
  }
  if (cachedState) {
    cachedState.matches = cachedState.matches.filter(m => m.id !== id)
  }
}

/**
 * Gets all match players from Postgres (uses cache if available).
 */
export const getMatchPlayers = async (): Promise<MatchPlayer[]> => {
  // Check cache first
  if (tableCaches.matchPlayers) {
    return tableCaches.matchPlayers
  }

  const sql = getPostgres()
  const tenantId = getTenantId()
  const matchPlayers = await sql`SELECT * FROM match_players WHERE tenant_id = ${tenantId}`
  const converted = matchPlayers.map(rowToMatchPlayer)
  
  // Update cache
  tableCaches.matchPlayers = converted
  if (cachedState) {
    cachedState.matchPlayers = converted
  }
  
  return converted
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
  const converted = rowToMatchPlayer(created)
  
  // Optimistic cache update
  if (tableCaches.matchPlayers) {
    tableCaches.matchPlayers = [...tableCaches.matchPlayers, converted]
  }
  if (cachedState) {
    cachedState.matchPlayers = [...cachedState.matchPlayers, converted]
  }
  
  return converted
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

  const converted = rowToMatchPlayer(updated)
  
  // Optimistic cache update
  if (tableCaches.matchPlayers) {
    tableCaches.matchPlayers = tableCaches.matchPlayers.map(mp => mp.id === id ? converted : mp)
  }
  if (cachedState) {
    cachedState.matchPlayers = cachedState.matchPlayers.map(mp => mp.id === id ? converted : mp)
  }

  return converted
}

/**
 * Deletes a match player from Postgres.
 */
export const deleteMatchPlayer = async (id: string): Promise<void> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  await sql`DELETE FROM match_players WHERE id = ${id} AND tenant_id = ${tenantId}`
  
  // Optimistic cache update
  if (tableCaches.matchPlayers) {
    tableCaches.matchPlayers = tableCaches.matchPlayers.filter(mp => mp.id !== id)
  }
  if (cachedState) {
    cachedState.matchPlayers = cachedState.matchPlayers.filter(mp => mp.id !== id)
  }
}

/**
 * Gets all statistics snapshots from Postgres (uses cache if available).
 */
export const getStatisticsSnapshots = async (): Promise<StatisticsSnapshot[]> => {
  // Check cache first
  if (tableCaches.statistics) {
    return tableCaches.statistics
  }

  const sql = getPostgres()
  const tenantId = getTenantId()
  const snapshots = await sql`SELECT * FROM statistics_snapshots WHERE tenant_id = ${tenantId} ORDER BY session_date DESC`
  const converted = snapshots.map(rowToStatisticsSnapshot)
  
  // Update cache
  tableCaches.statistics = converted
  if (cachedState) {
    cachedState.statistics = converted
  }
  
  return converted
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
  const converted = rowToStatisticsSnapshot(created)
  
  // Optimistic cache update
  if (tableCaches.statistics) {
    tableCaches.statistics = [converted, ...tableCaches.statistics]
  }
  if (cachedState) {
    cachedState.statistics = [converted, ...(cachedState.statistics || [])]
  }
  
  return converted
}

/**
 * Deletes a statistics snapshot from Postgres.
 */
export const deleteStatisticsSnapshot = async (id: string): Promise<void> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  await sql`DELETE FROM statistics_snapshots WHERE id = ${id} AND tenant_id = ${tenantId}`
  
  // Optimistic cache update
  if (tableCaches.statistics) {
    tableCaches.statistics = tableCaches.statistics.filter(s => s.id !== id)
  }
  if (cachedState && cachedState.statistics) {
    cachedState.statistics = cachedState.statistics.filter(s => s.id !== id)
  }
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
      storage.setItem('herlev-hjorten-db-backup', JSON.stringify(state))
      console.log('✅ Database backup created successfully.')
    } catch (error) {
      console.error('❌ Failed to create database backup:', error)
    }
  }
}

/**
 * Restores database state from a localStorage backup.
 * @returns Restored database state or null if no backup
 */
export const restoreFromBackup = async (): Promise<DatabaseState | null> => {
  const storage = typeof window !== 'undefined' ? window.localStorage : null
  if (storage) {
    try {
      const backup = storage.getItem('herlev-hjorten-db-backup')
      if (backup) {
        const state: DatabaseState = JSON.parse(backup)
        console.log('✅ Database state restored from backup.')
        // Clear current data and insert backup data
        await clearAllData()
        await insertBackupData(state)
        invalidateCache()
        return state
      }
    } catch (error) {
      console.error('❌ Failed to restore database backup:', error)
    }
  }
  return null
}

/**
 * Checks if a database backup exists in localStorage.
 * @returns True if backup exists, false otherwise
 */
export const hasBackup = (): boolean => {
  const storage = typeof window !== 'undefined' ? window.localStorage : null
  if (storage) {
    return storage.getItem('herlev-hjorten-db-backup') !== null
  }
  return false
}

/**
 * Clears all data from the database for the current tenant.
 */
export const clearAllData = async (): Promise<void> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  console.log(`Clearing all data for tenant: ${tenantId}`)
  await sql`DELETE FROM statistics_snapshots WHERE tenant_id = ${tenantId}`
  await sql`DELETE FROM match_players WHERE tenant_id = ${tenantId}`
  await sql`DELETE FROM matches WHERE tenant_id = ${tenantId}`
  await sql`DELETE FROM check_ins WHERE tenant_id = ${tenantId}`
  await sql`DELETE FROM training_sessions WHERE tenant_id = ${tenantId}`
  await sql`DELETE FROM players WHERE tenant_id = ${tenantId}`
  await sql`DELETE FROM courts WHERE tenant_id = ${tenantId}` // Courts are tenant-specific now
  invalidateCache()
  console.log(`✅ All data cleared for tenant: ${tenantId}`)
}

/**
 * Inserts backup data into the database for the current tenant.
 * @param state - Database state to insert
 */
export const insertBackupData = async (state: DatabaseState): Promise<void> => {
  const sql = getPostgres()
  const tenantId = getTenantId()
  console.log(`Inserting backup data for tenant: ${tenantId}`)

  // Insert courts first (they are referenced by matches)
  for (const court of state.courts) {
    await sql`
      INSERT INTO courts (id, idx, tenant_id)
      VALUES (${court.id}, ${court.idx}, ${tenantId})
      ON CONFLICT (id) DO UPDATE SET idx = EXCLUDED.idx, tenant_id = EXCLUDED.tenant_id
    `
  }

  // Insert players
  for (const player of state.players) {
    await sql`
      INSERT INTO players (
        id, name, alias, level_single, level_double, level_mix, gender, 
        primary_category, training_group, active, 
        preferred_doubles_partners, preferred_mixed_partners, created_at, tenant_id
      )
      VALUES (
        ${player.id}, ${player.name}, ${player.alias ?? null}, 
        ${player.levelSingle ?? player.level ?? null}, ${player.levelDouble ?? null}, ${player.levelMix ?? null}, 
        ${player.gender ?? null}, ${player.primaryCategory ?? null}, ${player.active ?? true}, 
        ${player.preferredDoublesPartners ?? []}, ${player.preferredMixedPartners ?? []}, 
        ${player.createdAt}, ${tenantId}
      )
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name, alias = EXCLUDED.alias, 
        level_single = EXCLUDED.level_single, level_double = EXCLUDED.level_double, level_mix = EXCLUDED.level_mix,
        gender = EXCLUDED.gender, primary_category = EXCLUDED.primary_category, 
        training_group = EXCLUDED.training_group, active = EXCLUDED.active,
        preferred_doubles_partners = EXCLUDED.preferred_doubles_partners, 
        preferred_mixed_partners = EXCLUDED.preferred_mixed_partners,
        tenant_id = EXCLUDED.tenant_id
    `
  }

  // Insert sessions
  for (const session of state.sessions) {
    await sql`
      INSERT INTO training_sessions (id, date, status, created_at, tenant_id)
      VALUES (${session.id}, ${session.date}, ${session.status}, ${session.createdAt}, ${tenantId})
      ON CONFLICT (id) DO UPDATE SET 
        date = EXCLUDED.date, status = EXCLUDED.status, tenant_id = EXCLUDED.tenant_id
    `
  }

  // Insert check-ins
  for (const checkIn of state.checkIns) {
    await sql`
      INSERT INTO check_ins (id, session_id, player_id, max_rounds, created_at, tenant_id)
      VALUES (${checkIn.id}, ${checkIn.sessionId}, ${checkIn.playerId}, ${checkIn.maxRounds ?? null}, ${checkIn.createdAt}, ${tenantId})
      ON CONFLICT (id) DO UPDATE SET 
        session_id = EXCLUDED.session_id, player_id = EXCLUDED.player_id, 
        max_rounds = EXCLUDED.max_rounds, tenant_id = EXCLUDED.tenant_id
    `
  }

  // Insert matches
  for (const match of state.matches) {
    await sql`
      INSERT INTO matches (id, session_id, court_id, started_at, ended_at, round, tenant_id)
      VALUES (
        ${match.id}, ${match.sessionId}, ${match.courtId}, 
        ${match.startedAt}, ${match.endedAt ?? null}, ${match.round ?? null}, ${tenantId}
      )
      ON CONFLICT (id) DO UPDATE SET 
        session_id = EXCLUDED.session_id, court_id = EXCLUDED.court_id, 
        started_at = EXCLUDED.started_at, ended_at = EXCLUDED.ended_at, 
        round = EXCLUDED.round, tenant_id = EXCLUDED.tenant_id
    `
  }

  // Insert match players
  for (const matchPlayer of state.matchPlayers) {
    await sql`
      INSERT INTO match_players (id, match_id, player_id, slot, tenant_id)
      VALUES (${matchPlayer.id}, ${matchPlayer.matchId}, ${matchPlayer.playerId}, ${matchPlayer.slot}, ${tenantId})
      ON CONFLICT (id) DO UPDATE SET 
        match_id = EXCLUDED.match_id, player_id = EXCLUDED.player_id, 
        slot = EXCLUDED.slot, tenant_id = EXCLUDED.tenant_id
    `
  }

  // Insert statistics snapshots
  for (const snapshot of state.statistics || []) {
    await sql`
      INSERT INTO statistics_snapshots (id, session_id, session_date, season, matches, match_players, check_ins, created_at, tenant_id)
      VALUES (
        ${snapshot.id}, ${snapshot.sessionId}, ${snapshot.sessionDate}, ${snapshot.season}, 
        ${JSON.stringify(snapshot.matches)}, ${JSON.stringify(snapshot.matchPlayers)}, 
        ${JSON.stringify(snapshot.checkIns)}, ${snapshot.createdAt}, ${tenantId}
      )
      ON CONFLICT (id) DO UPDATE SET 
        session_id = EXCLUDED.session_id, session_date = EXCLUDED.session_date, 
        season = EXCLUDED.season, matches = EXCLUDED.matches, 
        match_players = EXCLUDED.match_players, check_ins = EXCLUDED.check_ins,
        tenant_id = EXCLUDED.tenant_id
    `
  }
  console.log(`✅ Backup data inserted for tenant: ${tenantId}`)
}
