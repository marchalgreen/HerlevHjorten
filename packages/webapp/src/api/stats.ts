import type {
  StatisticsSnapshot,
  PlayerStatistics,
  StatisticsFilters,
  Match,
  MatchPlayer,
  CheckIn
} from '@herlev-hjorten/common'
import { createId, getStateCopy, getStatisticsSnapshots, createStatisticsSnapshot, createSession, createCheckIn, getMatches, getMatchPlayers, invalidateCache } from './postgres'

/**
 * Determines season from a date string (August to July).
 * @param dateStr - ISO date string
 * @returns Season string (e.g., "2023-2024")
 * @remarks Seasons run from August 1st to July 31st.
 * Dates in August-December use current year as start.
 * Dates in January-July use previous year as start.
 */
const getSeasonFromDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1 // 1-12 (Jan=1, Dec=12)
  const year = date.getFullYear()
  
  // If month is August (8) or later, season is YEAR-YEAR+1
  // If month is January-July (1-7), season is YEAR-1-YEAR
  if (month >= 8) {
    return `${year}-${year + 1}`
  } else {
    return `${year - 1}-${year}`
  }
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
  try {
    console.log('[snapshotSession] Starting snapshot creation for session', sessionId)
    
    // Invalidate cache to ensure we get fresh data from Postgres
    invalidateCache()
    
    const state = await getStateCopy()
    console.log('[snapshotSession] State loaded, sessions:', state.sessions.length)
    
    const session = state.sessions.find((s) => s.id === sessionId)
    if (!session) {
      console.error('[snapshotSession] Session not found:', sessionId)
      throw new Error('Session ikke fundet')
    }
    console.log('[snapshotSession] Session found:', { id: session.id, status: session.status, date: session.date })
    
    if (session.status !== 'ended') {
      console.error('[snapshotSession] Session not ended:', session.status)
      throw new Error('Session er ikke afsluttet')
    }

    // Check if snapshot already exists
    const existingSnapshot = state.statistics?.find((s) => s.sessionId === sessionId)
    if (existingSnapshot) {
      console.log('[snapshotSession] Snapshot already exists for session', sessionId)
      return existingSnapshot
    }

    const season = getSeasonFromDate(session.date)
    console.log('[snapshotSession] Season calculated:', season)

    // Directly query Postgres for fresh matches and matchPlayers to avoid stale cache
    // Also get checkIns from fresh state
    console.log('[snapshotSession] Querying Postgres for matches and matchPlayers...')
    const [allMatches, allMatchPlayers] = await Promise.all([
      getMatches(),
      getMatchPlayers()
    ])
    
    console.log('[snapshotSession] Retrieved from Postgres:', {
      totalMatches: allMatches.length,
      totalMatchPlayers: allMatchPlayers.length
    })
    
    // Get checkIns from fresh state (already loaded above)
    const allCheckIns = state.checkIns
    
    const sessionMatches = allMatches.filter((m) => m.sessionId === sessionId)
    const sessionMatchPlayers = allMatchPlayers.filter((mp) =>
      sessionMatches.some((m) => m.id === mp.matchId)
    )
    const sessionCheckIns = allCheckIns.filter((c) => c.sessionId === sessionId)

    console.log('[snapshotSession] Filtered session data:', {
      sessionId,
      matches: sessionMatches.length,
      matchPlayers: sessionMatchPlayers.length,
      checkIns: sessionCheckIns.length,
      matchIds: sessionMatches.map(m => m.id),
      matchPlayerDetails: sessionMatchPlayers.map(mp => ({ matchId: mp.matchId, playerId: mp.playerId, slot: mp.slot }))
    })

    if (sessionMatches.length === 0) {
      console.warn('[snapshotSession] WARNING: No matches found for session', sessionId)
      console.warn('[snapshotSession] All matches in database:', allMatches.map(m => ({ id: m.id, sessionId: m.sessionId })))
    }
    if (sessionMatchPlayers.length === 0) {
      console.warn('[snapshotSession] WARNING: No matchPlayers found for session', sessionId)
      console.warn('[snapshotSession] All matchPlayers in database:', allMatchPlayers.map(mp => ({ matchId: mp.matchId, playerId: mp.playerId })))
    }

    console.log('[snapshotSession] Creating snapshot with data:', {
      sessionId: session.id,
      sessionDate: session.date,
      season,
      matchesCount: sessionMatches.length,
      matchPlayersCount: sessionMatchPlayers.length,
      checkInsCount: sessionCheckIns.length
    })

    const snapshot = await createStatisticsSnapshot({
      sessionId: session.id,
      sessionDate: session.date,
      season,
      matches: sessionMatches.map((m) => ({ ...m })),
      matchPlayers: sessionMatchPlayers.map((mp) => ({ ...mp })),
      checkIns: sessionCheckIns.map((c) => ({ ...c }))
    })

    console.log('[snapshotSession] Snapshot created successfully', snapshot.id)
    console.log('[snapshotSession] Snapshot data:', {
      id: snapshot.id,
      matches: snapshot.matches.length,
      matchPlayers: snapshot.matchPlayers.length,
      checkIns: snapshot.checkIns.length
    })
    
    return snapshot
  } catch (error) {
    console.error('[snapshotSession] Error creating snapshot:', error)
    throw error
  }
}

