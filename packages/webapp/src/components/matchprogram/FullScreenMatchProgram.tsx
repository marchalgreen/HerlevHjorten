/**
 * Full-screen match program view component.
 * 
 * Displays courts in a full-screen grid layout optimized for viewing.
 */

import React from 'react'
import type { CourtWithPlayers, Player } from '@herlev-hjorten/common'
import { PageCard } from '../ui'
import { PlayerSlot } from './PlayerSlot'
import { MATCH_CONSTANTS } from '../../constants'

interface FullScreenMatchProgramProps {
  /** Courts to display */
  courts: CourtWithPlayers[]
  /** Selected round number */
  selectedRound: number
  /** Handler for round change */
  onRoundChange: (round: number) => void
  /** Handler to exit full-screen */
  onExitFullScreen: () => void
  /** Viewport size */
  viewportSize: { width: number; height: number }
  /** Extended capacity courts map */
  extendedCapacityCourts: Map<number, number>
  /** Set of courts with duplicates */
  courtsWithDuplicatesSet: Set<number>
  /** Map of duplicate players */
  duplicatePlayersMap: Map<number, Set<string>>
  /** Drag over state for slot */
  dragOverSlot: { courtIdx: number; slot: number } | null
  /** Drag over state for court */
  dragOverCourt: number | null
  /** Recently swapped players */
  recentlySwappedPlayers: Set<string>
  /** Handler for drag start */
  onSlotDragStart: (event: React.DragEvent<HTMLDivElement>, player: Player, courtIdx: number, slotIndex: number) => void
  /** Handler for drag end */
  onSlotDragEnd: () => void
  /** Handler for drag over */
  onSlotDragOver: (event: React.DragEvent<HTMLDivElement>, courtIdx: number, slotIndex: number) => void
  /** Handler for drag leave */
  onSlotDragLeave: () => void
  /** Handler for drop */
  onSlotDrop: (event: React.DragEvent<HTMLDivElement>, courtIdx: number, slotIndex: number) => void
}

const EMPTY_SLOTS = MATCH_CONSTANTS.DEFAULT_SLOTS_PER_COURT

/**
 * Full-screen match program view.
 * 
 * @example
 * ```tsx
 * <FullScreenMatchProgram
 *   courts={courts}
 *   selectedRound={1}
 *   onRoundChange={setSelectedRound}
 *   onExitFullScreen={() => setIsFullScreen(false)}
 *   viewportSize={viewportSize}
 *   extendedCapacityCourts={extendedCapacityCourts}
 *   courtsWithDuplicatesSet={courtsWithDuplicatesSet}
 *   duplicatePlayersMap={duplicatePlayersMap}
 *   dragOverSlot={dragOverSlot}
 *   dragOverCourt={dragOverCourt}
 *   recentlySwappedPlayers={recentlySwappedPlayers}
 *   slotHandlers={slotHandlers}
 * />
 * ```
 */
