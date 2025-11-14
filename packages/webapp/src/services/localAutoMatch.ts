/**
 * Local auto-match service - works purely with in-memory data for instant UI updates.
 * 
 * This is a pure function version of auto-match that doesn't require database access,
 * making it instant for optimistic UI updates.
 */

import type { CheckedInPlayer, CourtWithPlayers, Player } from '@rundeklar/common'

export interface LocalAutoMatchOptions {
  checkedIn: CheckedInPlayer[]
  currentMatches: CourtWithPlayers[]
  maxCourts: number
  selectedRound: number
  unavailablePlayers: Set<string>
  activatedOneRoundPlayers: Set<string>
  lockedCourtIdxs: Set<number>
  isReshuffle: boolean
  extendedCapacityCourts: Map<number, number>
}

export interface AutoMatchResult {
  matches: CourtWithPlayers[]
  result: { filledCourts: number; benched: number }
}

/**
 * Performs auto-match locally using only in-memory data.
 * This is instant and doesn't require database access.
 */
export const localAutoMatch = (options: LocalAutoMatchOptions): AutoMatchResult => {
  const {
    checkedIn,
    currentMatches,
    maxCourts,
    selectedRound,
    unavailablePlayers,
    activatedOneRoundPlayers,
    lockedCourtIdxs,
    isReshuffle,
    extendedCapacityCourts
  } = options

  // Get assigned player IDs from current matches
  const assignedIds = new Set<string>()
  currentMatches.forEach((court) => {
    court.slots.forEach((slot) => {
      if (slot.player?.id) {
        assignedIds.add(slot.player.id)
      }
    })
  })

  // Get players on locked courts (they should stay)
  const playersOnLockedCourts = new Set<string>()
  currentMatches.forEach((court) => {
    if (lockedCourtIdxs.has(court.courtIdx)) {
      court.slots.forEach((slot) => {
        if (slot.player?.id) {
          playersOnLockedCourts.add(slot.player.id)
        }
      })
    }
  })

  // Filter bench players
  const benchPlayers = checkedIn.filter((player) => {
    // Exclude players already assigned (unless reshuffle and not on locked court)
    if (isReshuffle) {
      // For reshuffle: exclude only players on locked courts
      if (playersOnLockedCourts.has(player.id)) return false
    } else {
      // For initial match: exclude all assigned players
      if (assignedIds.has(player.id)) return false
    }
    
    // Exclude unavailable players
    if (unavailablePlayers.has(player.id)) return false
    
    // Exclude "kun 1 runde" players in rounds 2+ (unless activated)
    if (selectedRound > 1 && player.maxRounds === 1 && !activatedOneRoundPlayers.has(player.id)) {
      return false
    }
    
    return true
  })

  if (benchPlayers.length === 0) {
    return { matches: [], result: { filledCourts: 0, benched: 0 } }
  }

  // Get available courts
  const allCourtIdxs = Array.from({ length: maxCourts }, (_, i) => i + 1)
  const occupiedCourts = new Set(
    currentMatches
      .filter((court) => court.slots.some((slot) => slot.player))
      .map((court) => court.courtIdx)
  )

  const availableCourtIdxs = allCourtIdxs.filter((idx) => {
    // Always exclude locked courts
    if (lockedCourtIdxs.has(idx)) return false
    // For reshuffle: include occupied courts (they'll be cleared)
    if (isReshuffle) return true
    // For initial match: exclude occupied courts
    return !occupiedCourts.has(idx)
  })

  if (availableCourtIdxs.length === 0) {
    return { matches: [], result: { filledCourts: 0, benched: benchPlayers.length } }
  }

  // Randomization seed
  let randomSeed = Date.now() % 10000
  const random = () => {
    randomSeed = (randomSeed * 9301 + 49297) % 233280
    return randomSeed / 233280
  }

  // Calculate total players (bench + locked courts)
  const totalPlayersCount = benchPlayers.length + playersOnLockedCourts.size
  const isOddTotal = totalPlayersCount % 2 === 1

  // Upper bound limit
  const MAX_PLAYERS_ON_COURTS = maxCourts * 8

  // Track assignments
  const assignments: Array<{ courtIdx: number; playerIds: string[] }> = []
  const usedPlayerIds = new Set<string>()
  let courtIdxIndex = 0

  // Helper functions for creating matches (defined after courtIdxIndex)
  const createRandomDoublesMatch = (players: CheckedInPlayer[]): { courtIdx: number; playerIds: string[] } | null => {
    if (players.length !== 4 || courtIdxIndex >= availableCourtIdxs.length) return null
    const shuffled = [...players].sort(() => random() - 0.5)
    const team1Indices = new Set<number>()
    while (team1Indices.size < 2) {
      team1Indices.add(Math.floor(random() * 4))
    }
    const team1 = Array.from(team1Indices).map((idx) => shuffled[idx].id)
    const team2 = shuffled.filter((_, idx) => !team1Indices.has(idx)).map((p) => p.id)
    return {
      courtIdx: availableCourtIdxs[courtIdxIndex++],
      playerIds: [...team1, ...team2]
    }
  }

  const createRandomSinglesMatch = (players: CheckedInPlayer[]): { courtIdx: number; playerIds: string[] } | null => {
    if (players.length < 2 || courtIdxIndex >= availableCourtIdxs.length) return null
    const shuffled = [...players].sort(() => random() - 0.5)
    const player1 = shuffled[0]
    const player2 = shuffled[Math.floor(random() * (shuffled.length - 1)) + 1]
    return {
      courtIdx: availableCourtIdxs[courtIdxIndex++],
      playerIds: [player1.id, player2.id]
    }
  }

  const create3PlayerMatch = (players: CheckedInPlayer[]): { courtIdx: number; playerIds: string[] } | null => {
    if (players.length < 3 || courtIdxIndex >= availableCourtIdxs.length) return null
    const shuffled = [...players].sort(() => random() - 0.5)
    const selected = shuffled.slice(0, 3)
    return {
      courtIdx: availableCourtIdxs[courtIdxIndex++],
      playerIds: selected.map(p => p.id)
    }
  }

  // Deduplicate players
  const remainingPlayersMap = new Map<string, CheckedInPlayer>()
  benchPlayers.forEach((p) => {
    if (!remainingPlayersMap.has(p.id)) {
      remainingPlayersMap.set(p.id, p)
    }
  })
  let remainingPlayers: CheckedInPlayer[] = Array.from(remainingPlayersMap.values())

  // Helper to count total assigned players
  const getTotalAssignedPlayers = () => {
    return assignments.reduce((total, assignment) => total + assignment.playerIds.length, 0)
  }

  // CRITICAL: If total players is odd, create ONE 3-player court FIRST
  if (isOddTotal) {
    const singlesEligible = remainingPlayers.filter((p) => p.primaryCategory !== 'Double')
    
    if (singlesEligible.length >= 3 && courtIdxIndex < availableCourtIdxs.length && getTotalAssignedPlayers() + 3 <= MAX_PLAYERS_ON_COURTS) {
      // Prioritize 3 males for fairer game
      const malesEligible = singlesEligible.filter((p) => p.gender === 'Herre')
      
      let playersFor3Court: CheckedInPlayer[]
      if (malesEligible.length >= 3) {
        playersFor3Court = malesEligible.slice(0, 3)
      } else {
        playersFor3Court = singlesEligible.slice(0, 3)
      }
      
      const match = create3PlayerMatch(playersFor3Court)
      if (match) {
        assignments.push(match)
        match.playerIds.forEach((id) => {
          usedPlayerIds.add(id)
          const idx = remainingPlayers.findIndex((p) => p.id === id)
          if (idx >= 0) remainingPlayers.splice(idx, 1)
        })
      }
    }
  }

  // Main algorithm: Maximum randomization with constraints
  while (remainingPlayers.length > 0 && courtIdxIndex < availableCourtIdxs.length && getTotalAssignedPlayers() < MAX_PLAYERS_ON_COURTS) {
    // Randomize player order every iteration
    remainingPlayers = [...remainingPlayers].sort(() => random() - 0.5)
    
    // Separate by category
    const doublesOnly: CheckedInPlayer[] = remainingPlayers.filter((p) => p.primaryCategory === 'Double')
    const singlesEligible: CheckedInPlayer[] = remainingPlayers.filter((p) => p.primaryCategory !== 'Double')
    
    // Try to create a match
    const canCreateDoubles = remainingPlayers.length >= 4
    const canCreateSingles = singlesEligible.length >= 2
    
    if (!canCreateDoubles && !canCreateSingles) {
      break
    }
    
    // Randomly choose match type
    const preferDoubles = canCreateDoubles && (remainingPlayers.length >= 6 || random() > 0.3)
    
    if (preferDoubles && canCreateDoubles) {
      const currentTotal = getTotalAssignedPlayers()
      if (currentTotal + 4 > MAX_PLAYERS_ON_COURTS) {
        const remainingSlots = MAX_PLAYERS_ON_COURTS - currentTotal
        if (remainingSlots >= 2) {
          const shuffled = [...remainingPlayers].sort(() => random() - 0.5)
          const selectedPlayers: CheckedInPlayer[] = shuffled.slice(0, remainingSlots)
          if (selectedPlayers.length >= 2) {
            const match = createRandomSinglesMatch(selectedPlayers)
            if (match) {
              assignments.push(match)
              selectedPlayers.forEach((p) => {
                usedPlayerIds.add(p.id)
                const idx = remainingPlayers.findIndex((rp) => rp.id === p.id)
                if (idx >= 0) remainingPlayers.splice(idx, 1)
              })
              continue
            }
          }
        }
        break
      }
      
      const shuffled = [...remainingPlayers].sort(() => random() - 0.5)
      const selectedPlayers: CheckedInPlayer[] = shuffled.slice(0, 4)
      const match = createRandomDoublesMatch(selectedPlayers)
      if (match) {
        assignments.push(match)
        selectedPlayers.forEach((p) => {
          usedPlayerIds.add(p.id)
          const idx = remainingPlayers.findIndex((rp) => rp.id === p.id)
          if (idx >= 0) remainingPlayers.splice(idx, 1)
        })
        continue
      }
    } else if (canCreateSingles) {
      const currentTotal = getTotalAssignedPlayers()
      if (currentTotal + 2 > MAX_PLAYERS_ON_COURTS) {
        break
      }
      
      const shuffled = [...singlesEligible].sort(() => random() - 0.5)
      const eligible: CheckedInPlayer[] = shuffled.filter((p) => !usedPlayerIds.has(p.id))
      
      if (eligible.length >= 2) {
        const match = createRandomSinglesMatch(eligible)
        if (match) {
          assignments.push(match)
          match.playerIds.forEach((id) => {
            usedPlayerIds.add(id)
            const idx = remainingPlayers.findIndex((p) => p.id === id)
            if (idx >= 0) remainingPlayers.splice(idx, 1)
          })
          continue
        }
      }
    }
    
    // Handle edge case: Double players but not enough for 2v2
    if (doublesOnly.length > 0 && remainingPlayers.length >= 2 && remainingPlayers.length < 4) {
      const players: CheckedInPlayer[] = []
      for (const p of doublesOnly) {
        if (!usedPlayerIds.has(p.id)) {
          players.push(p)
          usedPlayerIds.add(p.id)
        }
      }
      
      const shuffledSingles = [...singlesEligible].sort(() => random() - 0.5)
      for (const p of shuffledSingles) {
        if (players.length < 4 && !usedPlayerIds.has(p.id)) {
          players.push(p)
          usedPlayerIds.add(p.id)
        }
      }
      
      if (players.length === 4) {
        const currentTotal = getTotalAssignedPlayers()
        if (currentTotal + 4 > MAX_PLAYERS_ON_COURTS) {
          break
        }
        const match = createRandomDoublesMatch(players)
        if (match) {
          assignments.push(match)
          players.forEach((p) => {
            const idx = remainingPlayers.findIndex((rp) => rp.id === p.id)
            if (idx >= 0) remainingPlayers.splice(idx, 1)
          })
          continue
        }
      }
    }
    
    // If we have 2-3 players left and no Double players, create 1v1 (but check limit first)
    if (remainingPlayers.length >= 2 && doublesOnly.length === 0) {
      const currentTotal = getTotalAssignedPlayers()
      if (currentTotal + 2 > MAX_PLAYERS_ON_COURTS) {
        break
      }
      const match = createRandomSinglesMatch(remainingPlayers)
      if (match) {
        assignments.push(match)
        match.playerIds.forEach((id) => {
          usedPlayerIds.add(id)
          const idx = remainingPlayers.findIndex((p) => p.id === id)
          if (idx >= 0) remainingPlayers.splice(idx, 1)
        })
        continue
      }
    }
    
    // If we couldn't create a match, break to avoid infinite loop
    break
  }

  // Build matches structure
  const playersMap = new Map(checkedIn.map((p) => [p.id, p]))
  const matchesByCourt = new Map<number, CourtWithPlayers['slots']>()

  // Keep locked courts as-is
  currentMatches.forEach((court) => {
    if (lockedCourtIdxs.has(court.courtIdx)) {
      matchesByCourt.set(court.courtIdx, court.slots)
    }
  })

  // Add new assignments
  assignments.forEach(({ courtIdx, playerIds }) => {
    const maxCapacity = extendedCapacityCourts.get(courtIdx) || 4
    const slots: CourtWithPlayers['slots'] = []

    if (playerIds.length === 2) {
      // 1v1 match: slots 1 and 2
      const player1 = playersMap.get(playerIds[0])
      const player2 = playersMap.get(playerIds[1])
      if (player1) slots.push({ slot: 1, player: player1 })
      if (player2) slots.push({ slot: 2, player: player2 })
    } else if (playerIds.length === 3) {
      // 3-player match: slots 0, 1, 2
      for (let i = 0; i < 3; i++) {
        const player = playersMap.get(playerIds[i])
        if (player) slots.push({ slot: i, player })
      }
    } else if (playerIds.length === 4) {
      // 2v2 match: slots 0, 1, 2, 3
      for (let i = 0; i < 4; i++) {
        const player = playersMap.get(playerIds[i])
        if (player) slots.push({ slot: i, player })
      }
    }

    matchesByCourt.set(courtIdx, slots)
  })

  // Build final matches array (always include all courts)
  const matches: CourtWithPlayers[] = allCourtIdxs.map((courtIdx) => ({
    courtIdx,
    slots: (matchesByCourt.get(courtIdx) ?? []).sort((a, b) => a.slot - b.slot)
  }))

  return {
    matches,
    result: {
      filledCourts: assignments.length,
      benched: remainingPlayers.length
    }
  }
}

