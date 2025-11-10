/**
 * Player slot component for match program.
 * 
 * Renders a single player slot with drag-and-drop support and swap detection.
 */

import React from 'react'
import type { CourtWithPlayers, Player } from '@herlev-hjorten/common'
import { getCategoryLetter, getCategoryBadge, getPlayerSlotBgColor } from '../../lib/matchProgramUtils'

interface PlayerSlotProps {
  /** Court data */
  court: CourtWithPlayers
  /** Slot index to render */
  slotIndex: number
  /** Whether in full-screen mode (uses larger font) */
  fullScreen?: boolean
  /** Drag over state for this slot */
  dragOverSlot: { courtIdx: number; slot: number } | null
  /** Drag over state for the court */
  dragOverCourt: number | null
  /** Set of recently swapped player IDs */
  recentlySwappedPlayers: Set<string>
  /** Map of court to duplicate player IDs */
  duplicatePlayersMap: Map<number, Set<string>>
  /** Handler for drag start */
  onDragStart: (event: React.DragEvent<HTMLDivElement>, player: Player) => void
  /** Handler for drag end */
  onDragEnd: () => void
  /** Handler for drag over */
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  /** Handler for drag leave */
  onDragLeave: () => void
  /** Handler for drop */
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
}

/**
 * Player slot component.
 * 
 * @example
 * ```tsx
 * <PlayerSlot
 *   court={court}
 *   slotIndex={0}
 *   dragOverSlot={dragOverSlot}
 *   dragOverCourt={dragOverCourt}
 *   recentlySwappedPlayers={recentlySwappedPlayers}
 *   duplicatePlayersMap={duplicatePlayersMap}
 *   onDragStart={handleDragStart}
 *   onDragEnd={handleDragEnd}
 *   onDragOver={handleDragOver}
 *   onDragLeave={handleDragLeave}
 *   onDrop={handleDrop}
 * />
 * ```
 */
export const PlayerSlot: React.FC<PlayerSlotProps> = ({
  court,
  slotIndex,
  fullScreen = false,
  dragOverSlot,
  dragOverCourt,
  recentlySwappedPlayers,
  duplicatePlayersMap,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop
}) => {
  const entry = court.slots.find((slot) => slot.slot === slotIndex)
  const player = entry?.player
  const isDragOver = dragOverSlot?.courtIdx === court.courtIdx && dragOverSlot?.slot === slotIndex
  const isCourtHovered = dragOverCourt === court.courtIdx && !player
  const isDragOverOccupied = isDragOver && !!player
  const isRecentlySwapped = player && recentlySwappedPlayers.has(player.id)
  const isDuplicatePlayer = player && duplicatePlayersMap.get(court.courtIdx)?.has(player.id)
  const catLetter = player ? getCategoryLetter(player.primaryCategory) : null

  return (
    <div
      key={slotIndex}
      draggable={!!player}
      onDragStart={(event: React.DragEvent<HTMLDivElement>) => {
        if (player) {
          onDragStart(event, player)
        }
      }}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2 rounded-md px-2.5 py-2.5 sm:px-3 sm:py-3 h-[64px] sm:h-[72px] w-full transition-all motion-reduce:transition-none ${
        isRecentlySwapped
          ? `${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''} animate-swap-in ring-2 ring-[hsl(var(--primary)/.5)] shadow-lg hover:shadow-sm cursor-grab active:cursor-grabbing ring-1 ring-[hsl(var(--line)/.12)]`
          : isDragOverOccupied && player
          ? `${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''} ring-2 ring-[hsl(var(--primary)/.6)] shadow-lg hover:shadow-sm cursor-grab active:cursor-grabbing ring-1 ring-[hsl(var(--line)/.12)]`
          : player
          ? `${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''} hover:shadow-sm cursor-grab active:cursor-grabbing ring-1 ring-[hsl(var(--line)/.12)]`
          : isDragOver
          ? 'bg-[hsl(var(--primary)/.15)] ring-2 ring-[hsl(var(--primary)/.5)] shadow-md ring-1 ring-[hsl(var(--line)/.12)]'
          : isCourtHovered
          ? 'bg-[hsl(var(--primary)/.08)] ring-1 ring-[hsl(var(--primary)/.3)]'
          : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] ring-1 ring-[hsl(var(--line)/.12)]'
      }`}
      data-cat={catLetter || undefined}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {player ? (
        <>
          <div className="min-w-0 flex-1">
            {fullScreen ? (
              // Full-screen: icon and name on same row, larger font
              <div className="flex items-center gap-2">
                {getCategoryBadge(player.primaryCategory)}
                <p className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))] truncate">{player.alias ?? player.name}</p>
                {isDuplicatePlayer && (
                  <span className="inline-flex h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--destructive)/.3)] text-[9px] sm:text-[10px] font-bold text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive)/.4)]">
                    !
                  </span>
                )}
              </div>
            ) : (
              // Normal view: icon and name on same row
              <div className="flex items-center gap-2">
                {getCategoryBadge(player.primaryCategory)}
                <p className="text-sm sm:text-base font-semibold text-[hsl(var(--foreground))] truncate">{player.alias ?? player.name}</p>
                {isDuplicatePlayer && (
                  <span className="inline-flex h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--destructive)/.3)] text-[7px] sm:text-[8px] font-bold text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive)/.4)]">
                    !
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

