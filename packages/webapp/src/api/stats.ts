import type {
  StatisticsSnapshot,
  PlayerStatistics,
  StatisticsFilters,
  Player,
  Match,
  MatchPlayer,
  Court
} from '@herlev-hjorten/common'
import { createId, getStateCopy, loadState, updateState } from './storage'
import type { DatabaseState } from './storage'

/**
 * Determines season from a date string (calendar year).
 * @param dateStr - ISO date string
 * @returns Season string (e.g., "2024")
 */
const getSeasonFromDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.getFullYear().toString()
}

/**
 * Determines team structure for a match based on player slots.
 * @param matchPlayers - Players in the match with their slots
 * @returns Object with team1 and team2 player IDs
 * @remarks For 2v2 (4 players, slots 0-3): team1 = slots 0,1; team2 = slots 2,3.
 * For 1v1 (2 players, slots 1-2): both are opponents.
 * For extended capacity (5-8 players): first half vs second half.
 */
const getTeamStructure = (matchPlayers: MatchPlayer[]): { team1: string[]; team2: string[] } => {
  const sorted = [...matchPlayers].sort((a, b) => a.slot - b.slot)
  const playerIds = sorted.map((mp) => mp.playerId)

  if (playerIds.length === 2) {
    // 1v1 match: both are opponents
    return { team1: [playerIds[0]], team2: [playerIds[1]] }
  }

  // For 2v2 or extended capacity: split into two teams
  const midPoint = Math.ceil(playerIds.length / 2)
  return {
    team1: playerIds.slice(0, midPoint),
    team2: playerIds.slice(midPoint)
  }
}

/**
 * Creates a statistics snapshot for an ended session.
 * @param sessionId - Session ID to snapshot
 * @returns Created snapshot
 * @throws Error if session not found or not ended
 */
const snapshotSession = async (sessionId: string): Promise<StatisticsSnapshot> => {
  const state = getStateCopy()
  const session = state.sessions.find((s) => s.id === sessionId)
  if (!session) {
    throw new Error('Session ikke fundet')
  }
  if (session.status !== 'ended') {
    throw new Error('Session er ikke afsluttet')
  }

  // Check if snapshot already exists
  const existingSnapshot = state.statistics?.find((s) => s.sessionId === sessionId)
  if (existingSnapshot) {
    return existingSnapshot
  }

  const sessionDate = new Date(session.date)
  const year = sessionDate.getFullYear()
  const season = year.toString()

  const sessionMatches = state.matches.filter((m) => m.sessionId === sessionId)
  const sessionMatchPlayers = state.matchPlayers.filter((mp) =>
    sessionMatches.some((m) => m.id === mp.matchId)
  )
  const sessionCheckIns = state.checkIns.filter((c) => c.sessionId === sessionId)

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

  updateState((state: DatabaseState) => {
    if (!state.statistics) {
      state.statistics = []
    }
    state.statistics.push(snapshot)
  })

  return snapshot
}

/**
 * Gets all seasons from statistics snapshots.
 * @returns Array of unique season strings, sorted
 */
const getAllSeasons = async (): Promise<string[]> => {
  const state = getStateCopy()
  const seasons = new Set<string>()
  state.statistics?.forEach((stat) => {
    seasons.add(stat.season)
  })
  return Array.from(seasons).sort()
}

/**
 * Gets session history with optional filters.
 * @param filters - Optional filters (season, dateFrom, dateTo)
 * @returns Array of statistics snapshots
 */
const getSessionHistory = async (filters?: StatisticsFilters): Promise<StatisticsSnapshot[]> => {
  const state = getStateCopy()
  let snapshots = state.statistics ?? []

  if (filters?.season) {
    snapshots = snapshots.filter((s) => s.season === filters.season)
  }

  if (filters?.dateFrom) {
    snapshots = snapshots.filter((s) => s.sessionDate >= filters.dateFrom!)
  }

  if (filters?.dateTo) {
    snapshots = snapshots.filter((s) => s.sessionDate <= filters.dateTo!)
  }

  return snapshots.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
}

/**
 * Gets check-ins by season for a player.
 * @param playerId - Player ID
 * @returns Record mapping season to check-in count
 */
const getCheckInsBySeason = async (playerId: string): Promise<Record<string, number>> => {
  const state = getStateCopy()
  const bySeason: Record<string, number> = {}

  state.statistics?.forEach((stat) => {
    const checkInCount = stat.checkIns.filter((c) => c.playerId === playerId).length
    if (checkInCount > 0) {
      bySeason[stat.season] = (bySeason[stat.season] ?? 0) + checkInCount
    }
  })

  return bySeason
}

/**
 * Gets top N partners for a player.
 * @param playerId - Player ID
 * @param limit - Maximum number of partners to return (default: 5)
 * @returns Array of partners with count and names
 */
