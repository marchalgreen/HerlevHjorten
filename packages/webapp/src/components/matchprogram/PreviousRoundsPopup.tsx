/**
 * Previous rounds popup component for match program.
 * 
 * Displays a draggable popup window showing previous rounds' match data.
 */

import React, { useMemo } from 'react'
import type { CourtWithPlayers } from '@herlev-hjorten/common'
import { PageCard } from '../ui'
import { MATCH_CONSTANTS } from '../../constants'
import { getCategoryLetter, getPlayerSlotBgColor } from '../../lib/matchProgramUtils'

interface PreviousRoundsPopupProps {
  /** Selected round number */
  selectedRound: number
  /** Set of visible previous rounds */
  previousRoundsVisible: Set<number>
  /** Handler to close popup */
  onClose: () => void
  /** In-memory matches for all rounds */
  inMemoryMatches: Record<number, CourtWithPlayers[]>
  /** Previous rounds matches from database */
  previousRoundsMatches: Record<number, CourtWithPlayers[]>
  /** Popup position */
  popupPosition: { x: number; y: number }
  /** Popup size */
  popupSize: { width: number; height: number }
  /** Whether popup is being dragged */
  isDragging: boolean
  /** Whether popup is being resized */
  isResizing: boolean
  /** Handler for mouse down on header */
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
  /** Handler for resize start */
  onResizeStart: (e: React.MouseEvent<HTMLDivElement>) => void
}

const EMPTY_SLOTS = MATCH_CONSTANTS.DEFAULT_SLOTS_PER_COURT

/**
 * Previous rounds popup component.
 * 
 * @example
 * ```tsx
 * <PreviousRoundsPopup
 *   selectedRound={2}
 *   previousRoundsVisible={new Set([1])}
 *   onClose={() => setPreviousRoundsVisible(new Set())}
 *   inMemoryMatches={inMemoryMatches}
 *   previousRoundsMatches={previousRoundsMatches}
 *   popupPosition={{ x: 16, y: 16 }}
 *   isDragging={false}
 *   onMouseDown={handleMouseDown}
 * />
 * ```
 */
