import React, { useEffect, useMemo, useState } from 'react'
import type {
  AutoArrangeResult,
  CheckedInPlayer,
  CourtWithPlayers,
  Player,
  TrainingSession
} from '@badminton/common'
import api from '../api'
import { PageCard } from '../components/ui'

const EMPTY_SLOTS = 4

const CoachPage = () => {
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [checkedIn, setCheckedIn] = useState<CheckedInPlayer[]>([])
  const [matches, setMatches] = useState<CourtWithPlayers[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [moveMenuPlayer, setMoveMenuPlayer] = useState<string | null>(null)

  const loadSession = async () => {
    try {
      const active = await api.session.getActive()
      setSession(active)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente træning')
    }
  }

  const loadCheckIns = async () => {
    if (!session) {
      setCheckedIn([])
      return
    }
    try {
      const data = await api.checkIns.listActive()
      setCheckedIn(data)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente fremmøde')
    }
  }

  const loadMatches = async () => {
    if (!session) {
      setMatches([])
      return
    }
    try {
      const data = await api.matches.list()
      setMatches(data)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente baner')
    }
  }

  const hydrate = async () => {
    setLoading(true)
    setError(null)
    await loadSession()
    setLoading(false)
  }

  useEffect(() => { void hydrate() }, [])

  useEffect(() => {
    if (!session) {
      setMatches([])
      setCheckedIn([])
      return
    }
    void loadCheckIns()
    void loadMatches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  const assignedIds = useMemo(() => {
    const ids = new Set<string>()
    matches.forEach((court: CourtWithPlayers) => {
      court.slots.forEach(({ player }: { player: Player }) => ids.add(player.id))
    })
    return ids
  }, [matches])

  const bench = useMemo(
    () => checkedIn.filter((player) => !assignedIds.has(player.id)),
    [checkedIn, assignedIds]
  )

  const handleStartTraining = async () => {
    try {
      const active = await api.session.startOrGetActive()
      setSession(active)
      setInfo('Træning startet')
      setTimeout(() => setInfo(null), 1800)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke starte træning')
    }
  }

  const handleEndTraining = async () => {
    if (!session) return
    try {
      await api.session.endActive()
      setSession(null)
      setInfo('Træning afsluttet')
      setTimeout(() => setInfo(null), 1800)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke afslutte træning')
    }
  }

  const handleAutoMatch = async () => {
    if (!session) return
    try {
      const result: AutoArrangeResult = await api.matches.autoArrange()
      await loadMatches()
      await loadCheckIns()
      setInfo(`Fordelte spillere på ${result.filledCourts} baner`)
      setTimeout(() => setInfo(null), 1800)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke matche spillere')
    }
  }

  const handleResetMatches = async () => {
    if (!session) return
    try {
      await api.matches.reset()
      await loadMatches()
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke nulstille kampe')
    }
  }

  const handleMove = async (playerId: string, courtIdx?: number, slot?: number) => {
    if (!session) return
    try {
      await api.matches.move({ playerId, toCourtIdx: courtIdx, toSlot: slot })
      await loadMatches()
      await loadCheckIns()
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke flytte spiller')
    }
  }

  const onDropToBench = async (event: React.DragEvent<HTMLDivElement>) => {
    const playerId = event.dataTransfer.getData('application/x-player-id')
    if (!playerId) return
    event.preventDefault()
    await handleMove(playerId)
  }

  const onDropToSlot = async (
    event: React.DragEvent<HTMLElement>,
    courtIdx: number,
    slot: number
  ) => {
    const playerId = event.dataTransfer.getData('application/x-player-id')
    if (!playerId) return
    event.preventDefault()
    await handleMove(playerId, courtIdx, slot)
  }

  const onDropToCourt = async (event: React.DragEvent<HTMLDivElement>, courtIdx: number) => {
    const playerId = event.dataTransfer.getData('application/x-player-id')
    if (!playerId) return
    event.preventDefault()
    const court = matches.find((c) => c.courtIdx === courtIdx)
    if (!court) return
    const slot = getFirstFreeSlot(court)
    if (slot === undefined) return
    await handleMove(playerId, courtIdx, slot)
  }

  const getFirstFreeSlot = (court: CourtWithPlayers) => {
    const occupied = new Set(court.slots.map((entry: { slot: number; player: Player }) => entry.slot))
    return [0, 1, 2, 3].find((idx: number) => !occupied.has(idx))
  }

  const handleQuickAssign = async (playerId: string, courtIdx: number) => {
    const court = matches.find((c) => c.courtIdx === courtIdx)
    if (!court) return
    const slot = getFirstFreeSlot(court)
    if (slot === undefined) {
      setError('Banen er fuld')
      return
    }
    await handleMove(playerId, courtIdx, slot)
    setMoveMenuPlayer(null)
  }

  const getPlayerSlotBgColor = (gender: 'Herre' | 'Dame' | null | undefined) => {
    if (gender === 'Herre') {
      return 'bg-[hsl(205_60%_94%)]' // subtle light blue-tinted
    }
    if (gender === 'Dame') {
      return 'bg-[hsl(340_55%_94%)]' // subtle light rose-tinted
    }
    return 'bg-[hsl(var(--surface))]' // neutral for no gender
  }

  const renderPlayerSlot = (court: CourtWithPlayers, slotIndex: number) => {
    const entry = court.slots.find((slot: { slot: number; player: Player }) => slot.slot === slotIndex)
    const player = entry?.player
    return (
      <div
        key={slotIndex}
        className={`flex min-h-[52px] items-center justify-between rounded-md px-3 py-2 text-sm transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ring-1 ring-[hsl(var(--line)/.12)] ${
          player
            ? `${getPlayerSlotBgColor(player.gender)} hover:shadow-sm`
            : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))]'
        }`}
        onDragOver={(event: React.DragEvent<HTMLDivElement>) => {
          if (!player) event.preventDefault()
        }}
        onDrop={(event: React.DragEvent<HTMLDivElement>) => {
          if (!player) void onDropToSlot(event, court.courtIdx, slotIndex)
        }}
      >
        {player ? (
          <>
            <span
              draggable
              onDragStart={(event: React.DragEvent) => {
                event.dataTransfer.setData('application/x-player-id', player.id)
                event.dataTransfer.effectAllowed = 'move'
              }}
              className="cursor-grab active:cursor-grabbing text-sm font-semibold text-[hsl(var(--foreground))] truncate"
            >
              {player.alias ?? player.name}
            </span>
            <button
              type="button"
              onClick={() => handleMove(player.id)}
              className="rounded px-2 py-1 text-xs font-medium text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.85)] ring-1 ring-[hsl(var(--line)/.12)] transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none flex-shrink-0 ml-1"
            >
              Bænk
            </button>
          </>
        ) : (
          <span className="text-xs text-[hsl(var(--muted))]">Tom plads</span>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <section className="mx-auto flex h-full max-w-5xl items-center justify-center pt-6">
        <p className="text-lg text-[hsl(var(--muted))]">Loader...</p>
      </section>
    )
  }

  return (
    <section className="flex h-full flex-col gap-6 pt-6">
      <header className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Kampprogram</h1>
          <p className="mt-1 text-[hsl(var(--muted))]">Tjekkede spillere: {checkedIn.length}</p>
          {info && (
            <span
              className="mt-2 inline-block rounded-full bg-[hsl(var(--success)/.15)] px-3 py-1 text-sm text-[hsl(var(--success))] transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
              role="status"
              aria-live="polite"
            >
              {info}
            </span>
          )}
          {error && <span className="mt-2 block text-sm text-[hsl(var(--destructive))]">{error}</span>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAutoMatch}
            disabled={!session || bench.length === 0}
            className="rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none bg-[hsl(var(--surface-glass)/.85)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.95)] border-hair disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
          >
            Auto-match
          </button>
          <button
            type="button"
            onClick={handleResetMatches}
            disabled={!session}
            className="rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none bg-transparent text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] border-hair disabled:opacity-40 disabled:cursor-not-allowed ring-focus"
          >
            Nulstil kampe
          </button>
          {session ? (
            <button
              type="button"
              onClick={handleEndTraining}
              className="rounded-md bg-[hsl(var(--destructive))] px-4 py-2 text-sm font-semibold text-white hover:bg-[hsl(var(--destructive)/.9)] transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ring-focus hover:shadow-sm"
            >
              Afslut træning
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartTraining}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ring-focus hover:shadow-sm"
            >
              Start træning
            </button>
          )}
        </div>
      </header>

      {!session && (
        <PageCard className="rounded-full px-6 py-3 text-center text-[hsl(var(--muted))]">
          Start træningen for at begynde at matche spillere på banerne.
        </PageCard>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(200px,240px)_1fr]">
        {/* Bench */}
        <PageCard className="space-y-2" onDragOver={(e) => e.preventDefault()} onDrop={onDropToBench}>
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Bænk</h3>
            <span className="rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-xs font-medium">
              {bench.length}
            </span>
          </header>
          <div className="flex flex-col space-y-2 overflow-y-auto">
            {bench.length === 0 && (
              <p className="rounded-md bg-[hsl(var(--surface-2))] px-2 py-4 text-center text-xs text-[hsl(var(--muted))] border-hair">
                Ingen spillere på bænken
              </p>
            )}
            {bench.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between gap-2 rounded-md border-hair px-2 py-2 min-h-[48px] hover:shadow-sm cursor-grab active:cursor-grabbing transition-all ring-1 ring-[hsl(var(--line)/.12)] ${getPlayerSlotBgColor(player.gender)}`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/x-player-id', player.id)
                  event.dataTransfer.effectAllowed = 'move'
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">{player.alias ?? player.name}</p>
                  <p className="text-[10px] text-[hsl(var(--muted))] truncate">
                    {new Date(player.checkInAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setMoveMenuPlayer(moveMenuPlayer === player.id ? null : player.id)}
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2)/.7)] border-hair transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none hover:shadow-sm"
                  >
                    Flyt
                  </button>
                  {moveMenuPlayer === player.id && (
                    <div className="flex items-center gap-1 text-[10px]">
                      <select
                        className="rounded border-hair bg-[hsl(var(--surface))] px-1 py-0.5 text-[hsl(var(--foreground))] focus:ring-1 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none"
                        defaultValue=""
                        onChange={(event) => {
                          const val = Number(event.target.value)
                          if (!Number.isNaN(val)) void handleQuickAssign(player.id, val)
                        }}
                      >
                        <option value="">Vælg</option>
                        {matches.map((court) => (
                          <option key={court.courtIdx} value={court.courtIdx} disabled={getFirstFreeSlot(court) === undefined}>
                            Bane {court.courtIdx}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </PageCard>

        {/* Courts */}
        <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {matches.map((court) => (
            <PageCard
              key={court.courtIdx}
              className="space-y-2 hover:shadow-md p-4"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => void onDropToCourt(event, court.courtIdx)}
            >
              <header className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">Bane {court.courtIdx}</h3>
                <span className="text-xs text-[hsl(var(--muted))]">{court.slots.length}/{EMPTY_SLOTS}</span>
              </header>
              
              {/* Court visualization: two halves with net divider */}
              <div className="flex flex-col gap-2">
                {/* Top half (slots 0-1) */}
                <div className="flex flex-col gap-1.5">
                  {Array.from({ length: 2 }).map((_, idx) => renderPlayerSlot(court, idx))}
                </div>
                
                {/* Net divider */}
                <div className="relative flex items-center justify-center py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="h-px w-full bg-[hsl(var(--line)/.3)]"></div>
                  </div>
                  <div className="relative bg-[hsl(var(--surface))] px-2">
                    <div className="h-1 w-8 rounded-full bg-[hsl(var(--primary)/.2)] ring-1 ring-[hsl(var(--primary)/.3)]"></div>
                  </div>
                </div>
                
                {/* Bottom half (slots 2-3) */}
                <div className="flex flex-col gap-1.5">
                  {Array.from({ length: 2 }).map((_, idx) => renderPlayerSlot(court, idx + 2))}
                </div>
              </div>
            </PageCard>
          ))}
        </section>
      </div>
    </section>
  )
}

export default CoachPage