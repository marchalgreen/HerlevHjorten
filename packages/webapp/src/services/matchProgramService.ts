/**
 * Business logic service for match program functionality.
 * 
 * Handles player filtering, duplicate detection, and court management.
 */

import type { CheckedInPlayer, CourtWithPlayers, Player } from '@rundeklar/common'
import { sortPlayersForDisplay, ensureAllCourtsPresent } from '../lib/matchProgramUtils'

/**
 * Filters players for the bench (available players not assigned to courts).
 * 
 * @param checkedIn - All checked-in players
 * @param assignedIds - Set of player IDs already assigned to courts
 * @param selectedRound - Current round number
 * @param unavailablePlayers - Set of unavailable player IDs
 * @param activatedOneRoundPlayers - Set of activated one-round player IDs
 * @returns Filtered and sorted bench players
 */
export const filterBenchPlayers = (
  checkedIn: CheckedInPlayer[],
  assignedIds: Set<string>,
  selectedRound: number,
  unavailablePlayers: Set<string>,
  activatedOneRoundPlayers: Set<string>
): CheckedInPlayer[] => {
  const filtered: CheckedInPlayer[] = checkedIn.filter((player) => {
    // Exclude players already assigned to a court
    if (assignedIds.has(player.id)) return false
    // Exclude players who only want to play 1 round if we're viewing rounds 2 or 3
    // UNLESS they've been manually activated
    if (selectedRound > 1 && player.maxRounds === 1 && !activatedOneRoundPlayers.has(player.id)) return false
    // Exclude players marked as unavailable/injured
    if (unavailablePlayers.has(player.id)) return false
    return true
  })
  // sortPlayersForDisplay is generic and preserves the input type
  return sortPlayersForDisplay<CheckedInPlayer>(filtered)
}

/**
 * Filters players for the inactive section (one-round-only or unavailable players).
 * 
 * @param checkedIn - All checked-in players
 * @param assignedIds - Set of player IDs already assigned to courts
 * @param selectedRound - Current round number
 * @param unavailablePlayers - Set of unavailable player IDs
 * @param activatedOneRoundPlayers - Set of activated one-round player IDs
 * @returns Filtered and sorted inactive players
 */
export const filterInactivePlayers = (
  checkedIn: CheckedInPlayer[],
  assignedIds: Set<string>,
  selectedRound: number,
  unavailablePlayers: Set<string>,
  activatedOneRoundPlayers: Set<string>
): CheckedInPlayer[] => {
  const filtered: CheckedInPlayer[] = checkedIn.filter((player) => {
    // Exclude players already assigned to a court
    if (assignedIds.has(player.id)) return false
    // Include players who only want to play 1 round if we're viewing rounds 2 or 3
    // UNLESS they've been manually activated
    const isOneRoundOnly = selectedRound > 1 && player.maxRounds === 1 && !activatedOneRoundPlayers.has(player.id)
    // Include players marked as unavailable/injured
    const isUnavailable = unavailablePlayers.has(player.id)
    return isOneRoundOnly || isUnavailable
  })
  // sortPlayersForDisplay is generic and preserves the input type
  return sortPlayersForDisplay<CheckedInPlayer>(filtered)
}

/**
 * Checks if a court has a duplicate matchup with previous rounds.
 * A duplicate is defined as 3+ players from the current court having played together in a previous round.
 * 
 * @param court - Current court to check
 * @param previousRoundsMatches - Map of round number to matches for that round
 * @param selectedRound - Current round number
 * @returns True if duplicate matchup found, false otherwise
 */
export const hasDuplicateMatchup = (
  court: CourtWithPlayers,
  previousRoundsMatches: Record<number, CourtWithPlayers[]>,
  selectedRound: number
): boolean => {
  if (selectedRound <= 1) return false
  
  const currentPlayerIds = court.slots
    .map((slot) => slot.player?.id)
    .filter((id): id is string => !!id)
  
  if (currentPlayerIds.length < 3) return false
  
  // Check all previous rounds
  for (let round = 1; round < selectedRound; round++) {
    const previousMatches = previousRoundsMatches[round]
    if (!previousMatches) continue
    
    for (const previousCourt of previousMatches) {
      const previousPlayerIds = previousCourt.slots
        .map((slot) => slot.player?.id)
        .filter((id): id is string => !!id)
      
      // Count how many players from current court were in previous court
      const overlap = currentPlayerIds.filter((id) => previousPlayerIds.includes(id))
      
      if (overlap.length >= 3) {
        return true // Found a duplicate match with 3+ same players
      }
    }
  }
  
  return false
}

/**
 * Finds all duplicate matchups across all courts for the current round.
 * 
 * @param matches - Current round matches
 * @param previousRoundsMatches - Map of round number to matches for that round
 * @param selectedRound - Current round number
 * @returns Object with set of court indices with duplicates and map of court to duplicate player IDs
 */
export const findDuplicateMatchups = (
  matches: CourtWithPlayers[],
  previousRoundsMatches: Record<number, CourtWithPlayers[]>,
  selectedRound: number
): {
  courtsWithDuplicates: Set<number>
  duplicatePlayersMap: Map<number, Set<string>>
} => {
  const courtsWithDuplicates = new Set<number>()
  const duplicatePlayersMap = new Map<number, Set<string>>()
  
  if (selectedRound <= 1) {
    return { courtsWithDuplicates, duplicatePlayersMap }
  }
  
  for (const court of matches) {
    const currentPlayerIds = court.slots
      .map((slot) => slot.player?.id)
      .filter((id): id is string => !!id)
    
    if (currentPlayerIds.length < 3) continue
    
    const duplicatePlayerIds = new Set<string>()
    
    // Check all previous rounds
    for (let round = 1; round < selectedRound; round++) {
      const previousMatches = previousRoundsMatches[round]
      if (!previousMatches) continue
      
      for (const previousCourt of previousMatches) {
        const previousPlayerIds = previousCourt.slots
          .map((slot) => slot.player?.id)
          .filter((id): id is string => !!id)
        
        // Count how many players from current court were in previous court
        const overlap = currentPlayerIds.filter((id) => previousPlayerIds.includes(id))
        
        if (overlap.length >= 3) {
          // Found a duplicate - mark all overlapping players
          overlap.forEach((id) => duplicatePlayerIds.add(id))
          courtsWithDuplicates.add(court.courtIdx)
        }
      }
    }
    
    if (duplicatePlayerIds.size > 0) {
      duplicatePlayersMap.set(court.courtIdx, duplicatePlayerIds)
    }
  }
  
  return { courtsWithDuplicates, duplicatePlayersMap }
}

/**
 * Gets occupied courts (courts with at least one player).
 * 
 * @param matches - Current round matches
 * @returns Set of occupied court indices
 */
export const getOccupiedCourts = (matches: CourtWithPlayers[]): Set<number> => {
  const occupied = new Set<number>()
  matches.forEach((court) => {
    if (court.slots.some((slot) => slot.player)) {
      occupied.add(court.courtIdx)
    }
  })
  return occupied
}

/**
 * Ensures all courts are present in matches array and fills in missing courts.
 * 
 * @param matches - Array of court matches
 * @param maxCourts - Maximum number of courts
 * @returns Complete array with all courts (1 to maxCourts)
 */
export const ensureAllCourts = (
  matches: CourtWithPlayers[],
  maxCourts: number
): CourtWithPlayers[] => {
  return ensureAllCourtsPresent(matches, maxCourts)
}