export const PreviousRoundsPopup: React.FC<PreviousRoundsPopupProps> = ({
  selectedRound,
  previousRoundsVisible,
  onClose,
  inMemoryMatches,
  previousRoundsMatches,
  popupPosition,
  popupSize,
  isDragging,
  isResizing,
  onMouseDown,
  onResizeStart
}) => {
  if (previousRoundsVisible.size === 0) {
    return null
  }

  // Calculate optimal number of columns based on popup width
  // This creates a responsive grid that smoothly adapts to the popup size
  // Minimum card width: ~140px (to ensure readability and good UX)
  // Gap: 8px (gap-2)
  // Padding: 16px on each side (p-4)
  const minCardWidth = 140
  const gap = 8
  const horizontalPadding = 32 // 16px on each side (p-4)
  
  const optimalColumns = useMemo(() => {
    const availableWidth = popupSize.width - horizontalPadding
    
    // Calculate how many columns can fit
    // Formula: (availableWidth + gap) / (minCardWidth + gap)
    // This accounts for gaps between cards
    const maxColumns = Math.floor((availableWidth + gap) / (minCardWidth + gap))
    
    // Ensure at least 1 column, and cap at a reasonable maximum
    // Cap at 6 columns to prevent too many columns on very wide screens
    const columns = Math.max(1, Math.min(maxColumns, 6))
    
    return columns
  }, [popupSize.width])

  return (
    <>
      {/* Subtle backdrop - visual only, doesn't block interaction */}
      <div 
        className="fixed inset-0 z-40 bg-[hsl(var(--bg-canvas)/.1)] pointer-events-none"
      />
      {/* Floating Popup Window */}
      <div 
        className="fixed z-50 rounded-xl bg-[hsl(var(--surface))] shadow-2xl ring-2 ring-[hsl(var(--line)/.2)] overflow-hidden flex flex-col pointer-events-auto select-none"
        style={{
          left: `${popupPosition.x}px`,
          top: `${popupPosition.y}px`,
          width: `${popupSize.width}px`,
          height: `${popupSize.height}px`,
          maxHeight: '85vh',
          cursor: isDragging ? 'grabbing' : isResizing ? 'nwse-resize' : 'default'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - draggable */}
        <div 
          className="flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 border-b border-[hsl(var(--line)/.12)] bg-[hsl(var(--surface-2))] cursor-grab active:cursor-grabbing"
          onMouseDown={onMouseDown}
        >
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
            <h2 className="text-base sm:text-lg font-semibold text-[hsl(var(--foreground))]">
              Tidligere runder
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[hsl(var(--muted))] hover:bg-[hsl(var(--surface))] hover:text-[hsl(var(--foreground))] transition-all duration-200"
            title="Luk"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
          {Array.from({ length: selectedRound - 1 })
            .map((_, i) => selectedRound - 1 - i)
            .filter((round) => previousRoundsVisible.has(round))
            .map((round) => (
              <div key={round} className="space-y-2">
                <h3 className="text-xs sm:text-sm font-semibold text-[hsl(var(--muted))] uppercase tracking-wide sticky top-0 bg-[hsl(var(--surface))] pb-1">
                  Runde {round}
                </h3>
                <div
                  className="grid gap-2 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{
                    gridTemplateColumns: `repeat(${optimalColumns}, minmax(0, 1fr))`
                  }}
                >
                  {(inMemoryMatches[round] || previousRoundsMatches[round] || []).map((court) => (
                    <PageCard 
                      key={court.courtIdx} 
                      className="space-y-1 sm:space-y-1.5 p-2 sm:p-2.5 opacity-75 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] min-w-0"
                    >
                      <header className="flex items-center justify-between mb-1">
                        <h4 className="text-[10px] sm:text-xs font-semibold text-[hsl(var(--foreground))]">Bane {court.courtIdx}</h4>
                        <span className="text-[9px] sm:text-[10px] text-[hsl(var(--muted))]">{court.slots.length}/{EMPTY_SLOTS}</span>
                      </header>
                      <div className="flex flex-col gap-1">
                        {Array.from({ length: 4 }).map((_, slotIdx) => {
                          const entry = court.slots.find((slot) => slot.slot === slotIdx)
                          const player = entry?.player
                          const catLetter = player ? getCategoryLetter(player.primaryCategory) : null
                          return (
                            <div
                              key={slotIdx}
                              className={`flex min-h-[32px] sm:min-h-[36px] items-center rounded-md px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs ring-1 ${
                                player
                                  ? `${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''} ring-[hsl(var(--line)/.12)]`
                                  : 'bg-[hsl(var(--surface-2))] ring-[hsl(var(--line)/.12)]'
                              }`}
                              data-cat={catLetter || undefined}
                            >
                              {player ? (
                                <span className="text-xs font-medium text-[hsl(var(--foreground))] truncate">
                                  {player.alias ?? player.name}
                                </span>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </PageCard>
                  ))}
                </div>
              </div>
            ))}
        </div>
        {/* Resize Handle - More visible and intuitive */}
        <div
          className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize group z-10"
          onMouseDown={onResizeStart}
          title="Træk for at ændre størrelse"
        >
          {/* Background with subtle gradient and border */}
          <div className="absolute inset-0 bg-gradient-to-tl from-[hsl(var(--surface-2))] via-[hsl(var(--surface-2)/.8)] to-[hsl(var(--surface-3))] border-t-2 border-l-2 border-[hsl(var(--line)/.4)] rounded-tl-xl transition-all duration-200 group-hover:from-[hsl(var(--primary)/.15)] group-hover:via-[hsl(var(--primary)/.2)] group-hover:to-[hsl(var(--primary)/.25)] group-hover:border-[hsl(var(--primary)/.5)] group-hover:shadow-[0_-2px_8px_hsl(var(--primary)/.2)]" />
          
          {/* Diagonal dots pattern - classic resize indicator */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-5 h-5">
              {/* Main diagonal line of dots */}
              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-[hsl(var(--muted))] group-hover:bg-[hsl(var(--primary))] transition-all duration-200 group-hover:scale-110" />
              <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--muted))] group-hover:bg-[hsl(var(--primary))] transition-all duration-200 group-hover:scale-110" />
              <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-[hsl(var(--muted))] group-hover:bg-[hsl(var(--primary))] transition-all duration-200 group-hover:scale-110" />
              {/* Secondary diagonal dots for better visibility */}
              <div className="absolute bottom-0 right-3 w-1 h-1 rounded-full bg-[hsl(var(--muted))] group-hover:bg-[hsl(var(--primary))] transition-all duration-200 opacity-60 group-hover:opacity-100" />
              <div className="absolute bottom-3 right-0 w-1 h-1 rounded-full bg-[hsl(var(--muted))] group-hover:bg-[hsl(var(--primary))] transition-all duration-200 opacity-60 group-hover:opacity-100" />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

