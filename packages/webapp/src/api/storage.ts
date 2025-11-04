import type {
  Player,
  TrainingSession,
  CheckIn,
  Court,
  Match,
  MatchPlayer
} from '@badminton/common'

const STORAGE_KEY = 'badminton-klub-db-v1'

export type DatabaseState = {
  players: Player[]
  sessions: TrainingSession[]
  checkIns: CheckIn[]
  courts: Court[]
  matches: Match[]
  matchPlayers: MatchPlayer[]
}

const playerSeeds: Array<{ name: string; level: number; gender: 'Herre' | 'Dame' }> = [
  { name: 'Kristian Simoni', level: 245, gender: 'Herre' },
  { name: 'Phillip Ørbæk', level: 320, gender: 'Herre' },
  { name: 'Peter Thorberg', level: 458, gender: 'Herre' },
  { name: 'Andreas Juhl', level: 505, gender: 'Herre' },
  { name: 'Tommi Saksa EU', level: 582, gender: 'Herre' },
  { name: 'Mikkel Brenøe-Jensen', level: 598, gender: 'Herre' },
  { name: 'Oliver Trzepacz', level: 604, gender: 'Herre' },
  { name: 'Tobias Hartwich', level: 609, gender: 'Herre' },
  { name: 'Mathias Amdi Jensen', level: 645, gender: 'Herre' },
  { name: 'Fillip Svejgaard', level: 735, gender: 'Herre' },
  { name: 'Santtu Hyvärinen EU', level: 739, gender: 'Herre' },
  { name: 'Jonathan Hedegaard', level: 787, gender: 'Herre' },
  { name: 'Asger Feldbæk Nielsen', level: 793, gender: 'Herre' },
  { name: 'Nicklas Laursen', level: 826, gender: 'Herre' },
  { name: 'Bo Zølner', level: 964, gender: 'Herre' },
  { name: 'Rasmus Thorsted Mortensen', level: 972, gender: 'Herre' },
  { name: 'Johan la Cour Pind Schmidt', level: 978, gender: 'Herre' },
  { name: 'Anders David Thellefsen', level: 987, gender: 'Herre' },
  { name: 'Sebastian Cederlund', level: 1094, gender: 'Herre' },
  { name: 'Jonas Bangsgaard', level: 1130, gender: 'Herre' },
  { name: 'Peter Hjort Larsen', level: 1231, gender: 'Herre' },
  { name: 'Carsten Brink Nielsen', level: 1254, gender: 'Herre' },
  { name: 'Mark Hansen', level: 1290, gender: 'Herre' },
  { name: 'Daniel Bjerre Hecht', level: 1371, gender: 'Herre' },
  { name: 'Marc Halgreen', level: 1460, gender: 'Herre' },
  { name: 'Jesper Skytte', level: 1470, gender: 'Herre' },
  { name: 'Rasmus Thage', level: 1554, gender: 'Herre' },
  { name: 'Flemming Klausen', level: 1610, gender: 'Herre' },
  { name: 'Parag Naithani', level: 1724, gender: 'Herre' },
  { name: 'Freja Helander', level: 1743, gender: 'Dame' },
  { name: 'Mie Falkenberg', level: 1819, gender: 'Dame' },
  { name: 'Katrine M Hansen', level: 1851, gender: 'Dame' },
  { name: 'Julie Helander', level: 1867, gender: 'Dame' },
  { name: 'Casper Holck Rosendal', level: 2000, gender: 'Herre' },
  { name: 'Sofie Dahl', level: 2000, gender: 'Dame' },
  { name: 'Martin Pallis', level: 2096, gender: 'Herre' },
  { name: 'Mads Hartwich', level: 2114, gender: 'Herre' },
  { name: 'Hjalte Pagh', level: 2195, gender: 'Herre' },
  { name: 'Katrine Amdi Jensen', level: 2258, gender: 'Dame' },
  { name: 'Tina Brix Nyhuus', level: 2364, gender: 'Dame' },
  { name: 'Jesper Nielsen', level: 2450, gender: 'Herre' },
  { name: 'Emilia Skøtt Borregaard', level: 2488, gender: 'Dame' },
  { name: 'Nicolai Fogt', level: 2510, gender: 'Herre' },
  { name: 'Kristian Hede', level: 2510, gender: 'Herre' },
  { name: 'Frederikke Jespersgaard', level: 2575, gender: 'Dame' },
  { name: 'Anders Kristensen', level: 2622, gender: 'Herre' },
  { name: 'Bo Mortensen', level: 2688, gender: 'Herre' },
  { name: 'Daniel Froberg', level: 2898, gender: 'Herre' },
  { name: 'Rikke Højbjerg', level: 3013, gender: 'Dame' },
  { name: 'Dorthe Brink', level: 3122, gender: 'Dame' },
  { name: 'Kamila Cooper Lassen', level: 3130, gender: 'Dame' },
  { name: 'Søren Knudsen', level: 3155, gender: 'Herre' },
  { name: 'Jesper Fyhr Jensen', level: 3162, gender: 'Herre' },
  { name: 'Karsten Viborg', level: 3270, gender: 'Herre' },
  { name: 'Joachim Hedegaard', level: 3370, gender: 'Herre' },
  { name: 'Nete Kjær Gabel', level: 3413, gender: 'Dame' },
  { name: 'Katrine Schultz-Knudsen', level: 3770, gender: 'Dame' },
  { name: 'Esther Feldbæk Nielsen', level: 3848, gender: 'Dame' },
  { name: 'Simone Schefte', level: 4104, gender: 'Dame' },
  { name: 'Thomas Hartwich', level: 4235, gender: 'Herre' },
  { name: 'Julie Johansen', level: 4240, gender: 'Dame' },
  { name: 'Simon Hemming Hansen', level: 4263, gender: 'Herre' },
  { name: 'Marianne Strøm Madsen', level: 4367, gender: 'Dame' },
  { name: 'Rie Søgaard Jensen', level: 4681, gender: 'Dame' },
  { name: 'Frederik Lasse Enevoldsen', level: 4722, gender: 'Herre' },
  { name: 'Siv Saabye', level: 4728, gender: 'Dame' },
  { name: 'Ida Palm', level: 4756, gender: 'Dame' },
  { name: 'Claes Ladefoged', level: 4762, gender: 'Herre' },
  { name: 'Eva Zib', level: 5001, gender: 'Dame' },
  { name: 'Kristine Nørgaard Pedersen', level: 5132, gender: 'Dame' }
]

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

