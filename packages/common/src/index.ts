export type PlayerGender = 'Herre' | 'Dame'
export type PlayerCategory = 'Single' | 'Double' | 'Begge'

export type Player = {
  id: string
  name: string
  alias?: string | null
  level?: number | null // Deprecated: kept for backward compatibility, use levelSingle/levelDouble/levelMix instead
  levelSingle?: number | null
  levelDouble?: number | null
  levelMix?: number | null
  gender?: PlayerGender | null
  primaryCategory?: PlayerCategory | null
  trainingGroups?: string[] | null
  active: boolean
  preferredDoublesPartners?: string[] | null
  preferredMixedPartners?: string[] | null
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
  maxRounds?: number | null
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

export type CheckedInPlayer = Player & { checkInAt: string; maxRounds?: number | null }

export type PlayerListFilters = {
  q?: string
  active?: boolean
}

export type PlayerCreateInput = {
  name: string
  alias?: string
  level?: number // Deprecated: kept for backward compatibility
  levelSingle?: number
  levelDouble?: number
  levelMix?: number
  gender?: PlayerGender
  primaryCategory?: PlayerCategory
  trainingGroups?: string[]
  active?: boolean
  preferredDoublesPartners?: string[]
  preferredMixedPartners?: string[]
}

export type PlayerUpdateInput = {
  id: string
  patch: Partial<Pick<Player, 'name' | 'alias' | 'level' | 'levelSingle' | 'levelDouble' | 'levelMix' | 'gender' | 'primaryCategory' | 'trainingGroups' | 'active' | 'preferredDoublesPartners' | 'preferredMixedPartners'>>
}

export type MatchMovePayload = {
  playerId: string
  toCourtIdx?: number
  toSlot?: number
  round?: number
  swapWithPlayerId?: string
}

export type AutoArrangeResult = {
  filledCourts: number
  benched: number
}

export type StatisticsSnapshot = {
  id: string
  sessionId: string
  sessionDate: string
  season: string
  matches: Match[]
  matchPlayers: MatchPlayer[]
  checkIns: CheckIn[]
  createdAt: string
}

export type PlayerStatistics = {
  playerId: string
  totalCheckIns: number
  checkInsBySeason: Record<string, number>
  totalMatches: number
  matchesBySeason: Record<string, number>
  partners: Array<{ playerId: string; count: number; names: string }>
  opponents: Array<{ playerId: string; count: number; names: string }>
  preferredCategory: 'Single' | 'Double' | 'Mixed' | null
  averageLevelDifference: number | null
  mostPlayedCourt: number | null
  lastPlayedDate: string | null
}

export type StatisticsFilters = {
  playerId?: string
  season?: string
  dateFrom?: string
  dateTo?: string
}

export type TenantConfig = {
  id: string
  name: string
  subdomain: string // Subdomain for tenant (e.g., "herlev-hjorten" for herlev-hjorten.rundeklar.dk)
  logo: string
  maxCourts: number
  postgresUrl?: string // Postgres connection string (optional - can use DATABASE_URL env var)
  // Legacy Supabase fields (deprecated, kept for backward compatibility during migration)
  supabaseUrl?: string
  supabaseKey?: string
  features?: {
    [key: string]: boolean | string | number
  }
  deleted?: boolean // Soft delete flag
  deletedAt?: string // Deletion timestamp
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
    add(input: { playerId: string; maxRounds?: number }): Promise<CheckIn>
    remove(input: { playerId: string }): Promise<void>
    listActive(): Promise<CheckedInPlayer[]>
  }
  matches: {
    autoArrange(round?: number): Promise<AutoArrangeResult>
    list(round?: number): Promise<CourtWithPlayers[]>
    reset(): Promise<void>
    move(payload: MatchMovePayload, round?: number): Promise<void>
  }
}
