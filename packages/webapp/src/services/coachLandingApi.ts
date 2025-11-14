import api from '../api'
import type { Group, PlayerLite, ActiveSession, StartSessionPayload } from '../routes/landing/types'
import type { CourtWithPlayers } from '@rundeklar/common'

/**
 * Thin adapter matching the landing page contract.
 * Internally maps to existing API (players + sessions) and derives groups.
 *
 * Notes on timezone handling:
 * - We display Europe/Copenhagen elsewhere via formatting utilities.
 * - Here, we send ISO timestamps in UTC (Date.toISOString()).
 * - Downstream consumers format via existing formatters.
 */

const PENDING_SEED_KEY = 'coach-landing:pending-session-seed'
const LAST_GROUP_KEY = 'coach-landing:last-group-id'

type PendingSeed = { groupId: string | null; extraPlayerIds: string[] }

export const persistPendingSeed = (seed: PendingSeed) => {
  try {
    localStorage.setItem(PENDING_SEED_KEY, JSON.stringify(seed))
  } catch {}
}

export const readAndClearPendingSeed = (): PendingSeed | null => {
  try {
    const raw = localStorage.getItem(PENDING_SEED_KEY)
    if (!raw) return null
    localStorage.removeItem(PENDING_SEED_KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Persist last selected group id (sticky across navigations). */
export const persistLastGroupId = (groupId: string | null) => {
  try {
    if (groupId) {
      localStorage.setItem(LAST_GROUP_KEY, groupId)
    } else {
      localStorage.removeItem(LAST_GROUP_KEY)
    }
  } catch {}
}

/** Read last selected group id (non-destructive). */
export const readLastGroupId = (): string | null => {
  try {
    return localStorage.getItem(LAST_GROUP_KEY)
  } catch {
    return null
  }
}

/**
 * Derives training groups from players.trainingGroups values.
 */
export const fetchTrainingGroups = async (): Promise<Group[]> => {
  const players = await api.players.list({})
  const map = new Map<string, { count: number }>()
  players.forEach((p) => {
    const groups = p.trainingGroups ?? []
    groups.forEach((id) => {
      const prev = map.get(id) || { count: 0 }
      map.set(id, { count: prev.count + 1 })
    })
  })

  const groups: Group[] = Array.from(map.entries()).map(([name, stats]) => ({
    id: name,
    name,
    color: null,
    playersCount: stats.count,
    lastSessionAt: null // Not tracked per-group in current schema
  }))

  // Stable alpha sort by Danish locale
  return groups.sort((a, b) => a.name.localeCompare(b.name, 'da'))
}

/**
 * Lists players for a group (or all) with optional search term.
 */
export const searchPlayers = async (opts: { q?: string; groupId?: string | null; excludeGroupId?: string; limit?: number }): Promise<PlayerLite[]> => {
  const { q, groupId, excludeGroupId, limit = 50 } = opts
  // Existing API supports q, active filtering; group we filter client-side.
  const players = await api.players.list({ q: q?.trim() || undefined, active: true })
  const filtered = players.filter((p) => {
    const groups = p.trainingGroups ?? []
    // If a specific group was requested, only include those in that group
    const includeByGroup = groupId ? groups.includes(groupId) : true
    // Optionally exclude players who belong to a given group (e.g., active group)
    const excludeByGroup = excludeGroupId ? !groups.includes(excludeGroupId) : true
    return includeByGroup && excludeByGroup
  })
  const mapped: PlayerLite[] = filtered.slice(0, limit).map((p) => ({
    id: p.id,
    displayName: p.name,
    groupId: (p.trainingGroups?.[0] ?? null),
    avatarUrl: null,
    active: Boolean(p.active)
  }))
  return mapped
}

/**
 * Returns current active session. Coach id is currently ignored by backend.
 */
export const getActiveForCoach = async (_coachId: string): Promise<ActiveSession | null> => {
  const session = await api.session.getActive()
  if (!session) return null
  return { sessionId: session.id, startedAt: session.date, groupId: null }
}

/**
 * Starts a session (or returns active) and persists a small seed handoff for the CheckIn page.
 */
export const startSession = async (payload: StartSessionPayload): Promise<ActiveSession> => {
  // Persist seed for CheckIn to optionally read (group + extra players)
  persistPendingSeed({ groupId: payload.groupId, extraPlayerIds: payload.allowedCrossGroupPlayerIds ?? [] })
  // Also persist last selected group for future openings while session is active
  persistLastGroupId(payload.groupId)

  const session = await api.session.startOrGetActive()
  return { sessionId: session.id, startedAt: session.date, groupId: payload.groupId }
}

/** Ends the current active session. */
export const endActiveSession = async (matchesData?: Array<{ round: number; matches: CourtWithPlayers[] }>): Promise<void> => {
  await api.session.endActive(matchesData)
}

export default {
  fetchTrainingGroups,
  searchPlayers,
  getActiveForCoach,
  startSession,
  endActiveSession,
  persistPendingSeed,
  readAndClearPendingSeed,
  persistLastGroupId,
  readLastGroupId
}
