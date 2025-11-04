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
} from '@badminton/common'
import { buildAssignments } from '../lib/matchmaker'
import { createId, getStateCopy, loadState, updateState } from './storage'
import type { DatabaseState } from './storage'

const normalisePlayer = (player: Player): Player => ({
  ...player,
  alias: player.alias ?? null,
  level: player.level ?? null,
  gender: player.gender ?? null,
  primaryCategory: player.primaryCategory ?? null,
  active: Boolean(player.active)
})

const playerCreateSchema = z.object({
  name: z.string().min(1),
  alias: z.string().min(1).optional(),
  level: z.number().optional(),
  gender: z.enum(['Herre', 'Dame']).optional(),
  primaryCategory: z.enum(['Single', 'Double', 'Begge']).optional(),
  active: z.boolean().optional()
})

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

const playersApi = {
  list: listPlayers,
  create: createPlayer,
  update: updatePlayer
}

const getActiveSession = async (): Promise<TrainingSession | null> => {
  const state = loadState()
  const active = state.sessions
    .filter((session) => session.status === 'active')
    .sort((a: TrainingSession, b: TrainingSession) => b.createdAt.localeCompare(a.createdAt))[0]
  return active ?? null
}

const ensureActiveSession = async (): Promise<TrainingSession> => {
  const active = await getActiveSession()
  if (!active) {
    throw new Error('Ingen aktiv træning')
  }
  return active
}

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

const endActiveSession = async (): Promise<void> => {
  updateState((state: DatabaseState) => {
    const active = state.sessions.find((session) => session.status === 'active')
    if (!active) {
      throw new Error('Ingen aktiv træning')
    }
    active.status = 'ended'
    const matches = state.matches.filter((match: Match) => match.sessionId === active.id)
    const endedAt = new Date().toISOString()
    matches.forEach((match: Match) => {
      match.endedAt = endedAt
    })
  })
}

const sessionApi = {
  startOrGetActive: startOrGetActiveSession,
  getActive: getActiveSession,
  endActive: endActiveSession
}

const addCheckIn = async (input: { playerId: string }) => {
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
    createdAt: new Date().toISOString()
  }
  updateState((current: DatabaseState) => {
    current.checkIns.push(checkIn)
  })
  return checkIn
}

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
        checkInAt: checkIn.createdAt
      }
    })
}

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

const checkInsApi = {
  add: addCheckIn,
  remove: removeCheckIn,
  listActive: listActiveCheckIns
}

const listMatches = async (): Promise<CourtWithPlayers[]> => {
  const state = loadState()
  const session = await getActiveSession()
  const courts = [...state.courts].sort((a, b) => a.idx - b.idx)
  if (!session) {
    return courts.map((court) => ({ courtIdx: court.idx, slots: [] }))
  }

  const matches = state.matches.filter((match: Match) => match.sessionId === session.id)
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

const resetMatches = async (): Promise<void> => {
  const session = await ensureActiveSession()
  updateState((state: DatabaseState) => {
    const matchIds = state.matches.filter((match: Match) => match.sessionId === session.id).map((m: Match) => m.id)
    state.matches = state.matches.filter((match: Match) => match.sessionId !== session.id)
    state.matchPlayers = state.matchPlayers.filter((mp) => !matchIds.includes(mp.matchId))
  })
}

const autoArrangeMatches = async (): Promise<AutoArrangeResult> => {
  const session = await ensureActiveSession()
  const state = loadState()
  const checkIns = state.checkIns
    .filter((checkIn: CheckIn) => checkIn.sessionId === session.id)
    .sort((a: CheckIn, b: CheckIn) => a.createdAt.localeCompare(b.createdAt))

  if (!checkIns.length) {
    return { filledCourts: 0, benched: 0 }
  }

  const existingMatches = state.matches.filter((match: Match) => match.sessionId === session.id)
  const assignedPlayers = new Set(
    state.matchPlayers
      .filter((mp) => existingMatches.some((match: Match) => match.id === mp.matchId))
      .map((mp) => mp.playerId)
  )

  const benchPlayerIds = checkIns
    .map((checkIn: CheckIn) => checkIn.playerId)
    .filter((playerId: string) => !assignedPlayers.has(playerId))

  if (!benchPlayerIds.length) {
    return { filledCourts: 0, benched: 0 }
  }

  const courts = [...state.courts].sort((a, b) => a.idx - b.idx)
  const occupied = new Set(
    existingMatches
      .map((match) => courts.find((court) => court.id === match.courtId)?.idx)
      .filter((idx): idx is number => typeof idx === 'number')
  )

  const availableCourtIdxs = courts
    .map((court) => court.idx)
    .filter((idx) => !occupied.has(idx))

  if (!availableCourtIdxs.length) {
    return { filledCourts: 0, benched: benchPlayerIds.length }
  }

  const { assignments, leftoverPlayerIds } = buildAssignments({
    benchPlayerIds,
    availableCourtIdxs,
    slotsPerCourt: 4
  })

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
        endedAt: null
      })
      playerIds.forEach((playerId: string, slot: number) => {
        mutable.matchPlayers.push({
          id: createId(),
          matchId,
          playerId,
          slot
        })
      })
    })
  })

  return {
    filledCourts: assignments.length,
    benched: leftoverPlayerIds.length
  }
}

const movePlayer = async (payload: MatchMovePayload): Promise<void> => {
  const parsed = z
    .object({
      playerId: z.string().min(1),
      toCourtIdx: z.number().int().min(1).max(8).optional(),
      toSlot: z.number().int().min(0).max(3).optional()
    })
    .superRefine((value, ctx) => {
      if (value.toCourtIdx !== undefined && value.toSlot === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'toSlot kræves når toCourtIdx er sat' })
      }
    })
    .parse(payload)

  const session = await ensureActiveSession()
  updateState((state: DatabaseState) => {
    const checkedIn = state.checkIns.some(
      (checkIn: CheckIn) => checkIn.sessionId === session.id && checkIn.playerId === parsed.playerId
    )
    if (!checkedIn) {
      throw new Error('Spilleren er ikke tjekket ind')
    }

    const currentMatchPlayer = state.matchPlayers.find((mp) => mp.playerId === parsed.playerId)
    const currentMatch = currentMatchPlayer
      ? state.matches.find((match) => match.id === currentMatchPlayer.matchId)
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

    let targetMatch = state.matches.find(
      (match) => match.sessionId === session.id && match.courtId === court.id
    )
    if (!targetMatch) {
      targetMatch = {
        id: createId(),
        sessionId: session.id,
        courtId: court.id,
        startedAt: new Date().toISOString(),
        endedAt: null
      }
      state.matches.push(targetMatch)
    }

    const existingSlots = state.matchPlayers.filter((mp) => mp.matchId === targetMatch!.id)
    const slotTaken = existingSlots.find((mp) => mp.slot === parsed.toSlot)
    if (slotTaken && slotTaken.playerId !== parsed.playerId) {
      throw new Error('Pladsen er optaget')
    }

    const effectiveCount = existingSlots.length - (currentMatch?.id === targetMatch.id ? 1 : 0)
    if (!slotTaken && effectiveCount >= 4) {
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

const matchesApi = {
  autoArrange: autoArrangeMatches,
  list: listMatches,
  reset: resetMatches,
  move: movePlayer
}

const api = {
  players: playersApi,
  session: sessionApi,
  checkIns: checkInsApi,
  matches: matchesApi
}

export default api
