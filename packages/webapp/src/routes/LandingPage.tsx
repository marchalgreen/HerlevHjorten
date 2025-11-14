import React, { useMemo, useRef, useState, useEffect } from 'react'
import { Search, Play, Users, UserCheck, Square } from 'lucide-react'
import { Button, PageCard } from '../components/ui'
import { formatDate } from '../lib/formatting'
import useLandingState from '../hooks/useLandingState'
import type { Coach } from './landing/types'
import { useTenant } from '../contexts/TenantContext'
import courtsSettings from '../services/courtsSettings'
import { useCheckIns } from '../hooks/useCheckIns'

export type LandingPageProps = {
  coach?: Coach
  onRedirectToCheckin?: (sessionId: string) => void
}

const ringFocus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]'

// Courts selector with only +/- controls (no infield arrows/typing)
const CourtsControl: React.FC<{
  value: number
  min: number
  onChange: (n: number) => void
}> = ({ value, min, onChange }) => {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(value + 1)
  return (
    <div className="flex items-center gap-3" aria-label="Antal baner">
      <span className="text-sm text-[hsl(var(--muted))]">Antal baner</span>
      <div className="flex items-center gap-1" role="group" aria-label="Justér antal baner">
        <Button variant="secondary" size="sm" onClick={dec} aria-label="Færre baner">-</Button>
        <div
          className={`w-16 h-9 inline-flex items-center justify-center text-base rounded-md bg-[hsl(var(--surface))] ring-1 ring-[hsl(var(--line)/.14)] select-none`}
          aria-live="polite"
        >
          {value}
        </div>
        <Button variant="secondary" size="sm" onClick={inc} aria-label="Flere baner">+</Button>
      </div>
    </div>
  )
}

export const WelcomeHeader: React.FC<{ coachName?: string }>
  = ({ coachName }) => (
  <header className="mb-6 sm:mb-8">
    <h1 className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--foreground))]">
      {coachName ? `Hej, ${coachName}` : 'Velkommen træner'}
    </h1>
    <p className="text-[hsl(var(--muted))] mt-2">
      Vælg en træningsgruppe og start indtjekning. Du kan tilføje spillere på tværs af grupper.
    </p>
  </header>
)

