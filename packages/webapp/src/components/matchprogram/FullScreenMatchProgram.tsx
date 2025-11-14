/**
 * Full-screen match program view component.
 * 
 * Displays courts in a full-screen grid layout optimized for viewing.
 */

import React from 'react'
import type { CourtWithPlayers, Player } from '@rundeklar/common'
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
  
  // Calculate responsive grid layout based on viewport width
  const numCourts = courtsWithPlayers.length
  
  // Determine optimal columns based on viewport width (mobile-first)
  let optimalCols = 1 // Mobile: 1 column
  if (viewportSize.width >= 1280) {
    // xl: 4 columns
    optimalCols = numCourts <= 4 ? numCourts : 4
  } else if (viewportSize.width >= 1024) {
    // lg: 3 columns
    optimalCols = numCourts <= 3 ? numCourts : 3
  } else if (viewportSize.width >= 768) {
    // md: 2 columns
    optimalCols = numCourts <= 2 ? numCourts : 2
  } else {
    // sm and below: 1 column
    optimalCols = 1
  }
  
  // Ensure we don't have more columns than courts
  optimalCols = Math.min(optimalCols, numCourts || 1)
  
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
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 border-b border-[hsl(var(--line)/.12)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <select
            value={selectedRound}
            onChange={(e) => onRoundChange(Number(e.target.value))}
            className="dropdown-chevron relative rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3 pr-8 sm:pr-10 md:pr-11 text-xs sm:text-sm md:text-base font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-contrast))] shadow-[0_2px_8px_hsl(var(--primary)/.25)] hover:shadow-[0_4px_16px_hsl(var(--primary)/.35)] hover:bg-[hsl(var(--primary)/.95)] focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--bg-canvas))] outline-none transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none cursor-pointer appearance-none min-w-[100px] sm:min-w-[120px] md:min-w-[140px] whitespace-nowrap"
          >
            <option value={1}>Runde 1</option>
            <option value={2}>Runde 2</option>
            <option value={3}>Runde 3</option>
            <option value={4}>Runde 4</option>
          </select>
          <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-[hsl(var(--foreground))]">Kampprogram</h1>
        </div>
        <button
          type="button"
          onClick={onExitFullScreen}
          className="rounded-md bg-accent px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 text-xs sm:text-sm md:text-base font-semibold text-white hover:opacity-90 transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ring-focus hover:shadow-sm whitespace-nowrap w-full sm:w-auto"
        >
          Luk (ESC)
        </button>
      </header>
      <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6" style={{ height: 'calc(100vh - 80px)' }}>
        <section 
          className="grid gap-3 sm:gap-4 h-full w-full mx-auto"
          style={{
            gridTemplateColumns: `repeat(${optimalCols}, minmax(0, 1fr))`,
            gridAutoRows: 'min-content',
            maxWidth: '100%'
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
              <header className="flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-[hsl(var(--foreground))]">Bane {court.courtIdx}</h3>
                  {courtsWithDuplicatesSet.has(court.courtIdx) && (
                    <span className="group relative">
                      <span className="inline-flex h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 items-center justify-center rounded-full bg-[hsl(var(--destructive)/.2)] text-[9px] sm:text-[10px] md:text-xs font-bold text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive)/.3)]">
                        !
                      </span>
                      <span className="absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[hsl(var(--surface-2)/.85)] backdrop-blur-md px-2 py-1 text-xs text-[hsl(var(--foreground))] shadow-lg ring-1 ring-[hsl(var(--line)/.12)] group-hover:block">
                        3+ spillere har allerede spillet sammen i en tidligere runde
                      </span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-xs md:text-sm text-[hsl(var(--muted))]">{court.slots.length}/{extendedCapacityCourts.get(court.courtIdx) || EMPTY_SLOTS}</span>
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

