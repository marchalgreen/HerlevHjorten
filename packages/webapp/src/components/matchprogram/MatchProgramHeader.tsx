/**
 * Match program header component.
 * 
 * Displays session info, round selector, and action buttons.
 */

import React from 'react'
import type { TrainingSession } from '@rundeklar/common'
// Variant selector removed — only option A is kept

interface MatchProgramHeaderProps {
  /** Current training session */
  session: TrainingSession | null
  /** Number of checked-in players */
  checkedInCount: number
  /** Gender breakdown */
  genderBreakdown: { male: number; female: number }
  /** Selected round number */
  selectedRound: number
  /** Handler for round change */
  onRoundChange: (round: number) => void
  /** Error message */
  error: string | null
  /** Whether previous rounds are visible */
  previousRoundsVisible: Set<number>
  /** Handler to toggle previous rounds visibility */
  onTogglePreviousRounds: () => void
  /** Handler to load previous round */
  onLoadPreviousRound: (round: number) => Promise<void>
  /** Whether auto-match has been run for selected round */
  hasRunAutoMatch: boolean
  /** Number of bench players */
  benchCount: number
  /** Whether there are matches (courts with players) */
  hasMatches: boolean
  /** Handler for auto-match */
  onAutoMatch: () => void
  /** Handler to reset matches */
  onResetMatches: () => void
  /** Handler to enter full-screen */
  onEnterFullScreen: () => void
}

/**
 * Match program header component.
 * 
 * @example
 * ```tsx
 * <MatchProgramHeader
 *   session={session}
 *   checkedInCount={checkedIn.length}
 *   genderBreakdown={genderBreakdown}
 *   selectedRound={selectedRound}
 *   onRoundChange={setSelectedRound}
 *   error={error}
 *   previousRoundsVisible={previousRoundsVisible}
 *   onTogglePreviousRounds={handleTogglePreviousRounds}
 *   onLoadPreviousRound={loadPreviousRound}
 *   hasRunAutoMatch={hasRunAutoMatch.has(selectedRound)}
 *   benchCount={bench.length}
 *   onAutoMatch={handleAutoMatch}
 *   onResetMatches={handleResetMatches}
 *   onEnterFullScreen={() => setIsFullScreen(true)}
 *   onStartTraining={handleStartTraining}
 *   onEndTraining={handleEndTraining}
 * />
 * ```
 */
export const MatchProgramHeader: React.FC<MatchProgramHeaderProps> = ({
  session,
  checkedInCount,
  genderBreakdown,
  selectedRound,
  onRoundChange,
  error,
  previousRoundsVisible,
  onTogglePreviousRounds,
  onLoadPreviousRound,
  hasRunAutoMatch,
  benchCount,
  hasMatches,
  onAutoMatch,
  onResetMatches,
  onEnterFullScreen
}) => {
  // Calculate if button should pulse (bench is empty and there are matches)
  const shouldPulse = session && benchCount === 0 && hasMatches
  return (
    <header className="flex flex-col gap-2 sm:gap-3 mb-2 lg:mb-1.5">
      {/* Top section: Title and buttons aligned */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))]">Runder</h1>
          <p className="text-xs sm:text-sm md:text-base text-[hsl(var(--muted))] mt-1">
            {session ? (
              'Fordel spillere på baner og sæt runder op.'
            ) : (
              'Start en træning for at begynde at matche spillere.'
            )}
          </p>
          {error && <span className="mt-2 inline-block text-sm text-[hsl(var(--destructive))]">{error}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {/* Round selector - now with other buttons */}
          <select
            value={selectedRound}
            onChange={(e) => onRoundChange(Number(e.target.value))}
            className="dropdown-chevron relative rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2.5 lg:px-5 lg:py-3 pr-7 sm:pr-8 md:pr-10 lg:pr-11 text-xs sm:text-sm md:text-base font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-contrast))] shadow-[0_2px_8px_hsl(var(--primary)/.25)] hover:shadow-[0_4px_16px_hsl(var(--primary)/.35)] hover:bg-[hsl(var(--primary)/.95)] focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--bg-canvas))] outline-none transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[0_2px_8px_hsl(var(--primary)/.25)] appearance-none min-w-[90px] sm:min-w-[100px] md:min-w-[120px] lg:min-w-[140px] whitespace-nowrap"
            disabled={!session}
          >
            <option value={1}>Runde 1</option>
            <option value={2}>Runde 2</option>
            <option value={3}>Runde 3</option>
            <option value={4}>Runde 4</option>
          </select>
          
          {selectedRound > 1 && (
            <button
              type="button"
              onClick={async () => {
                for (let round = 1; round < selectedRound; round++) {
                  await onLoadPreviousRound(round)
                }
                onTogglePreviousRounds()
              }}
              className="rounded-md px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-4 text-xs sm:text-sm font-medium transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none bg-[hsl(var(--surface-glass)/.85)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.95)] ring-1 ring-[hsl(var(--line)/.12)] hover:shadow-sm whitespace-nowrap"
            >
              {previousRoundsVisible.size > 0 ? 'Skjul' : 'Se'} tidligere runder
            </button>
          )}
          <button
            type="button"
            onClick={onAutoMatch}
            disabled={!session || (benchCount === 0 && !hasRunAutoMatch)}
            className="rounded-md px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none bg-[hsl(var(--surface-glass)/.85)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.95)] ring-1 ring-[hsl(var(--line)/.12)] disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm whitespace-nowrap"
          >
            {hasRunAutoMatch ? 'Genfordel' : 'Fordel runde'}
          </button>
          <button
            type="button"
            onClick={onResetMatches}
            disabled={!session}
              className="rounded-md px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-4 text-xs sm:text-sm font-medium transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none bg-transparent text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] ring-1 ring-[hsl(var(--destructive)/.3)] disabled:opacity-40 disabled:cursor-not-allowed hover:ring-[hsl(var(--destructive)/.4)] focus:ring-[hsl(var(--destructive)/.4)] focus:ring-2 whitespace-nowrap"
          >
            Nulstil runde
          </button>
          {session && (
            <button
              type="button"
              onClick={onEnterFullScreen}
              className={`rounded-md bg-accent px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3 text-xs sm:text-sm md:text-base font-semibold text-white hover:opacity-90 ring-focus whitespace-nowrap ${
                shouldPulse 
                  ? 'animate-pulse-gentle' 
                  : 'shadow-[0_2px_8px_hsl(var(--primary)/.25)] transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] hover:shadow-lg motion-reduce:transition-none'
              }`}
              style={shouldPulse ? {
                animation: 'pulse-gentle 2s ease-in-out infinite',
                transition: 'none'
              } : undefined}
              title="Tryk F11 eller klik for at vise runde"
            >
              Vis runde {shouldPulse && '(F11)'}
            </button>
          )}
          {/* Variant selector removed — only option A is kept */}
        </div>
      </div>
    </header>
  )
}