const GroupCard: React.FC<{
  id: string
  name: string
  playersCount: number
  lastSessionAt?: string | null
  selected?: boolean
  onSelect: (id: string) => void
}> = ({ id, name, playersCount, lastSessionAt, selected, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(id)}
      aria-label={`Vælg ${name}`}
      className={`text-left w-full ${ringFocus}`}
    >
      <PageCard
        hover
        className={`transition-colors ${selected ? 'ring-2 ring-[hsl(var(--ring))]' : ''}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base sm:text-lg font-medium text-[hsl(var(--foreground))]">{name}</div>
            <div className="text-sm text-[hsl(var(--muted))] mt-1">
              {playersCount} spillere
              {lastSessionAt ? (
                <>
                  {' '}• Seneste: {formatDate(lastSessionAt, false)}
                </>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--line)/.12)]">
            Gruppe
          </div>
        </div>
      </PageCard>
    </button>
  )
}

const GroupGrid: React.FC<{
  groups: Array<{ id: string; name: string; playersCount: number; lastSessionAt?: string | null }>
  selectedId: string | null
  onSelect: (id: string) => void
}> = ({ groups, selectedId, onSelect }) => {
  if (!groups.length) {
    return (
      <div className="text-[hsl(var(--muted))]">Ingen grupper fundet.</div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {groups.map((g) => (
        <GroupCard
          key={g.id}
          id={g.id}
          name={g.name}
          playersCount={g.playersCount}
          lastSessionAt={g.lastSessionAt}
          selected={g.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

const PlayerSearchModal: React.FC<{
  open: boolean
  onClose: () => void
  term: string
  setTerm: (v: string) => void
  results: Array<{ id: string; displayName: string; groupId: string | null }>
  onPick: (id: string) => void
  pickedIds: Set<string>
  returnFocusTo?: HTMLElement | null
}> = ({ open, onClose, term, setTerm, results, onPick, pickedIds, returnFocusTo }) => {
  const inputRef = useRef<HTMLInputElement | null>(null)

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Søg spillere"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose()
          // return focus to opener
          setTimeout(() => returnFocusTo?.focus(), 0)
        }
        if (e.key === 'Tab') {
          // rudimentary focus trap
          const container = e.currentTarget as HTMLElement
          const focusables = container.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
          if (!focusables.length) return
          const first = focusables[0]
          const last = focusables[focusables.length - 1]
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus()
          }
        }
      }}
    >
      <div className="w-full max-w-lg mx-3 sm:mx-0 bg-[hsl(var(--surface)/.98)] backdrop-blur-md ring-1 ring-[hsl(var(--line)/.12)] rounded-lg shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-3 p-4 border-b border-[hsl(var(--line)/.12)]">
          <Search className="w-5 h-5 text-[hsl(var(--muted))]" aria-hidden />
          <input
            ref={inputRef}
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Søg spillere på tværs af grupper"
            className={`flex-1 bg-transparent outline-none text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted))] ${ringFocus}`}
          />
          <Button variant="ghost" size="sm" onClick={() => { onClose(); setTimeout(() => returnFocusTo?.focus(), 0) }}>Luk</Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2 sm:p-3 scrollbar-thin">
          {results.length === 0 ? (
            <div className="text-sm text-[hsl(var(--muted))] p-4">Ingen resultater endnu.</div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--line)/.12)]">
              {results.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="text-[hsl(var(--foreground))] truncate">{p.displayName}</div>
                    <div className="text-xs text-[hsl(var(--muted))]">{p.groupId ?? 'Ingen gruppe'}</div>
                  </div>
                  <Button
                    size="sm"
                    variant={pickedIds.has(p.id) ? 'secondary' : 'primary'}
                    onClick={() => onPick(p.id)}
                    aria-label={`Tilføj ${p.displayName}`}
                    disabled={pickedIds.has(p.id)}
                  >
                    Tilføj
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

const StartSessionControls: React.FC<{
  disabled: boolean
  starting: boolean
  onStart: () => void
  addedPlayers: Array<{ id: string; displayName: string }>
  onRemovePlayer: (id: string) => void
}> = ({ disabled, starting, onStart, addedPlayers, onRemovePlayer }) => {
  return (
    <PageCard className="mt-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onStart} disabled={disabled} loading={starting}>
            <Play className="w-4 h-4" aria-hidden />
            Start session
          </Button>
        </div>
        {addedPlayers.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {addedPlayers.map((p) => (
              <button
                key={p.id}
                onClick={() => onRemovePlayer(p.id)}
                className={`px-2.5 py-1 rounded-md text-xs bg-[hsl(var(--surface-2))] ring-1 ring-[hsl(var(--line)/.12)] ${ringFocus}`}
                aria-label={`Fjern ${p.displayName}`}
              >
                {p.displayName}
              </button>
            ))}
          </div>
        )}
        <div>
          <button
            className={`text-sm text-[hsl(var(--muted))] underline underline-offset-2 hover:text-[hsl(var(--foreground))] ${ringFocus}`}
            onClick={(e) => {
              e.preventDefault()
              // Start without a group
              onStart()
            }}
          >
            Start uden gruppe
          </button>
        </div>
      </div>
    </PageCard>
  )}

const LandingPage: React.FC<LandingPageProps> = ({ coach, onRedirectToCheckin }) => {
  const { tenantId, config } = useTenant()
  const state = useLandingState({ coach, onRedirectToCheckin })
  const landing = state as any
  const pickedIds = useMemo(() => new Set(state.crossGroupPlayers.map((p) => p.id)), [state.crossGroupPlayers])
  const searchOpenerRef = useRef<HTMLElement | null>(null)
  const [courtsInUse, setCourtsInUse] = useState<number>(() => courtsSettings.getEffectiveCourtsInUse(tenantId, config.maxCourts))
  
  // Get checked-in players for active session
  const { checkedIn } = useCheckIns(landing.activeSession?.sessionId ?? null)

  const activeGroupName = useMemo(() => {
    if (!state.activeSession?.groupId) return null
    const g = state.groups.find((x) => x.id === state.activeSession?.groupId)
    return g?.name ?? state.activeSession.groupId
  }, [state.activeSession?.groupId, state.groups])
  
  // Calculate extra players: checked-in players NOT in the permanent training group
  const extraPlayersCount = useMemo(() => {
    if (!landing.activeSession?.groupId || !checkedIn.length) return 0
    
    return checkedIn.filter((player) => {
      const trainingGroups = ((player as any).trainingGroups as string[] | undefined) ?? []
      return !trainingGroups.includes(landing.activeSession!.groupId!)
    }).length
  }, [checkedIn, landing.activeSession])

  useEffect(() => {
    courtsSettings.setStoredCourtsInUse(tenantId, courtsInUse)
  }, [tenantId, courtsInUse])

  if (state.loading) {
    return (
      <div className="p-4 sm:p-6">
        <WelcomeHeader coachName={coach?.displayName} />
        <PageCard>
          <div className="text-[hsl(var(--muted))]">Indlæser…</div>
        </PageCard>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <WelcomeHeader coachName={coach?.displayName} />

      {landing.activeSession ? (
        <PageCard className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <div className="text-base sm:text-lg font-medium text-[hsl(var(--foreground))]">Aktiv træning</div>
              <div className="text-sm text-[hsl(var(--muted))] mt-1">Startet: {formatDate(landing.activeSession.startedAt)}</div>
              {activeGroupName && (
                <div className="inline-flex items-center gap-2 mt-1">
                  <span className="text-xs text-[hsl(var(--muted))]">Gruppe:</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--surface-2))] ring-1 ring-[hsl(var(--line)/.12)] text-[hsl(var(--foreground))]">
                    {activeGroupName}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={landing.goToCheckIn}>
                <UserCheck className="w-4 h-4" aria-hidden />
                Åbn indtjekning
              </Button>
              <Button variant="secondary" loading={landing.ending} onClick={landing.endSession}>
                <Square className="w-4 h-4" aria-hidden />
                Afslut træning
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <CourtsControl value={courtsInUse} min={1} onChange={setCourtsInUse} />
            <p className="text-xs text-[hsl(var(--muted))] mt-1">Kan ændres undervejs uden at påvirke indtjekninger.</p>
          </div>
          {extraPlayersCount > 0 && (
            <div className="mt-3 text-sm text-[hsl(var(--muted))] flex items-center gap-2">
              <Users className="w-4 h-4" aria-hidden />
              Ekstra spillere: {extraPlayersCount}
            </div>
          )}
        </PageCard>
      ) : (
        <>
          <GroupGrid
            groups={state.groups}
            selectedId={state.selectedGroupId}
            onSelect={(id) => {
              state.setSelectedGroupId(id)
              // analytics: group_selected
              // eslint-disable-next-line no-console
              console.debug('analytics:event', 'group_selected', { groupId: id })
            }}
          />

          <StartSessionControls
            disabled={!state.selectedGroupId && state.crossGroupPlayers.length === 0}
            starting={state.starting}
            onStart={state.start}
            addedPlayers={state.crossGroupPlayers}
            onRemovePlayer={state.removeCrossGroupPlayer}
          />
          <div className="mt-3">
            <PageCard>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CourtsControl value={courtsInUse} min={1} onChange={setCourtsInUse} />
                <div className="text-xs text-[hsl(var(--muted))]">Huskes til næste træning.</div>
              </div>
            </PageCard>
          </div>
        </>
      )}

      <PlayerSearchModal
        open={state.searchOpen}
        onClose={state.closeSearch}
        term={state.searchTerm}
        setTerm={state.setSearchTerm}
        results={state.searchResults}
        onPick={(id) => {
          const player = state.searchResults.find((p) => p.id === id)
          if (player) state.addCrossGroupPlayer(player)
        }}
        pickedIds={pickedIds}
        returnFocusTo={searchOpenerRef.current}
      />
    </div>
  )
}

export default LandingPage
