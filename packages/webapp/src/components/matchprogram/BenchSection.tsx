/**
 * Bench section component for match program.
 * 
 * Displays available players (bench) and inactive players with drag-and-drop support.
 */

import React from 'react'
import type { CheckedInPlayer } from '@herlev-hjorten/common'
import { PageCard } from '../ui'
import { getCategoryLetter, getCategoryBadge, getPlayerSlotBgColor } from '../../lib/matchProgramUtils'

interface BenchSectionProps {
  /** Bench players (available players) */
  bench: CheckedInPlayer[]
  /** Inactive players (one-round-only or unavailable) */
  inactivePlayers: CheckedInPlayer[]
  /** Selected round number */
  selectedRound: number
  /** Set of unavailable player IDs */
  unavailablePlayers: Set<string>
  /** Whether bench is collapsed */
  benchCollapsed: boolean
  /** Whether bench is currently collapsing */
  benchCollapsing: boolean
  /** Handler to toggle bench collapse */
  onToggleCollapse: () => void
  /** Drag over state for bench */
  dragOverBench: boolean
  /** Drag over state for inactive section */
  dragOverInactive: boolean
  /** Current drag source */
  dragSource: 'bench' | 'inactive' | 'court' | null
  /** Handler for drag start from bench */
  onBenchDragStart: (event: React.DragEvent<HTMLDivElement>, playerId: string) => void
  /** Handler for drag end from bench */
  onBenchDragEnd: () => void
  /** Handler for drag start from inactive */
  onInactiveDragStart: (event: React.DragEvent<HTMLDivElement>, playerId: string) => void
  /** Handler for drag end from inactive */
  onInactiveDragEnd: () => void
  /** Handler for drag over bench */
  onBenchDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  /** Handler for drag leave bench */
  onBenchDragLeave: () => void
  /** Handler for drop on bench */
  onBenchDrop: (event: React.DragEvent<HTMLDivElement>) => void
  /** Handler for drag over inactive */
  onInactiveDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  /** Handler for drag leave inactive */
  onInactiveDragLeave: (event: React.DragEvent<HTMLDivElement>) => void
  /** Handler for drop on inactive */
  onInactiveDrop: (event: React.DragEvent<HTMLDivElement>) => void
  /** Handler to mark player as available */
  onMarkAvailable: (playerId: string) => void
  /** Handler to activate one-round player */
  onActivateOneRoundPlayer: (playerId: string) => void
}

/**
 * Bench section component.
 * 
 * @example
 * ```tsx
 * <BenchSection
 *   bench={bench}
 *   inactivePlayers={inactivePlayers}
 *   selectedRound={1}
 *   unavailablePlayers={unavailablePlayers}
 *   benchCollapsed={false}
 *   benchCollapsing={false}
 *   onToggleCollapse={() => setBenchCollapsed(!benchCollapsed)}
 *   dragOverBench={false}
 *   dragOverInactive={false}
 *   dragSource={null}
 *   onBenchDragStart={handleBenchDragStart}
 *   onBenchDragEnd={handleBenchDragEnd}
 *   onInactiveDragStart={handleInactiveDragStart}
 *   onInactiveDragEnd={handleInactiveDragEnd}
 *   onBenchDragOver={handleBenchDragOver}
 *   onBenchDragLeave={handleBenchDragLeave}
 *   onBenchDrop={handleBenchDrop}
 *   onInactiveDragOver={handleInactiveDragOver}
 *   onInactiveDragLeave={handleInactiveDragLeave}
 *   onInactiveDrop={handleInactiveDrop}
 *   onMarkAvailable={handleMarkAvailable}
 *   onActivateOneRoundPlayer={handleActivateOneRoundPlayer}
 * />
 * ```
 */
