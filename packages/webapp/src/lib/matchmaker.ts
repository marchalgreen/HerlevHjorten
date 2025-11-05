export type MatchmakerInput = {
  benchPlayerIds: string[]
  availableCourtIdxs: number[]
  slotsPerCourt?: number
}

export type MatchmakerAssignment = {
  courtIdx: number
  playerIds: string[]
}

export type MatchmakerResult = {
  assignments: MatchmakerAssignment[]
  leftoverPlayerIds: string[]
}

/** Default number of slots per court. */
const DEFAULT_SLOTS = 4

/**
 * Chunks players array into groups of specified size.
 * @param players - Array of player IDs
 * @param size - Chunk size
 * @returns Array of player ID chunks
 */
export const chunkPlayers = (players: string[], size: number): string[][] => {
  if (size <= 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < players.length; i += size) {
    chunks.push(players.slice(i, i + size))
  }
  return chunks
}

/**
 * Builds court assignments from bench players.
 * @param benchPlayerIds - Array of player IDs on bench
 * @param availableCourtIdxs - Array of available court indices
 * @param slotsPerCourt - Number of slots per court (default: 4)
 * @returns Assignments and leftover players
 * @remarks Simple assignment algorithm — chunks players into groups and assigns to courts.
 */
export const buildAssignments = ({
  benchPlayerIds,
  availableCourtIdxs,
  slotsPerCourt = DEFAULT_SLOTS
}: MatchmakerInput): MatchmakerResult => {
  const chunks = chunkPlayers(benchPlayerIds, slotsPerCourt)
  const assignments: MatchmakerAssignment[] = []
  const leftover: string[] = []

  for (let i = 0; i < chunks.length; i += 1) {
    const courtIdx = availableCourtIdxs[i]
    if (courtIdx === undefined) {
      leftover.push(...chunks.slice(i).flat())
      break
    }
    assignments.push({
      courtIdx,
      playerIds: chunks[i]
    })
  }

  if (chunks.length === 0 && benchPlayerIds.length > 0) {
    leftover.push(...benchPlayerIds)
  }

  return { assignments, leftoverPlayerIds: leftover }
}
