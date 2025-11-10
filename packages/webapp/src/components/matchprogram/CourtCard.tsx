/**
 * Court card component for match program.
 * 
 * Displays a single court with players, lock controls, and extended capacity options.
 */

import React from 'react'
import type { CourtWithPlayers, Player } from '@herlev-hjorten/common'
import { PageCard } from '../ui'
import { PlayerSlot } from './PlayerSlot'
import { MATCH_CONSTANTS } from '../../constants'

interface CourtCardProps {
  /** Court data */
  court: CourtWithPlayers
  /** Extended capacity courts map */
  extendedCapacityCourts: Map<number, number>
  /** Handler to update extended capacity */
  onExtendedCapacityChange: (courtIdx: number, capacity: number | null) => void
  /** Whether court has duplicates */
  hasDuplicates: boolean
  /** Whether court is locked */
  isLocked: boolean
  /** Handler to toggle court lock */
  onToggleLock: (courtIdx: number) => void
  /** Drag over state for court */
  dragOverCourt: number | null
  /** Drag over state for slot */
  dragOverSlot: { courtIdx: number; slot: number } | null
  /** Recently swapped players */
  recentlySwappedPlayers: Set<string>
  /** Map of duplicate players */
  duplicatePlayersMap: Map<number, Set<string>>
  /** Handler for drag over court */
  onCourtDragOver: (event: React.DragEvent<HTMLDivElement>, courtIdx: number) => void
  /** Handler for drag leave court */
  onCourtDragLeave: () => void
  /** Handler for drop on court */
  onCourtDrop: (event: React.DragEvent<HTMLDivElement>, courtIdx: number) => void
  /** Handler for drag start on slot */
  onSlotDragStart: (event: React.DragEvent<HTMLDivElement>, player: Player, courtIdx: number, slotIndex: number) => void
  /** Handler for drag end on slot */
  onSlotDragEnd: () => void
  /** Handler for drag over slot */
  onSlotDragOver: (event: React.DragEvent<HTMLDivElement>, courtIdx: number, slotIndex: number) => void
  /** Handler for drag leave slot */
  onSlotDragLeave: () => void
  /** Handler for drop on slot */
  onSlotDrop: (event: React.DragEvent<HTMLDivElement>, courtIdx: number, slotIndex: number) => void
}

const EMPTY_SLOTS = MATCH_CONSTANTS.DEFAULT_SLOTS_PER_COURT

/**
 * Court card component.
 * 
 * @example
 * ```tsx
 * <CourtCard
 *   court={court}
 *   extendedCapacityCourts={extendedCapacityCourts}
 *   onExtendedCapacityChange={handleExtendedCapacityChange}
 *   hasDuplicates={false}
 *   isLocked={false}
 *   onToggleLock={handleToggleLock}
 *   dragOverCourt={null}
 *   dragOverSlot={null}
 *   recentlySwappedPlayers={new Set()}
 *   duplicatePlayersMap={new Map()}
 *   onCourtDragOver={handleCourtDragOver}
 *   onCourtDragLeave={handleCourtDragLeave}
 *   onCourtDrop={handleCourtDrop}
 *   onSlotDragStart={handleSlotDragStart}
 *   onSlotDragEnd={handleSlotDragEnd}
 *   onSlotDragOver={handleSlotDragOver}
 *   onSlotDragLeave={handleSlotDragLeave}
 *   onSlotDrop={handleSlotDrop}
 * />
 * ```
 */