const createSeedState = (): DatabaseState => {
  const now = new Date().toISOString()
  return {
    players: playerSeeds.map((seed) => ({
      id: createId(),
      name: seed.name,
      alias: null,
      level: seed.level,
      gender: seed.gender,
      primaryCategory: null,
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
    matchPlayers: []
  }
}

let cachedState: DatabaseState | null = null

const getStorage = () => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const loadState = (): DatabaseState => {
  if (cachedState) return cachedState
  const storage = getStorage()
  if (storage) {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        cachedState = JSON.parse(raw) as DatabaseState
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

export const persistState = () => {
  const storage = getStorage()
  if (storage && cachedState) {
    storage.setItem(STORAGE_KEY, JSON.stringify(cachedState))
  }
}

export const updateState = (updater: (state: DatabaseState) => void) => {
  const state = loadState()
  updater(state)
  persistState()
}

export const resetState = () => {
  cachedState = createSeedState()
  persistState()
}

export const getStateCopy = (): DatabaseState => {
  const state = loadState()
  return {
    players: state.players.map((player) => ({ ...player })),
    sessions: state.sessions.map((session) => ({ ...session })),
    checkIns: state.checkIns.map((checkIn) => ({ ...checkIn })),
    courts: state.courts.map((court) => ({ ...court })),
    matches: state.matches.map((match) => ({ ...match })),
    matchPlayers: state.matchPlayers.map((matchPlayer) => ({ ...matchPlayer }))
  }
}

export { createId }