export const FullScreenMatchProgram: React.FC<FullScreenMatchProgramProps> = ({
  courts,
  selectedRound,
  onRoundChange,
  onExitFullScreen,
  viewportSize,
  extendedCapacityCourts,
  courtsWithDuplicatesSet,
  duplicatePlayersMap,
  dragOverSlot,
  dragOverCourt,
  recentlySwappedPlayers,
  onSlotDragStart,
  onSlotDragEnd,
  onSlotDragOver,
  onSlotDragLeave,
  onSlotDrop
}) => {
  // Filter to only show courts with players
  const courtsWithPlayers = courts.filter(court => court.slots.length > 0)
  
  // Calculate optimal grid layout
  const headerHeight = 80
  const padding = 48
  const gap = 16
  const availableHeight = viewportSize.height - headerHeight - padding
  const availableWidth = viewportSize.width - padding
  const numCourts = courtsWithPlayers.length
  
  const maxCapacity = numCourts > 0 ? Math.max(...courtsWithPlayers.map(c => extendedCapacityCourts.get(c.courtIdx) || 4)) : 4
  const cardHeaderHeight = 60
  const cardPadding = 40
  const slotHeight = 72
  const slotGap = 8
  const dividerHeight = 20
  const numDividers = maxCapacity === 8 ? 3 : maxCapacity === 6 ? 2 : 1
  const requiredCardHeight = cardHeaderHeight + cardPadding + (maxCapacity * slotHeight) + ((maxCapacity - 1) * slotGap) + (numDividers * dividerHeight)
  
  let optimalCols = 1
  let optimalRows = numCourts
  
  if (numCourts === 0) {
    optimalCols = 1
    optimalRows = 1
  } else {
    let evenCols = 4
    let evenRows = Math.ceil(numCourts / evenCols)
    
    if (numCourts <= 4) {
      evenCols = 2
      evenRows = Math.ceil(numCourts / evenCols)
    } else if (numCourts === 5) {
      evenCols = 3
      evenRows = 2
    } else if (numCourts === 6) {
      evenCols = 3
      evenRows = 2
    } else if (numCourts === 7) {
      evenCols = 4
      evenRows = 2
    } else if (numCourts === 8) {
      evenCols = 4
      evenRows = 2
    } else {
      evenCols = 4
      evenRows = Math.ceil(numCourts / evenCols)
    }
    
    optimalCols = evenCols
    optimalRows = evenRows
  }
  
  const minColWidth = 280
  const maxColWidth = Math.floor((availableWidth - (gap * (optimalCols - 1))) / optimalCols)
  const colWidth = Math.max(minColWidth, Math.min(maxColWidth, 450))
  
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
  
  const renderSlotGroup = (court: CourtWithPlayers, startIndex: number, count: number) => (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, idx) => {
        const slotIndex = startIndex + idx
        const entry = court.slots.find((slot) => slot.slot === slotIndex)
        const player = entry?.player
        return (
          <PlayerSlot
            key={slotIndex}
            court={court}
            slotIndex={slotIndex}
            fullScreen={true}
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
  
  const renderCourtSlots = (court: CourtWithPlayers) => {
    const maxCapacity = extendedCapacityCourts.get(court.courtIdx) || 4
    
    if (maxCapacity === 8) {
      return (
        <>
          {renderSlotGroup(court, 0, 2)}
          {renderNetDivider()}
          {renderSlotGroup(court, 2, 2)}
          {renderRegularDivider()}
          {renderSlotGroup(court, 4, 2)}
          {renderNetDivider()}
          {renderSlotGroup(court, 6, 2)}
        </>
      )
    } else if (maxCapacity === 6) {
      return (
        <>
          {renderSlotGroup(court, 0, 3)}
          {renderNetDivider()}
          {renderSlotGroup(court, 3, 3)}
        </>
      )
    } else if (maxCapacity === 4) {
      return (
        <>
          {renderSlotGroup(court, 0, 2)}
          {renderNetDivider()}
          {renderSlotGroup(court, 2, 2)}
        </>
      )
    } else {
      return (
        <>
          {renderSlotGroup(court, 0, maxCapacity)}
        </>
      )
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 bg-[hsl(var(--bg-canvas))] flex flex-col">
      <header className="flex items-center justify-between p-3 sm:p-4 border-b border-[hsl(var(--line)/.12)]">
        <div className="flex items-center gap-4">
          <select
            value={selectedRound}
            onChange={(e) => onRoundChange(Number(e.target.value))}
            className="dropdown-chevron relative rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3 pr-8 sm:pr-10 md:pr-11 text-xs sm:text-sm md:text-base font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-contrast))] shadow-[0_2px_8px_hsl(var(--primary)/.25)] hover:shadow-[0_4px_16px_hsl(var(--primary)/.35)] hover:bg-[hsl(var(--primary)/.95)] focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--bg-canvas))] outline-none transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none cursor-pointer appearance-none min-w-[100px] sm:min-w-[120px] md:min-w-[140px]"
          >
            <option value={1}>Runde 1</option>
            <option value={2}>Runde 2</option>
            <option value={3}>Runde 3</option>
            <option value={4}>Runde 4</option>
          </select>
          <h1 className="text-xl sm:text-2xl font-semibold text-[hsl(var(--foreground))]">Kampprogram</h1>
        </div>
        <button
          type="button"
          onClick={onExitFullScreen}
          className="rounded-md bg-accent px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-white hover:opacity-90 transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ring-focus hover:shadow-sm"
        >
          Luk (ESC)
        </button>
      </header>
      <div className="flex-1 overflow-hidden p-4 sm:p-6" style={{ height: 'calc(100vh - 80px)' }}>
        <section 
          className="grid gap-4 h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${optimalCols}, minmax(${colWidth}px, 1fr))`,
            gridAutoRows: 'minmax(0, 1fr)',
            justifyContent: 'center',
            alignContent: 'center'
          }}
        >
          {courtsWithPlayers.map((court) => (
            <PageCard
              key={court.courtIdx}
              hover={false}
              className={`space-y-2 sm:space-y-3 hover:shadow-md p-3 sm:p-5 transition-all duration-200 relative h-full flex flex-col ${
                courtsWithDuplicatesSet.has(court.courtIdx)
                  ? 'ring-2 ring-[hsl(var(--destructive)/.45)] border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.03)]'
                  : ''
              }`}
            >
              <header className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))]">Bane {court.courtIdx}</h3>
                  {courtsWithDuplicatesSet.has(court.courtIdx) && (
                    <span className="group relative">
                      <span className="inline-flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-[hsl(var(--destructive)/.2)] text-[10px] sm:text-xs font-bold text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive)/.3)]">
                        !
                      </span>
                      <span className="absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[hsl(var(--surface-2))] px-2 py-1 text-xs text-[hsl(var(--foreground))] shadow-lg ring-1 ring-[hsl(var(--line)/.12)] group-hover:block">
                        3+ spillere har allerede spillet sammen i en tidligere runde
                      </span>
                    </span>
                  )}
                </div>
                <span className="text-xs sm:text-sm text-[hsl(var(--muted))]">{court.slots.length}/{extendedCapacityCourts.get(court.courtIdx) || EMPTY_SLOTS}</span>
              </header>
              <div className="flex flex-col gap-2 flex-1 min-h-0">
                {renderCourtSlots(court)}
              </div>
            </PageCard>
          ))}
        </section>
      </div>
    </div>
  )
}

