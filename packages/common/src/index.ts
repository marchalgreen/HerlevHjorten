export type PlayerGender = 'Herre' | 'Dame'
export type PlayerCategory = 'Single' | 'Double' | 'Begge'

export type Player = {
  id: string
  name: string
  alias?: string | null
  level?: number | null
  gender?: PlayerGender | null
  primaryCategory?: PlayerCategory | null
  active: boolean
  createdAt: string
}

export type TrainingSessionStatus = 'scheduled' | 'active' | 'ended'

export type TrainingSession = {
  id: string
  date: string
  status: TrainingSessionStatus
  createdAt: string
}

export type CheckIn = {
  id: string
  sessionId: string
  playerId: string
  createdAt: string
}

export type Court = {
  id: string
  idx: number
}

export type Match = {
  id: string
  sessionId: string
  courtId: string
  startedAt: string
  endedAt?: string | null
  round?: number | null
}

export type MatchPlayer = {
  id: string
  matchId: string
  playerId: string
  slot: number
}

export type CourtWithPlayers = {
  courtIdx: number
  slots: Array<{ slot: number; player: Player }>
}

export type CheckedInPlayer = Player & { checkInAt: string }

export type PlayerListFilters = {
  q?: string
  active?: boolean
}

export type PlayerCreateInput = {
  name: string
  alias?: string
  level?: number
  gender?: PlayerGender
  primaryCategory?: PlayerCategory
  active?: boolean
}

export type PlayerUpdateInput = {
  id: string
  patch: Partial<Pick<Player, 'name' | 'alias' | 'level' | 'gender' | 'primaryCategory' | 'active'>>
}

export type MatchMovePayload = {
  playerId: string
  toCourtIdx?: number
  toSlot?: number
}

export type AutoArrangeResult = {
  filledCourts: number
  benched: number
}

export type RendererApi = {
  players: {
    list(filters?: PlayerListFilters): Promise<Player[]>
    create(input: PlayerCreateInput): Promise<Player>
    update(input: PlayerUpdateInput): Promise<Player>
  }
  session: {
    startOrGetActive(): Promise<TrainingSession>
    endActive(): Promise<void>
    getActive(): Promise<TrainingSession | null>
  }
  checkIns: {
    add(input: { playerId: string }): Promise<CheckIn>
    remove(input: { playerId: string }): Promise<void>
    listActive(): Promise<CheckedInPlayer[]>
  }
  matches: {
    autoArrange(round?: number): Promise<AutoArrangeResult>
    list(round?: number): Promise<CourtWithPlayers[]>
    reset(): Promise<void>
    move(payload: MatchMovePayload): Promise<void>
  }
}