/**
 * Gets all seasons from statistics snapshots.
 * @returns Array of unique season strings, sorted
 */
const getAllSeasons = async (): Promise<string[]> => {
  const statistics = await getStatisticsSnapshots()
  const seasons = new Set<string>()
  statistics.forEach((stat) => {
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
  let snapshots = await getStatisticsSnapshots()

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
  const statistics = await getStatisticsSnapshots()
  const bySeason: Record<string, number> = {}

  statistics.forEach((stat) => {
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
  const [state, statistics] = await Promise.all([getStateCopy(), getStatisticsSnapshots()])
  const partnerCounts = new Map<string, number>()

  statistics.forEach((stat) => {
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
  const [state, statistics] = await Promise.all([getStateCopy(), getStatisticsSnapshots()])
  const opponentCounts = new Map<string, number>()

  statistics.forEach((stat) => {
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
 * Gets comparison statistics between two players.
 * @param playerId1 - First player ID
 * @param playerId2 - Second player ID
 * @returns Object with partner count and opponent count
 */
const getPlayerComparison = async (
  playerId1: string,
  playerId2: string
): Promise<{ partnerCount: number; opponentCount: number }> => {
  const statistics = await getStatisticsSnapshots()
  let partnerCount = 0
  let opponentCount = 0

  statistics.forEach((stat) => {
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
      const player1InTeam1 = team1.includes(playerId1)
      const player1InTeam2 = team2.includes(playerId1)
      const player2InTeam1 = team1.includes(playerId2)
      const player2InTeam2 = team2.includes(playerId2)

      // Check if both players are in the same match
      if ((player1InTeam1 || player1InTeam2) && (player2InTeam1 || player2InTeam2)) {
        // Both players are in the same match
        const sameTeam = (player1InTeam1 && player2InTeam1) || (player1InTeam2 && player2InTeam2)
        if (sameTeam) {
          partnerCount++
        } else {
          opponentCount++
        }
      }
    })
  })

  return { partnerCount, opponentCount }
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
  // Invalidate cache to ensure fresh statistics snapshots
  invalidateCache()
  
  const state = await getStateCopy()
  const player = state.players.find((p) => p.id === playerId)
  if (!player) {
    throw new Error('Spiller ikke fundet')
  }

  // Filter statistics by filters
  let relevantStats = await getStatisticsSnapshots()
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

/**
 * Generates dummy historical data for demo purposes.
 * @remarks Creates realistic historical sessions, matches, and check-ins spanning multiple seasons.
 * This function is for demo/testing purposes only.
 */
const generateDummyHistoricalData = async (): Promise<void> => {
  const state = await getStateCopy()

  const players = state.players.filter((p) => p.active)
  if (players.length < 8) {
    throw new Error('Mindst 8 aktive spillere kræves for at generere dummy data')
  }

  // Note: We don't clear existing statistics in Postgres - this function generates additional data
  // If you want to clear, you would need to delete from Postgres directly

  const courts = state.courts
  const now = new Date()

  // Generate sessions for the past 1.5 seasons (about 18 months)
  // Start from 18 months ago (reduced to avoid localStorage quota issues)
  const sessions: Array<{ date: string; season: string }> = []
  const monthsToGenerate = 18

  for (let i = monthsToGenerate; i >= 0; i--) {
    const sessionDate = new Date(now)
    sessionDate.setMonth(sessionDate.getMonth() - i)
    
    // Generate 8 sessions per month
    const sessionsThisMonth = 8
    
    for (let j = 0; j < sessionsThisMonth; j++) {
      const dayOfMonth = Math.floor(Math.random() * 28) + 1 // 1-28 to avoid month boundary issues
      const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), dayOfMonth)
      const hour = 18 + Math.floor(Math.random() * 3) // 18-20 (6-8 PM)
      const minute = Math.floor(Math.random() * 4) * 15 // 0, 15, 30, 45
      sessionDay.setHours(hour, minute, 0, 0)
      
      const season = getSeasonFromDate(sessionDay.toISOString())
      sessions.push({
        date: sessionDay.toISOString(),
        season
      })
    }
  }

  // Sort sessions by date
  sessions.sort((a, b) => a.date.localeCompare(b.date))

  // Process each session and create in Supabase
  for (const sessionInfo of sessions) {
    const sessionDate = new Date(sessionInfo.date)
      
    // Create ended session in Postgres
    const session = await createSession({
      date: sessionInfo.date,
      status: 'ended'
    })
    const sessionId = session.id

    // Randomly select ~26 players to check in on average (target: 1.7 matches per check-in)
    // Use a range around 26 to make it realistic
    const checkInCount = Math.min(
      Math.floor(Math.random() * 10) + 22, // 22-32 players, average ~26
      players.length
    )
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5)
    const checkedInPlayers = shuffledPlayers.slice(0, checkInCount)

    // Create check-ins in Postgres
    const checkIns: CheckIn[] = []
    for (const player of checkedInPlayers) {
      const checkInTime = new Date(sessionDate)
      checkInTime.setMinutes(checkInTime.getMinutes() - Math.floor(Math.random() * 60)) // Random time before session
      
      const checkIn = await createCheckIn({
        sessionId,
        playerId: player.id,
        maxRounds: null
      })
      checkIns.push(checkIn)
    }

    // Generate 2 rounds on average (1-3 rounds per session)
    const roundsPerSession = Math.floor(Math.random() * 3) + 1 // 1-3 rounds, average ~2
    const allMatches: Match[] = []
    const allMatchPlayers: MatchPlayer[] = []
    
    // Track how many matches each player has been assigned to in this session
    const playerMatchCount = new Map<string, number>()
    checkedInPlayers.forEach((p) => playerMatchCount.set(p.id, 0))
    
    // Target: ~1.7 matches per player per session
    // Calculate how many player slots we need: checkedInPlayers.length × 1.7
    const targetPlayerSlots = Math.round(checkedInPlayers.length * 1.7)
    
    // With 2 rounds and 5-7 courts, we can create 10-14 matches
    // If mostly 2v2 (4 players per match), that's 40-56 player slots
    // If mostly 1v1 (2 players per match), that's 20-28 player slots
    // We need to ensure we create enough matches to reach target
    const avgPlayersPerMatch = 3 // Mix of 1v1 and 2v2 averages to ~3
    const neededMatches = Math.ceil(targetPlayerSlots / avgPlayersPerMatch)
    const courtsPerRound = Math.ceil(neededMatches / roundsPerSession)

    for (let roundNum = 1; roundNum <= roundsPerSession; roundNum++) {
      // Create matches - ensure enough courts to reach ~1.7 matches per player
      const courtCount = Math.min(
        Math.max(courtsPerRound, Math.floor(Math.random() * 3) + 5), // At least courtsPerRound, but 5-7 if possible
        courts.length,
        Math.floor(checkedInPlayers.length / 2) // Ensure we can assign at least 2 players per court
      )
      const usedCourts = courts.slice(0, courtCount)
      const matches: Match[] = []
      const matchPlayers: MatchPlayer[] = []
      
      // For each round, sort players by match count (fewer matches first) to ensure fair distribution
      // Re-sort at the start of each round based on current match counts
      const sortedPlayers = [...checkedInPlayers].sort((a, b) => {
        const countA = playerMatchCount.get(a.id) ?? 0
        const countB = playerMatchCount.get(b.id) ?? 0
        return countA - countB // Players with fewer matches first
      })

      usedCourts.forEach((court, courtIndex) => {
        const matchId = createId()
        const matchStart = new Date(sessionDate)
        // Stagger start times: round 1 starts at session time, round 2 starts 45 min later, etc.
        matchStart.setMinutes(matchStart.getMinutes() + (roundNum - 1) * 45 + courtIndex * 5)
        
        matches.push({
          id: matchId,
          sessionId,
          courtId: court.id,
          startedAt: matchStart.toISOString(),
          endedAt: new Date(matchStart.getTime() + 45 * 60000).toISOString(), // 45 minutes later
          round: roundNum
        })

        // Re-sort players before each court to prioritize those with fewer matches
        sortedPlayers.sort((a, b) => {
          const countA = playerMatchCount.get(a.id) ?? 0
          const countB = playerMatchCount.get(b.id) ?? 0
          return countA - countB
        })

        if (sortedPlayers.length < 2) return

        // Prefer 2v2 matches to use more players and reach target faster
        // But still allow some 1v1 for variety
        const currentAvgMatches = Array.from(playerMatchCount.values()).reduce((a, b) => a + b, 0) / checkedInPlayers.length
        const needsMoreMatches = currentAvgMatches < 1.7
        
        // If we need more matches, prefer 2v2 (uses 4 players vs 2)
        const isDoubles = sortedPlayers.length >= 4 && (needsMoreMatches || Math.random() > 0.3)
        
        if (isDoubles && sortedPlayers.length >= 4) {
          // 2v2 match - take first 4 players (those with fewest matches)
          const selectedPlayers = sortedPlayers.slice(0, 4)
          
          // Assign slots 0, 1, 2, 3
          selectedPlayers.forEach((player, index) => {
            playerMatchCount.set(player.id, (playerMatchCount.get(player.id) ?? 0) + 1)
            matchPlayers.push({
              id: createId(),
              matchId,
              playerId: player.id,
              slot: index
            })
          })
        } else {
          // 1v1 match - take first 2 players (those with fewest matches)
          const selectedPlayers = sortedPlayers.slice(0, 2)
          
          // Assign slots 1 and 2
          selectedPlayers.forEach((player) => {
            playerMatchCount.set(player.id, (playerMatchCount.get(player.id) ?? 0) + 1)
          })
          matchPlayers.push({
            id: createId(),
            matchId,
            playerId: selectedPlayers[0].id,
            slot: 1
          })
          matchPlayers.push({
            id: createId(),
            matchId,
            playerId: selectedPlayers[1].id,
            slot: 2
          })
        }
      })

      allMatches.push(...matches)
      allMatchPlayers.push(...matchPlayers)
    }

    // Create snapshot in Postgres
    await createStatisticsSnapshot({
      sessionId,
      sessionDate: sessionInfo.date,
      season: sessionInfo.season,
      matches: allMatches.map((m) => ({ ...m })),
      matchPlayers: allMatchPlayers.map((mp) => ({ ...mp })),
      checkIns: checkIns.map((c) => ({ ...c }))
    })
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
  getSessionHistory,
  generateDummyHistoricalData,
  getPlayerComparison
}

export default statsApi
