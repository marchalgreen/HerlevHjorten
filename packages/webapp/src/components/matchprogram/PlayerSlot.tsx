/**
 * Player slot component for match program.
 * 
 * Renders a single player slot with drag-and-drop support and swap detection.
 */

import React, { useEffect, useState } from 'react'
import type { CourtWithPlayers, Player } from '@rundeklar/common'
import { getCategoryLetter, getPlayerSlotBgColor } from '../../lib/matchProgramUtils'
import { formatPlayerCardName } from '../../lib/formatting'
import { InitialsAvatar, getSeedHue } from '../ui/PlayerAvatar'
import { getPlayerUiVariant, VARIANT_CHANGED_EVENT, type PlayerUiVariant } from '../../lib/uiVariants'

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
  const [variant, setVariant] = useState<PlayerUiVariant>(() => getPlayerUiVariant())
  useEffect(() => {
    const onChange = (e: Event) => {
      const ev = e as CustomEvent
      setVariant(ev.detail?.variant ?? getPlayerUiVariant())
    }
    window.addEventListener(VARIANT_CHANGED_EVENT, onChange as EventListener)
    return () => window.removeEventListener(VARIANT_CHANGED_EVENT, onChange as EventListener)
  }, [])
  const entry = court.slots.find((slot) => slot.slot === slotIndex)
  const player = entry?.player
  const isDragOver = dragOverSlot?.courtIdx === court.courtIdx && dragOverSlot?.slot === slotIndex
  const isCourtHovered = dragOverCourt === court.courtIdx && !player
  const isDragOverOccupied = isDragOver && !!player
  const isRecentlySwapped = player && recentlySwappedPlayers.has(player.id)
  const isDuplicatePlayer = player && duplicatePlayersMap.get(court.courtIdx)?.has(player.id)
  const _catLetter = player ? getCategoryLetter(player.primaryCategory) : null

  // Compute avatar rail color for variant A
  const avatarRailColor = (() => {
    if (variant !== 'A' || !player) return undefined
    const hue = getSeedHue(player.id || player.name, player.gender ?? null)
    return `hsl(${hue} 70% 75% / .26)`
  })()

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
      className={`flex items-center gap-2 rounded-md px-2.5 py-2.5 sm:px-3 sm:py-3 xl:px-2.5 xl:py-2 h-[64px] sm:h-[72px] xl:h-[68px] w-full transition-all motion-reduce:transition-none ${
        isRecentlySwapped
          ? `${getPlayerSlotBgColor()} avatar-rail animate-swap-in ring-2 ring-[hsl(var(--primary)/.5)] shadow-lg hover:shadow-sm cursor-grab active:cursor-grabbing ring-1 ring-[hsl(var(--line)/.12)]`
          : isDragOverOccupied && player
          ? `${getPlayerSlotBgColor()} avatar-rail ring-2 ring-[hsl(var(--primary)/.6)] shadow-lg hover:shadow-sm cursor-grab active:cursor-grabbing ring-1 ring-[hsl(var(--line)/.12)]`
          : player
          ? `${getPlayerSlotBgColor()} avatar-rail hover:shadow-sm cursor-grab active:cursor-grabbing ring-1 ring-[hsl(var(--line)/.12)]`
          : isDragOver
          ? 'bg-[hsl(var(--primary)/.15)] ring-2 ring-[hsl(var(--primary)/.5)] shadow-md ring-1 ring-[hsl(var(--line)/.12)]'
          : isCourtHovered
          ? 'bg-[hsl(var(--primary)/.08)] ring-1 ring-[hsl(var(--primary)/.3)]'
          : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] ring-1 ring-[hsl(var(--line)/.12)]'
      }`}
      data-cat={undefined}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        ...(variant === 'A' && avatarRailColor ? ({ ['--railColor' as any]: avatarRailColor } as React.CSSProperties) : {}),
      }}
    >
      {player ? (
        <>
          <div className="min-w-0 flex-1">
            {fullScreen ? (
              // Full-screen: icon and name on same row, larger font
              <div className="flex items-center gap-2">
                <InitialsAvatar seed={player.id} name={player.name} gender={player.gender ?? null} />
                <p className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))] truncate">{formatPlayerCardName(player.name, player.alias)}</p>
                {isDuplicatePlayer && (
                  <span className="inline-flex h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--destructive)/.3)] text-[9px] sm:text-[10px] font-bold text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive)/.4)]">
                    !
                  </span>
                )}
              </div>
            ) : (
              // Normal view: icon and name on same row
              <div className="flex items-center gap-2">
                <InitialsAvatar seed={player.id} name={player.name} gender={player.gender ?? null} />
                <p className={`font-semibold text-[hsl(var(--foreground))] truncate text-sm sm:text-base`}>{formatPlayerCardName(player.name, player.alias)}</p>
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

