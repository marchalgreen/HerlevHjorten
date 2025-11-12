import api from '../api'
import type { Group, PlayerLite, ActiveSession, StartSessionPayload } from '../routes/landing/types'

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

/**
 * Derives training groups from players.trainingGroups values.
 */
export const fetchTrainingGroups = async (): Promise<Group[]> => {
  const players = await api.players.list({})
  const map = new Map<string, { count: number }>()
  players.forEach((p) => {
    const groups = ((p as any).trainingGroups as string[] | undefined) ?? []
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
export const searchPlayers = async (opts: { q?: string; groupId?: string | null; limit?: number }): Promise<PlayerLite[]> => {
  const { q, groupId, limit = 50 } = opts
  // Existing API supports q, active filtering; group we filter client-side.
  const players = await api.players.list({ q: q?.trim() || undefined, active: true })
  const filtered = players.filter((p) => {
    if (!groupId) return true
    const groups = ((p as any).trainingGroups as string[] | undefined) ?? []
    return groups.includes(groupId)
  })
  const mapped: PlayerLite[] = filtered.slice(0, limit).map((p) => ({
    id: p.id,
    displayName: p.name,
    groupId: (() => {
      const groups = ((p as any).trainingGroups as string[] | undefined) ?? []
      return groups[0] ?? null
    })(),
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

  const session = await api.session.startOrGetActive()
  return { sessionId: session.id, startedAt: session.date, groupId: payload.groupId }
}

/** Ends the current active session. */
export const endActiveSession = async (): Promise<void> => {
  await api.session.endActive()
}

export default {
  fetchTrainingGroups,
  searchPlayers,
  getActiveForCoach,
  startSession,
  endActiveSession,
  persistPendingSeed,
  readAndClearPendingSeed
}