export const CourtCard: React.FC<CourtCardProps> = ({
  court,
  extendedCapacityCourts,
  onExtendedCapacityChange,
  hasDuplicates,
  isLocked,
  onToggleLock,
  dragOverCourt,
  dragOverSlot,
  recentlySwappedPlayers,
  duplicatePlayersMap,
  onCourtDragOver,
  onCourtDragLeave,
  onCourtDrop,
  onSlotDragStart,
  onSlotDragEnd,
  onSlotDragOver,
  onSlotDragLeave,
  onSlotDrop
}) => {
  const maxCapacity = extendedCapacityCourts.get(court.courtIdx) || 4
  const courtCapacity = extendedCapacityCourts.get(court.courtIdx)
  const hasExtendedCapacity: boolean = Boolean(courtCapacity && courtCapacity > 4)
  const hasPlayers = court.slots.some((slot) => slot.player)

  const renderNetDivider = () => (
    <div className="relative flex items-center justify-center py-1">
      <div className="absolute inset-0 flex items-center">
        <div className="h-px w-full bg-[hsl(var(--line)/.3)]"></div>
      </div>
      <div className="relative bg-[hsl(var(--surface))] px-2">
        <div className="h-1 w-8 rounded-full bg-[hsl(var(--primary)/.2)] ring-1 ring-[hsl(var(--primary)/.3)]"></div>
      </div>
    </div>
  )

  const renderRegularDivider = () => (
    <div className="relative flex items-center justify-center py-0.5">
      <div className="h-px w-full bg-[hsl(var(--primary)/.3)]"></div>
    </div>
  )

  const renderSlotGroup = (startIndex: number, count: number) => (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: count }).map((_, idx) => {
        const slotIndex = startIndex + idx
        const entry = court.slots.find((slot) => slot.slot === slotIndex)
        const player = entry?.player
        return (
          <PlayerSlot
            key={slotIndex}
            court={court}
            slotIndex={slotIndex}
            fullScreen={false}
            dragOverSlot={dragOverSlot}
            dragOverCourt={dragOverCourt}
            recentlySwappedPlayers={recentlySwappedPlayers}
            duplicatePlayersMap={duplicatePlayersMap}
            onDragStart={(event, p) => onSlotDragStart(event, p, court.courtIdx, slotIndex)}
            onDragEnd={onSlotDragEnd}
            onDragOver={(event) => onSlotDragOver(event, court.courtIdx, slotIndex)}
            onDragLeave={onSlotDragLeave}
            onDrop={(event) => onSlotDrop(event, court.courtIdx, slotIndex)}
          />
        )
      })}
    </div>
  )

  const renderCourtSlots = () => {
    if (maxCapacity === 8) {
      return (
        <>
          {renderSlotGroup(0, 2)}
          {renderNetDivider()}
          {renderSlotGroup(2, 2)}
          {renderRegularDivider()}
          {renderSlotGroup(4, 2)}
          {renderNetDivider()}
          {renderSlotGroup(6, 2)}
        </>
      )
    } else if (maxCapacity === 6) {
      return (
        <>
          {renderSlotGroup(0, 3)}
          {renderNetDivider()}
          {renderSlotGroup(3, 3)}
        </>
      )
    } else if (maxCapacity === 4) {
      return (
        <>
          {renderSlotGroup(0, 2)}
          {renderNetDivider()}
          {renderSlotGroup(2, 2)}
        </>
      )
    } else {
      return (
        <>
          {renderSlotGroup(0, maxCapacity)}
        </>
      )
    }
  }

  return (
    <PageCard
      key={court.courtIdx}
      hover={false}
      className={`space-y-2 hover:shadow-md p-3 sm:p-4 transition-all duration-200 relative ${
        hasDuplicates
          ? 'ring-2 ring-[hsl(var(--destructive)/.45)] border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.03)]'
          : dragOverCourt === court.courtIdx
          ? 'ring-2 ring-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.05)] shadow-lg'
          : ''
      }`}
      onDragOver={(event) => onCourtDragOver(event, court.courtIdx)}
      onDragLeave={onCourtDragLeave}
      onDrop={(event) => onCourtDrop(event, court.courtIdx)}
    >
      <header className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-[hsl(var(--foreground))]">Bane {court.courtIdx}</h3>
          {hasDuplicates && (
            <span className="group relative">
              <span className="inline-flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-[hsl(var(--destructive)/.2)] text-[9px] sm:text-[10px] font-bold text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive)/.3)]">
                !
              </span>
              <span className="absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[hsl(var(--surface-2))] px-2 py-1 text-xs sm:text-sm text-[hsl(var(--foreground))] shadow-lg ring-1 ring-[hsl(var(--line)/.12)] group-hover:block">
                3+ spillere har allerede spillet sammen i en tidligere runde
              </span>
            </span>
          )}
          {/* Lock Toggle and Icon - always show when court has players */}
          {hasPlayers && (
            <>
              {/* Lock Toggle Switch */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleLock(court.courtIdx)
                }}
                className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-2 items-center justify-start ${
                  isLocked
                    ? 'bg-[hsl(var(--primary))]'
                    : 'bg-[hsl(var(--surface-2))]'
                }`}
                role="switch"
                aria-checked={isLocked ? ('true' as const) : ('false' as const)}
                title={isLocked ? 'Lås op' : 'Lås bane'}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isLocked
                      ? 'translate-x-3'
                      : 'translate-x-0.5'
                  }`}
                  style={{
                    marginTop: '0',
                    marginBottom: '0'
                  }}
                />
              </button>
              {/* Lock Icon */}
              <svg
                className={`h-3.5 w-3.5 transition-colors duration-200 ml-1.5 ${
                  isLocked
                    ? 'text-[hsl(var(--primary))]'
                    : 'text-[hsl(var(--muted))]'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <title>{isLocked ? 'Bane er låst - vil ikke blive ændret ved auto-match/omfordel' : 'Bane er ikke låst'}</title>
                {isLocked ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                )}
              </svg>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center gap-2">
            {/* Capacity Selector - shown when extended capacity is enabled */}
            {hasExtendedCapacity && (
              <select
                value={extendedCapacityCourts.get(court.courtIdx) || 8}
                onChange={(e) => {
                  const capacity = Number(e.target.value)
                  onExtendedCapacityChange(court.courtIdx, capacity)
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-5 w-8 rounded border-0 bg-[hsl(var(--surface-2))] text-[10px] font-semibold text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--line)/.12)] focus:ring-1 focus:ring-[hsl(var(--primary))] text-center leading-[20px]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%23666' d='M4 6L1 3h6z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 2px center',
                  backgroundSize: '8px 8px',
                  appearance: 'none',
                  paddingRight: '10px',
                  paddingLeft: '0px',
                  textAlign: 'center',
                  textAlignLast: 'center'
                }}
              >
                <option value={5}>5</option>
                <option value={6}>6</option>
                <option value={7}>7</option>
                <option value={8}>8</option>
              </select>
            )}
            
            {/* Toggle Switch */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (hasExtendedCapacity) {
                  onExtendedCapacityChange(court.courtIdx, null)
                } else {
                  onExtendedCapacityChange(court.courtIdx, 8)
                }
              }}
              className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-2 items-center justify-start ${
                hasExtendedCapacity
                  ? 'bg-[hsl(var(--primary))]'
                  : 'bg-[hsl(var(--surface-2))]'
              }`}
              role="switch"
              aria-checked={hasExtendedCapacity ? ('true' as const) : ('false' as const)}
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  hasExtendedCapacity
                    ? 'translate-x-3'
                    : 'translate-x-0.5'
                }`}
                style={{
                  marginTop: '0',
                  marginBottom: '0'
                }}
              />
            </button>
          </div>
          <span className="text-[10px] sm:text-xs text-[hsl(var(--muted))]">{court.slots.length}/{maxCapacity}</span>
        </div>
      </header>
      
      {/* Court visualization: two halves with net divider */}
      <div className="flex flex-col gap-2">
        {renderCourtSlots()}
      </div>
    </PageCard>
  )
}

