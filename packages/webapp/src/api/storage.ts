import type {
  Player,
  TrainingSession,
  CheckIn,
  Court,
  Match,
  MatchPlayer,
  StatisticsSnapshot
} from '@herlev-hjorten/common'

/** LocalStorage key for database state. */
const STORAGE_KEY = 'herlev-hjorten-db-v2'

/** In-memory database state structure. */
export type DatabaseState = {
  players: Player[]
  sessions: TrainingSession[]
  checkIns: CheckIn[]
  courts: Court[]
  matches: Match[]
  matchPlayers: MatchPlayer[]
  statistics?: StatisticsSnapshot[]
}

/** Seed data for initial player population. */
const playerSeeds: Array<{ name: string; level: number; gender: 'Herre' | 'Dame'; primaryCategory: 'Single' | 'Double' | 'Begge' }> = [
  { name: 'Kristian Simoni', level: 245, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Phillip Ørbæk', level: 320, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Peter Thorberg', level: 458, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Andreas Juhl', level: 505, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Tommi Saksa EU', level: 582, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Mikkel Brenøe-Jensen', level: 598, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Oliver Trzepacz', level: 604, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Tobias Hartwich', level: 609, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Mathias Amdi Jensen', level: 645, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Fillip Svejgaard', level: 735, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Santtu Hyvärinen EU', level: 739, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Jonathan Hedegaard', level: 787, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Asger Feldbæk Nielsen', level: 793, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Nicklas Laursen', level: 826, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Bo Zølner', level: 964, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Rasmus Thorsted Mortensen', level: 972, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Johan la Cour Pind Schmidt', level: 978, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Anders David Thellefsen', level: 987, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Sebastian Cederlund', level: 1094, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Jonas Bangsgaard', level: 1130, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Peter Hjort Larsen', level: 1231, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Carsten Brink Nielsen', level: 1254, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Mark Hansen', level: 1290, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Daniel Bjerre Hecht', level: 1371, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Marc Halgreen', level: 1460, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Jesper Skytte', level: 1470, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Rasmus Thage', level: 1554, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Flemming Klausen', level: 1610, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Parag Naithani', level: 1724, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Freja Helander', level: 1743, gender: 'Dame', primaryCategory: 'Double' },
  { name: 'Mie Falkenberg', level: 1819, gender: 'Dame', primaryCategory: 'Begge' },
  { name: 'Katrine M Hansen', level: 1851, gender: 'Dame', primaryCategory: 'Single' },
  { name: 'Julie Helander', level: 1867, gender: 'Dame', primaryCategory: 'Double' },
  { name: 'Casper Holck Rosendal', level: 2000, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Sofie Dahl', level: 2000, gender: 'Dame', primaryCategory: 'Single' },
  { name: 'Martin Pallis', level: 2096, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Mads Hartwich', level: 2114, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Hjalte Pagh', level: 2195, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Katrine Amdi Jensen', level: 2258, gender: 'Dame', primaryCategory: 'Double' },
  { name: 'Tina Brix Nyhuus', level: 2364, gender: 'Dame', primaryCategory: 'Begge' },
  { name: 'Jesper Nielsen', level: 2450, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Emilia Skøtt Borregaard', level: 2488, gender: 'Dame', primaryCategory: 'Double' },
  { name: 'Nicolai Fogt', level: 2510, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Kristian Hede', level: 2510, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Frederikke Jespersgaard', level: 2575, gender: 'Dame', primaryCategory: 'Double' },
  { name: 'Anders Kristensen', level: 2622, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Bo Mortensen', level: 2688, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Daniel Froberg', level: 2898, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Rikke Højbjerg', level: 3013, gender: 'Dame', primaryCategory: 'Begge' },
  { name: 'Dorthe Brink', level: 3122, gender: 'Dame', primaryCategory: 'Single' },
  { name: 'Kamila Cooper Lassen', level: 3130, gender: 'Dame', primaryCategory: 'Double' },
  { name: 'Søren Knudsen', level: 3155, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Jesper Fyhr Jensen', level: 3162, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Karsten Viborg', level: 3270, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Joachim Hedegaard', level: 3370, gender: 'Herre', primaryCategory: 'Begge' },
  { name: 'Nete Kjær Gabel', level: 3413, gender: 'Dame', primaryCategory: 'Single' },
  { name: 'Katrine Schultz-Knudsen', level: 3770, gender: 'Dame', primaryCategory: 'Double' },
  { name: 'Esther Feldbæk Nielsen', level: 3848, gender: 'Dame', primaryCategory: 'Begge' },
  { name: 'Simone Schefte', level: 4104, gender: 'Dame', primaryCategory: 'Single' },
  { name: 'Thomas Hartwich', level: 4235, gender: 'Herre', primaryCategory: 'Double' },
  { name: 'Julie Johansen', level: 4240, gender: 'Dame', primaryCategory: 'Begge' },
  { name: 'Simon Hemming Hansen', level: 4263, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Marianne Strøm Madsen', level: 4367, gender: 'Dame', primaryCategory: 'Double' },
  { name: 'Rie Søgaard Jensen', level: 4681, gender: 'Dame', primaryCategory: 'Begge' },
  { name: 'Frederik Lasse Enevoldsen', level: 4722, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Siv Saabye', level: 4728, gender: 'Dame', primaryCategory: 'Double' },
  { name: 'Ida Palm', level: 4756, gender: 'Dame', primaryCategory: 'Begge' },
  { name: 'Claes Ladefoged', level: 4762, gender: 'Herre', primaryCategory: 'Single' },
  { name: 'Eva Zib', level: 5001, gender: 'Dame', primaryCategory: 'Double' },
  { name: 'Kristine Nørgaard Pedersen', level: 5132, gender: 'Dame', primaryCategory: 'Begge' }
]

/**
 * Generates a unique ID (UUID if available, otherwise random string).
 * @returns Unique ID string
 */
const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

/**
 * Creates initial database state with seed players and 8 courts.
 * @returns Fresh database state
 */
const createSeedState = (): DatabaseState => {
  const now = new Date().toISOString()
  return {
    players: playerSeeds.map((seed) => ({
      id: createId(),
      name: seed.name,
      alias: null,
      level: seed.level,
      gender: seed.gender,
      primaryCategory: seed.primaryCategory,
      active: true,
      createdAt: now
    })),
    sessions: [],
    checkIns: [],
    courts: Array.from({ length: 8 }, (_, i) => ({
      id: createId(),
      idx: i + 1
    })),
    matches: [],
    matchPlayers: [],
    statistics: []
  }
}

/** Cached database state (singleton pattern). */
let cachedState: DatabaseState | null = null

/**
 * Gets localStorage instance (returns null in SSR or if unavailable).
 * @returns localStorage instance or null
 */
const getStorage = () => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Migrates historical statistics from ended sessions.
 * @param state - Database state to migrate
 * @remarks Creates statistics snapshots for all ended sessions that don't have snapshots yet.
 */
const migrateHistoricalStatistics = (state: DatabaseState): void => {
  if (!state.statistics) {
    state.statistics = []
  }

  const existingSessionIds = new Set(state.statistics.map((s) => s.sessionId))
  const endedSessions = state.sessions.filter((s) => s.status === 'ended' && !existingSessionIds.has(s.id))

  for (const session of endedSessions) {
    const sessionDate = new Date(session.date)
    const year = sessionDate.getFullYear()
    const season = year.toString()

    const sessionMatches = state.matches.filter((m) => m.sessionId === session.id)
    const sessionMatchPlayers = state.matchPlayers.filter((mp) =>
      sessionMatches.some((m) => m.id === mp.matchId)
    )
    const sessionCheckIns = state.checkIns.filter((c) => c.sessionId === session.id)

    const snapshot: StatisticsSnapshot = {
      id: createId(),
      sessionId: session.id,
      sessionDate: session.date,
      season,
      matches: sessionMatches.map((m) => ({ ...m })),
      matchPlayers: sessionMatchPlayers.map((mp) => ({ ...mp })),
      checkIns: sessionCheckIns.map((c) => ({ ...c })),
      createdAt: new Date().toISOString()
    }

    state.statistics.push(snapshot)
  }
}

/**
 * Loads database state from localStorage or creates seed state.
 * @returns Database state
 * @remarks Migrates players missing gender/primaryCategory from seed data and backfills statistics.
 */
export const loadState = (): DatabaseState => {
  if (cachedState) return cachedState
  const storage = getStorage()
  if (storage) {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DatabaseState
        // Ensure statistics array exists
        if (!parsed.statistics) {
          parsed.statistics = []
        }
        // Migrate players that might be missing gender/primaryCategory
        if (parsed.players && Array.isArray(parsed.players)) {
          const seedMap = new Map(playerSeeds.map((seed) => [seed.name, seed]))
          parsed.players = parsed.players.map((player) => {
            // If player is missing gender or primaryCategory, try to restore from seed data
            if (!player.gender || !player.primaryCategory) {
              const seedData = seedMap.get(player.name)
              if (seedData) {
                return {
                  ...player,
                  gender: player.gender ?? seedData.gender ?? null,
                  primaryCategory: player.primaryCategory ?? seedData.primaryCategory ?? null
                }
              }
            }
            return player
          })
        }
        // Backfill statistics from ended sessions
        migrateHistoricalStatistics(parsed)
        cachedState = parsed
        persistState() // Save migrated data
        return cachedState
      } catch {
        // fall back to seed state
      }
    }
  }
  cachedState = createSeedState()
  persistState()
  return cachedState
}

/**
 * Persists current database state to localStorage.
 * @remarks No-op if localStorage unavailable or state is null.
 */
export const persistState = () => {
  const storage = getStorage()
  if (storage && cachedState) {
    storage.setItem(STORAGE_KEY, JSON.stringify(cachedState))
  }
}

/**
 * Updates database state and persists to localStorage.
 * @param updater - Function that mutates state
 * @remarks Loads state, applies updater, then persists atomically.
 */
export const updateState = (updater: (state: DatabaseState) => void) => {
  const state = loadState()
  updater(state)
  persistState()
}

/**
 * Resets database to seed state and persists.
 * @remarks Clears all sessions, check-ins, and matches.
 */
export const resetState = () => {
  cachedState = createSeedState()
  persistState()
}

/**
 * Returns a deep copy of current database state (for safe reading).
 * @returns Copy of database state
 * @remarks Use this for read operations that shouldn't mutate cached state.
 */
export const getStateCopy = (): DatabaseState => {
  const state = loadState()
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

export { createId }