export const BenchSection: React.FC<BenchSectionProps> = ({
  bench,
  inactivePlayers,
  selectedRound,
  unavailablePlayers,
  benchCollapsed,
  benchCollapsing,
  onToggleCollapse,
  dragOverBench,
  dragOverInactive,
  dragSource,
  onBenchDragStart,
  onBenchDragEnd,
  onInactiveDragStart,
  onInactiveDragEnd,
  onBenchDragOver,
  onBenchDragLeave,
  onBenchDrop,
  onInactiveDragOver,
  onInactiveDragLeave,
  onInactiveDrop,
  onMarkAvailable,
  onActivateOneRoundPlayer
}) => {
  return (
    <PageCard 
      className={`space-y-3 transition-all duration-300 ease-in-out p-3 sm:p-4 ${
        dragOverBench 
          ? 'ring-2 ring-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.05)]' 
          : ''
      } ${benchCollapsed ? 'overflow-visible' : ''}`}
      onDragOver={onBenchDragOver}
      onDragLeave={onBenchDragLeave}
      onDrop={onBenchDrop}
    >
      {benchCollapsed ? (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-[hsl(var(--surface-2))] transition-colors"
            title="Udvid bænk"
          >
            <svg className="w-5 h-5 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {bench.length > 0 && (
            <span className="rounded-full bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] px-2 py-1 text-xs sm:text-sm font-semibold border border-[hsl(var(--primary)/.2)]">
              {bench.length}
            </span>
          )}
        </div>
      ) : (
        <div 
          style={{
            animation: benchCollapsing 
              ? 'slideOutToLeft 0.3s ease-in forwards'
              : 'slideInFromLeft 0.3s ease-out forwards'
          }}
        >
          <header className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-semibold">BÆNK</h3>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-[10px] sm:text-xs font-medium">
                {bench.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  // Trigger collapse animation - handled by parent
                  onToggleCollapse()
                }}
                className="flex items-center justify-center w-6 h-6 rounded hover:bg-[hsl(var(--surface-2))] transition-colors"
                title="Skjul bænk"
              >
                <svg className="w-4 h-4 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </header>
          <div className="flex flex-col space-y-3 max-h-[calc(100vh-420px)] sm:max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-thin min-w-0">
            {bench.length === 0 && (
              <p className="rounded-md bg-[hsl(var(--surface-2))] px-2 py-3 sm:py-4 text-center text-xs sm:text-sm text-[hsl(var(--muted))] border-hair">
                Træk spillere her for at aktivere dem
              </p>
            )}
            {bench.map((player) => {
              const catLetter = getCategoryLetter(player.primaryCategory)
              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-2 sm:gap-3 rounded-md px-2.5 py-2.5 sm:px-3 sm:py-3 h-[64px] sm:h-[72px] w-full hover:shadow-sm cursor-grab active:cursor-grabbing transition-all ring-1 ring-[hsl(var(--line)/.12)] ${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''}`}
                  data-cat={catLetter || undefined}
                  draggable
                  onDragStart={(event) => onBenchDragStart(event, player.id)}
                  onDragEnd={onBenchDragEnd}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {getCategoryBadge(player.primaryCategory)}
                      <p className="text-sm sm:text-base font-semibold text-[hsl(var(--foreground))] truncate">{player.alias ?? player.name}</p>
                    </div>
                  </div>
                </div>
              )
            })}
            
            {/* Inactive Players Section */}
            <div 
              className={`mt-4 pt-4 border-t transition-all duration-200 min-w-0 ${
                dragOverInactive && dragSource !== 'inactive'
                  ? 'border-[hsl(var(--destructive)/.4)] bg-[hsl(var(--destructive)/.05)]' 
                  : 'border-[hsl(var(--line)/.12)]'
              }`}
              onDragOver={(e) => {
                // If dragging from within inactive section, don't handle - let it bubble
                if (dragSource === 'inactive') {
                  return
                }
                onInactiveDragOver(e)
              }}
              onDragLeave={(e) => {
                // If dragging from within inactive section, don't handle - let it bubble
                if (dragSource === 'inactive') {
                  return
                }
                onInactiveDragLeave(e)
              }}
              onDrop={(e) => {
                // If dropping from within inactive section, don't handle - let it bubble
                if (dragSource === 'inactive') {
                  return
                }
                onInactiveDrop(e)
              }}
            >
              {inactivePlayers.length > 0 ? (
                <>
                  <header className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] sm:text-xs font-semibold text-[hsl(var(--muted))] uppercase tracking-wide">
                      Inaktive / Kun 1 runde
                    </h4>
                    <span className="rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-[hsl(var(--muted))]">
                      {inactivePlayers.length}
                    </span>
                  </header>
                  <div className="flex flex-col space-y-3 min-w-0">
                    {inactivePlayers.map((player) => {
                      const isOneRoundOnly = selectedRound > 1 && player.maxRounds === 1
                      const isUnavailable = unavailablePlayers.has(player.id)
                      const catLetter = getCategoryLetter(player.primaryCategory)
                      return (
                        <div
                          key={player.id}
                          className={`flex items-center gap-2 rounded-md px-2.5 py-2.5 sm:px-3 sm:py-3 h-[64px] sm:h-[72px] w-full max-w-full box-border opacity-60 hover:opacity-100 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all ring-1 ring-[hsl(var(--line)/.12)] overflow-hidden ${getPlayerSlotBgColor()} ${catLetter ? 'cat-rail' : ''}`}
                          data-cat={catLetter || undefined}
                          draggable
                          onDragStart={(event) => onInactiveDragStart(event, player.id)}
                          onDragEnd={onInactiveDragEnd}
                        >
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="text-sm sm:text-base font-semibold text-[hsl(var(--foreground))] truncate w-full">{player.alias ?? player.name}</p>
                            <div className="flex items-center gap-1.5 mt-1 min-w-0">
                              {getCategoryBadge(player.primaryCategory)}
                              {isOneRoundOnly && !isUnavailable && (
                                <span className="inline-flex items-center rounded-full bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] border-hair px-1.5 py-0.5 text-[9px] sm:text-[10px] whitespace-nowrap flex-shrink-0">Kun 1 runde</span>
                              )}
                              {isUnavailable && (
                                <span className="text-[9px] sm:text-[10px] font-normal text-[hsl(var(--destructive))] whitespace-nowrap flex-shrink-0">Inaktiv</span>
                              )}
                            </div>
                          </div>
                          {(isUnavailable || (isOneRoundOnly && !isUnavailable)) && (
                            <div className="flex-shrink-0 flex items-center justify-end ml-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isUnavailable) {
                                    onMarkAvailable(player.id)
                                  } else if (isOneRoundOnly) {
                                    onActivateOneRoundPlayer(player.id)
                                  }
                                }}
                                className="rounded px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/.1)] ring-1 ring-[hsl(var(--success)/.2)] transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none hover:shadow-sm whitespace-nowrap"
                                title={isUnavailable ? "Gendan til bænk" : "Aktiver spiller"}
                              >
                                Aktiver
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="py-4">
                  <header className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] sm:text-xs font-semibold text-[hsl(var(--muted))] uppercase tracking-wide">
                      Inaktive / Kun 1 runde
                    </h4>
                    <span className="rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-[hsl(var(--muted))]">
                      0
                    </span>
                  </header>
                  <p className="text-[9px] sm:text-[10px] text-[hsl(var(--muted))] text-center py-2 rounded-md bg-[hsl(var(--surface-2))] border-hair">
                    Træk spillere her for at markere dem som inaktive
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageCard>
  )
}

