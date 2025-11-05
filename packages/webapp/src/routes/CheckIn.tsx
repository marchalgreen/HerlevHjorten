import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { CheckedInPlayer, Player, TrainingSession } from '@badminton/common'
import { clsx } from 'clsx'
import { UsersRound } from 'lucide-react'
import api from '../api'
import { Button, PageCard, EmptyState, Badge } from '../components/ui'
import { TableSearch } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'

const LETTER_FILTERS = ['Alle', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('')]

// Split letters into two balanced rows (15 items each)
const LETTER_FILTERS_ROW1 = ['Alle', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('').slice(0, 14)]
const LETTER_FILTERS_ROW2 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('').slice(14)

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

const getInitialsBgColor = (gender: 'Herre' | 'Dame' | null | undefined) => {
  if (gender === 'Herre') {
    return 'bg-[hsl(205_60%_94%)]' // subtle light blue-tinted
  }
  if (gender === 'Dame') {
    return 'bg-[hsl(340_55%_94%)]' // subtle light rose-tinted
  }
  return 'bg-[hsl(var(--surface-2))]' // neutral gray for no gender
}

const getCategoryBadge = (category: 'Single' | 'Double' | 'Begge' | null | undefined) => {
  if (!category) return null
  const labels: Record<'Single' | 'Double' | 'Begge', string> = {
    Single: 'S',
    Double: 'D',
    Begge: 'B'
  }
  const colors: Record<'Single' | 'Double' | 'Begge', string> = {
    Single: 'bg-[hsl(205_70%_85%)] text-[hsl(205_70%_25%)]',
    Double: 'bg-[hsl(280_60%_85%)] text-[hsl(280_60%_25%)]',
    Begge: 'bg-[hsl(160_50%_85%)] text-[hsl(160_50%_25%)]'
  }
  return (
    <span className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold w-5 h-5 ${colors[category]}`} title={category}>
      {labels[category]}
    </span>
  )
}

const CheckInPage = () => {
  const [players, setPlayers] = useState<Player[]>([])
  const [checkedIn, setCheckedIn] = useState<CheckedInPlayer[]>([])
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLetter, setFilterLetter] = useState('Alle')
  const [error, setError] = useState<string | null>(null)
  const [oneRoundOnlyPlayers, setOneRoundOnlyPlayers] = useState<Set<string>>(new Set())
  const [justCheckedIn, setJustCheckedIn] = useState<Set<string>>(new Set())
  const { notify } = useToast()

  const refreshSession = useCallback(async () => {
    try {
      const active = await api.session.getActive()
      setSession(active)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente træning')
    }
  }, [])

  const loadPlayers = useCallback(async () => {
    try {
      const result = await api.players.list({ active: true })
      setPlayers(result)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente spillere')
    }
  }, [])

  const loadCheckIns = useCallback(async () => {
    if (!session) return
    try {
      const result = await api.checkIns.listActive()
      setCheckedIn(result)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente fremmøde')
    }
  }, [session])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      setError(null)
      await refreshSession()
      await loadPlayers()
      setLoading(false)
    }
    void init()
  }, [refreshSession, loadPlayers])

  useEffect(() => {
    if (!session) {
      setCheckedIn([])
      return
    }
    void loadCheckIns()
  }, [session?.id, loadCheckIns])

  const checkedInIds = useMemo(() => new Set(checkedIn.map((player) => player.id)), [checkedIn])

  const genderBreakdown = useMemo(() => {
    const male = checkedIn.filter((player) => player.gender === 'Herre').length
    const female = checkedIn.filter((player) => player.gender === 'Dame').length
    return { male, female }
  }, [checkedIn])

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return players.filter((player) => {
      const matchesLetter =
        filterLetter === 'Alle' || player.name.toLowerCase().startsWith(filterLetter.toLowerCase())
      const nameLower = player.name.toLowerCase()
      const aliasLower = (player.alias ?? '').toLowerCase()
      const matchesSearch =
        !term || nameLower.includes(term) || aliasLower.includes(term)
      return matchesLetter && matchesSearch
    })
  }, [players, search, filterLetter])

  const handleCheckIn = useCallback(
    async (player: Player, maxRounds?: number) => {
      if (!session) return
      setError(null)
      try {
        // Add visual feedback immediately
        setJustCheckedIn((prev) => new Set(prev).add(player.id))
        await api.checkIns.add({ playerId: player.id, maxRounds })
        await loadCheckIns()
        const roundsText = maxRounds === 1 ? ' (kun 1 runde)' : ''
        notify({ variant: 'success', title: 'Spiller tjekket ind', description: `${player.name}${roundsText}` })
        // Remove visual feedback after animation (scale up then down)
        setTimeout(() => {
          setJustCheckedIn((prev) => {
            const newSet = new Set(prev)
            newSet.delete(player.id)
            return newSet
          })
        }, 500)
      } catch (err: any) {
        setError(err.message ?? 'Kunne ikke tjekke ind')
        // Remove visual feedback on error
        setJustCheckedIn((prev) => {
          const newSet = new Set(prev)
          newSet.delete(player.id)
          return newSet
        })
      }
    },
    [loadCheckIns, notify, session]
  )

  const handleCheckOut = useCallback(
    async (player: Player) => {
      if (!session) return
      setError(null)
      try {
        await api.checkIns.remove({ playerId: player.id })
        await loadCheckIns()
        notify({ variant: 'success', title: 'Spiller tjekket ud', description: player.name })
      } catch (err: any) {
        setError(err.message ?? 'Kunne ikke tjekke ud')
      }
    },
    [loadCheckIns, notify, session]
  )

  if (loading) {
    return (
      <section className="mx-auto flex h-full max-w-4xl items-center justify-center">
        <p className="text-lg text-[hsl(var(--muted))]">Loader...</p>
      </section>
    )
  }

  if (!session) {
    return (
      <section className="mx-auto flex h-full max-w-4xl items-center justify-center p-6">
        <PageCard className="w-full max-w-xl text-center">
          <EmptyState
            icon={<UsersRound />}
            title="Ingen aktiv træning"
            helper="Start en træning i Kampprogrammet for at tjekke spillere ind."
            action={
              <Button variant="primary" onClick={refreshSession}>
                Opdater
              </Button>
            }
          />
        </PageCard>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-6 pt-6">
      <header className="mb-2">
        <h1 className="text-2xl font-semibold">Check ind</h1>
        <p className="mt-1 text-[hsl(var(--muted))]">
          Aktiv træning: {new Date(session.date).toLocaleDateString('da-DK')}
        </p>
        {checkedIn.length > 0 && (
          <div className="mt-2">
            <p className="text-sm text-[hsl(var(--muted))]">Tjekket ind: {checkedIn.length}</p>
            <p className="text-xs text-[hsl(var(--muted))]">
              Herrer: {genderBreakdown.male} • Damer: {genderBreakdown.female}
            </p>
          </div>
        )}
        {error && <span className="mt-2 inline-block text-sm text-[hsl(var(--destructive))]">{error}</span>}
      </header>

      <PageCard className="space-y-6">
        <div className="flex flex-col gap-4">
          <TableSearch value={search} onChange={setSearch} placeholder="Søg efter spiller" />
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap">
              {LETTER_FILTERS_ROW1.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => setFilterLetter(letter)}
                  className={clsx(
                    'rounded-full px-3 py-1 text-sm transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none',
                    filterLetter === letter
                      ? 'bg-accent text-white shadow-[0_2px_8px_hsl(var(--line)/.12)]'
                      : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] hover:text-foreground border-hair'
                  )}
                >
                  {letter}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {LETTER_FILTERS_ROW2.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => setFilterLetter(letter)}
                  className={clsx(
                    'rounded-full px-3 py-1 text-sm transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none',
                    filterLetter === letter
                      ? 'bg-accent text-white shadow-[0_2px_8px_hsl(var(--line)/.12)]'
                      : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] hover:text-foreground border-hair'
                  )}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          {filteredPlayers.length === 0 ? (
            <EmptyState
              icon={<UsersRound />}
              title="Ingen spillere matcher"
              helper="Prøv en anden søgning eller vælg et andet bogstav."
            />
          ) : (
            filteredPlayers.map((player) => {
              const isChecked = checkedInIds.has(player.id)
              const checkedInPlayer = checkedIn.find((p) => p.id === player.id)
              const isOneRoundOnly = checkedInPlayer?.maxRounds === 1
              const oneRoundOnly = oneRoundOnlyPlayers.has(player.id)
              const isJustCheckedIn = justCheckedIn.has(player.id)
              const initials = getInitials(player.name)
              
              return (
                <div
                  key={player.id}
                  onClick={() => {
                    if (!isChecked) {
                      handleCheckIn(player, oneRoundOnly ? 1 : undefined)
                      // Clear the checkbox after check-in
                      const newSet = new Set(oneRoundOnlyPlayers)
                      newSet.delete(player.id)
                      setOneRoundOnlyPlayers(newSet)
                    }
                  }}
                  className={clsx(
                    'border-hair flex min-h-[56px] items-center justify-between gap-3 rounded-lg px-3 py-2.5',
                    'transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none',
                    !isChecked && 'card-glass-active cursor-pointer hover:shadow-sm hover:ring-[hsl(var(--accent)/.15)]',
                    isChecked && 'bg-[hsl(206_88%_92%)] ring-1 ring-[hsl(206_88%_85%)]',
                    isJustCheckedIn && 'bg-[hsl(206_88%_75%)] ring-2 ring-[hsl(206_88%_60%)] scale-[1.02] shadow-lg'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--line)/.12)] flex-shrink-0',
                      getInitialsBgColor(player.gender)
                    )}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
                        {player.name}
                        {player.alias && (
                          <span className="text-xs font-normal text-[hsl(var(--muted))]"> ({player.alias})</span>
                        )}
                        {isOneRoundOnly && (
                          <span className="ml-1.5 text-[10px] text-[hsl(var(--muted))]">• Kun 1 runde</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isChecked && (
                      <label 
                        className="flex items-center gap-1.5 cursor-pointer"
                        onClick={(e) => e.stopPropagation()} // Prevent row click from triggering
                      >
                        <input
                          type="checkbox"
                          checked={oneRoundOnly}
                          onChange={(e) => {
                            const newSet = new Set(oneRoundOnlyPlayers)
                            if (e.target.checked) {
                              newSet.add(player.id)
                            } else {
                              newSet.delete(player.id)
                            }
                            setOneRoundOnlyPlayers(newSet)
                          }}
                          className="w-3.5 h-3.5 rounded ring-1 ring-[hsl(var(--line)/.12)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none cursor-pointer"
                        />
                        <span className="text-[10px] text-[hsl(var(--muted))] whitespace-nowrap">Kun 1 runde</span>
                      </label>
                    )}
                    {isChecked && <Badge variant="success" className="text-[10px] px-2 py-0.5">Tjekket ind</Badge>}
                    <Button
                      variant={isChecked ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation() // Prevent row click from triggering
                        if (isChecked) {
                          handleCheckOut(player)
                        } else {
                          handleCheckIn(player, oneRoundOnly ? 1 : undefined)
                          // Clear the checkbox after check-in
                          const newSet = new Set(oneRoundOnlyPlayers)
                          newSet.delete(player.id)
                          setOneRoundOnlyPlayers(newSet)
                        }
                      }}
                      className={clsx(!isChecked && 'ring-2 ring-[hsl(var(--accent)/.2)]', 'text-xs px-3 py-1.5')}
                    >
                      {isChecked ? 'Check ud' : 'Check ind'}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </PageCard>

      {/* Checked-in players section */}
      {checkedIn.length > 0 && (
        <PageCard className="space-y-2">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tjekket ind</h3>
            <span className="rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-xs font-medium">
              {checkedIn.length}
            </span>
          </header>
          <div className="flex flex-col space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
            {checkedIn.map((player) => {
              const initials = getInitials(player.name)
              const isOneRoundOnly = player.maxRounds === 1
              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between gap-2 rounded-md border-hair px-2 py-2 min-h-[48px] hover:shadow-sm transition-all ring-1 ring-[hsl(var(--line)/.12)] bg-[hsl(206_88%_92%)]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={clsx(
                      'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--line)/.12)] flex-shrink-0',
                      getInitialsBgColor(player.gender)
                    )}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">
                        {player.name}
                        {player.alias && (
                          <span className="text-[10px] font-normal text-[hsl(var(--muted))]"> ({player.alias})</span>
                        )}
                        {isOneRoundOnly && (
                          <span className="ml-1.5 text-[10px] text-[hsl(var(--muted))]">• Kun 1 runde</span>
                        )}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {getCategoryBadge(player.primaryCategory)}
                        <p className="text-[10px] text-[hsl(var(--muted))] truncate">
                          Niveau {player.level ?? '–'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCheckOut(player)}
                    className="text-xs px-3 py-1.5 flex-shrink-0"
                  >
                    Check ud
                  </Button>
                </div>
              )
            })}
          </div>
        </PageCard>
      )}
    </section>
  )
}

export default CheckInPage