const getTopPartners = async (
  playerId: string,
  limit: number = 5
): Promise<Array<{ playerId: string; count: number; names: string }>> => {
  const state = getStateCopy()
  const partnerCounts = new Map<string, number>()

  state.statistics?.forEach((stat) => {
    // Group matchPlayers by matchId
    const matchGroups = new Map<string, MatchPlayer[]>()
    stat.matchPlayers.forEach((mp) => {
      if (!matchGroups.has(mp.matchId)) {
        matchGroups.set(mp.matchId, [])
      }
      matchGroups.get(mp.matchId)!.push(mp)
    })

    matchGroups.forEach((matchPlayers) => {
      const { team1, team2 } = getTeamStructure(matchPlayers)
      const playerInTeam1 = team1.includes(playerId)
      const playerInTeam2 = team2.includes(playerId)

      if (playerInTeam1) {
        // Player is in team1, partners are other players in team1
        team1.forEach((pid) => {
          if (pid !== playerId) {
            partnerCounts.set(pid, (partnerCounts.get(pid) ?? 0) + 1)
          }
        })
      } else if (playerInTeam2) {
        // Player is in team2, partners are other players in team2
        team2.forEach((pid) => {
          if (pid !== playerId) {
            partnerCounts.set(pid, (partnerCounts.get(pid) ?? 0) + 1)
          }
        })
      }
    })
  })

  // Convert to array and sort by count
  const partners = Array.from(partnerCounts.entries())
    .map(([pid, count]) => {
      const player = state.players.find((p) => p.id === pid)
      return {
        playerId: pid,
        count,
        names: player?.name ?? 'Ukendt spiller'
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

  return partners
}

/**
 * Gets top N opponents for a player.
 * @param playerId - Player ID
 * @param limit - Maximum number of opponents to return (default: 5)
 * @returns Array of opponents with count and names
 */
const getTopOpponents = async (
  playerId: string,
  limit: number = 5
): Promise<Array<{ playerId: string; count: number; names: string }>> => {
  const state = getStateCopy()
  const opponentCounts = new Map<string, number>()

  state.statistics?.forEach((stat) => {
    // Group matchPlayers by matchId
    const matchGroups = new Map<string, MatchPlayer[]>()
    stat.matchPlayers.forEach((mp) => {
      if (!matchGroups.has(mp.matchId)) {
        matchGroups.set(mp.matchId, [])
      }
      matchGroups.get(mp.matchId)!.push(mp)
    })

    matchGroups.forEach((matchPlayers) => {
      const { team1, team2 } = getTeamStructure(matchPlayers)
      const playerInTeam1 = team1.includes(playerId)
      const playerInTeam2 = team2.includes(playerId)

      if (playerInTeam1) {
        // Player is in team1, opponents are players in team2
        team2.forEach((pid) => {
          opponentCounts.set(pid, (opponentCounts.get(pid) ?? 0) + 1)
        })
      } else if (playerInTeam2) {
        // Player is in team2, opponents are players in team1
        team1.forEach((pid) => {
          opponentCounts.set(pid, (opponentCounts.get(pid) ?? 0) + 1)
        })
      }
    })
  })

  // Convert to array and sort by count
  const opponents = Array.from(opponentCounts.entries())
    .map(([pid, count]) => {
      const player = state.players.find((p) => p.id === pid)
      return {
        playerId: pid,
        count,
        names: player?.name ?? 'Ukendt spiller'
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

  return opponents
}

/**
 * Gets comprehensive player statistics.
 * @param playerId - Player ID
 * @param filters - Optional filters (season, dateFrom, dateTo)
 * @returns Complete player statistics
 */
const getPlayerStatistics = async (
  playerId: string,
  filters?: StatisticsFilters
): Promise<PlayerStatistics> => {
  const state = getStateCopy()
  const player = state.players.find((p) => p.id === playerId)
  if (!player) {
    throw new Error('Spiller ikke fundet')
  }

  // Filter statistics by filters
  let relevantStats = state.statistics ?? []
  if (filters?.season) {
    relevantStats = relevantStats.filter((s) => s.season === filters.season)
  }
  if (filters?.dateFrom) {
    relevantStats = relevantStats.filter((s) => s.sessionDate >= filters.dateFrom!)
  }
  if (filters?.dateTo) {
    relevantStats = relevantStats.filter((s) => s.sessionDate <= filters.dateTo!)
  }

  // Calculate check-ins
  const checkInsBySeason: Record<string, number> = {}
  let totalCheckIns = 0
  relevantStats.forEach((stat) => {
    const checkInCount = stat.checkIns.filter((c) => c.playerId === playerId).length
    if (checkInCount > 0) {
      checkInsBySeason[stat.season] = (checkInsBySeason[stat.season] ?? 0) + checkInCount
      totalCheckIns += checkInCount
    }
  })

  // Calculate matches
  const matchesBySeason: Record<string, number> = {}
  let totalMatches = 0
  const courtCounts = new Map<number, number>()
  const matchDates: string[] = []
  let lastPlayedDate: string | null = null

  relevantStats.forEach((stat) => {
    // Group matchPlayers by matchId to count unique matches
    const playerMatches = new Set<string>()
    stat.matchPlayers
      .filter((mp) => mp.playerId === playerId)
      .forEach((mp) => {
        playerMatches.add(mp.matchId)
        const match = stat.matches.find((m) => m.id === mp.matchId)
        if (match) {
          const court = state.courts.find((c) => c.id === match.courtId)
          if (court) {
            courtCounts.set(court.idx, (courtCounts.get(court.idx) ?? 0) + 1)
          }
          matchDates.push(stat.sessionDate)
        }
      })

    const matchCount = playerMatches.size
    if (matchCount > 0) {
      matchesBySeason[stat.season] = (matchesBySeason[stat.season] ?? 0) + matchCount
      totalMatches += matchCount
    }
  })

  // Find most played court
  let mostPlayedCourt: number | null = null
  if (courtCounts.size > 0) {
    const sorted = Array.from(courtCounts.entries()).sort((a, b) => b[1] - a[1])
    mostPlayedCourt = sorted[0][0]
  }

  // Find last played date
  if (matchDates.length > 0) {
    matchDates.sort((a, b) => b.localeCompare(a))
    lastPlayedDate = matchDates[0]
  }

  // Get partners and opponents
  const partners = await getTopPartners(playerId, 5)
  const opponents = await getTopOpponents(playerId, 5)

  // Calculate average level difference
  let totalLevelDiff = 0
  let levelDiffCount = 0
  const playerLevel = player.level ?? 0

  partners.forEach((partner) => {
    const partnerPlayer = state.players.find((p) => p.id === partner.playerId)
    if (partnerPlayer?.level !== null && partnerPlayer?.level !== undefined) {
      const diff = Math.abs(playerLevel - partnerPlayer.level)
      totalLevelDiff += diff * partner.count
      levelDiffCount += partner.count
    }
  })

  opponents.forEach((opponent) => {
    const opponentPlayer = state.players.find((p) => p.id === opponent.playerId)
    if (opponentPlayer?.level !== null && opponentPlayer?.level !== undefined) {
      const diff = Math.abs(playerLevel - opponentPlayer.level)
      totalLevelDiff += diff * opponent.count
      levelDiffCount += opponent.count
    }
  })

  const averageLevelDifference = levelDiffCount > 0 ? totalLevelDiff / levelDiffCount : null

  // Determine preferred category based on match history
  let preferredCategory: 'Single' | 'Double' | 'Mixed' | null = null
  const singlesCount = new Map<string, number>()
  const doublesCount = new Map<string, number>()

  relevantStats.forEach((stat) => {
    const matchGroups = new Map<string, MatchPlayer[]>()
    stat.matchPlayers.forEach((mp) => {
      if (!matchGroups.has(mp.matchId)) {
        matchGroups.set(mp.matchId, [])
      }
      matchGroups.get(mp.matchId)!.push(mp)
    })

    matchGroups.forEach((matchPlayers) => {
      const playerInMatch = matchPlayers.some((mp) => mp.playerId === playerId)
      if (playerInMatch) {
        if (matchPlayers.length === 2) {
          // Singles match
          singlesCount.set(stat.season, (singlesCount.get(stat.season) ?? 0) + 1)
        } else if (matchPlayers.length >= 4) {
          // Doubles match
          doublesCount.set(stat.season, (doublesCount.get(stat.season) ?? 0) + 1)
        }
      }
    })
  })

  const totalSingles = Array.from(singlesCount.values()).reduce((a, b) => a + b, 0)
  const totalDoubles = Array.from(doublesCount.values()).reduce((a, b) => a + b, 0)

  if (totalSingles > 0 && totalDoubles > 0) {
    preferredCategory = 'Mixed'
  } else if (totalSingles > 0) {
    preferredCategory = 'Single'
  } else if (totalDoubles > 0) {
    preferredCategory = 'Double'
  }

  return {
    playerId,
    totalCheckIns,
    checkInsBySeason,
    totalMatches,
    matchesBySeason,
    partners,
    opponents,
    preferredCategory,
    averageLevelDifference,
    mostPlayedCourt,
    lastPlayedDate
  }
}

/** Statistics API — manages historical statistics and player analytics. */
const statsApi = {
  snapshotSession,
  getPlayerStatistics,
  getTopPartners,
  getTopOpponents,
  getCheckInsBySeason,
  getAllSeasons,
  getSessionHistory
}

export default statsApi
