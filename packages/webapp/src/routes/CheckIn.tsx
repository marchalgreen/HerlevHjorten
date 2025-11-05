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
    return 'bg-[hsl(205_60%_96%)]' // subtle light blue-tinted
  }
  if (gender === 'Dame') {
    return 'bg-[hsl(340_55%_96%)]' // subtle light rose-tinted
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
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set())
  const [animatingIn, setAnimatingIn] = useState<Set<string>>(new Set())
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
      // Exclude checked-in players from the main list
      if (checkedInIds.has(player.id)) return false
      const matchesLetter =
        filterLetter === 'Alle' || player.name.toLowerCase().startsWith(filterLetter.toLowerCase())
      const nameLower = player.name.toLowerCase()
      const aliasLower = (player.alias ?? '').toLowerCase()
      const matchesSearch =
        !term || nameLower.includes(term) || aliasLower.includes(term)
      return matchesLetter && matchesSearch
    })
  }, [players, search, filterLetter, checkedInIds])

  const handleCheckIn = useCallback(
    async (player: Player, maxRounds?: number) => {
      if (!session) return
      setError(null)
      try {
        // Add animation state for moving out of main list
        setAnimatingOut((prev) => new Set(prev).add(player.id))
        // Add visual feedback immediately
        setJustCheckedIn((prev) => new Set(prev).add(player.id))
        
        // Wait for exit animation
        await new Promise(resolve => setTimeout(resolve, 300))
        
        await api.checkIns.add({ playerId: player.id, maxRounds })
        await loadCheckIns()
        
        // Add animation state for moving into checked-in section
        setAnimatingIn((prev) => new Set(prev).add(player.id))
        setAnimatingOut((prev) => {
          const newSet = new Set(prev)
          newSet.delete(player.id)
          return newSet
        })
        
        const roundsText = maxRounds === 1 ? ' (kun 1 runde)' : ''
        notify({ variant: 'success', title: 'Spiller tjekket ind', description: `${player.name}${roundsText}` })
        
        // Remove visual feedback after animation
        setTimeout(() => {
          setJustCheckedIn((prev) => {
            const newSet = new Set(prev)
            newSet.delete(player.id)
            return newSet
          })
          setAnimatingIn((prev) => {
            const newSet = new Set(prev)
            newSet.delete(player.id)
            return newSet
          })
        }, 400)
      } catch (err: any) {
        setError(err.message ?? 'Kunne ikke tjekke ind')
        // Remove visual feedback on error
        setJustCheckedIn((prev) => {
          const newSet = new Set(prev)
          newSet.delete(player.id)
          return newSet
        })
        setAnimatingOut((prev) => {
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
        // Add animation state for moving out of checked-in section
        setAnimatingOut((prev) => new Set(prev).add(player.id))
        
        // Wait for exit animation
        await new Promise(resolve => setTimeout(resolve, 300))
        
        await api.checkIns.remove({ playerId: player.id })
        await loadCheckIns()
        
        // Add animation state for moving back into main list
        setAnimatingIn((prev) => new Set(prev).add(player.id))
        setAnimatingOut((prev) => {
          const newSet = new Set(prev)
          newSet.delete(player.id)
          return newSet
        })
        
        notify({ variant: 'success', title: 'Spiller tjekket ud', description: player.name })
        
        // Remove animation state after animation
        setTimeout(() => {
          setAnimatingIn((prev) => {
            const newSet = new Set(prev)
            newSet.delete(player.id)
            return newSet
          })
        }, 400)
      } catch (err: any) {
        setError(err.message ?? 'Kunne ikke tjekke ud')
        setAnimatingOut((prev) => {
          const newSet = new Set(prev)
          newSet.delete(player.id)
          return newSet
        })
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

      <div className="grid gap-4 lg:grid-cols-[35%_65%] lg:items-start">
        {/* Checked-in players section */}
        <PageCard className="space-y-2 lg:sticky lg:top-6 lg:self-start">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tjekket ind</h3>
            <span className="rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-xs font-medium">
              {checkedIn.length}
            </span>
          </header>
          <div className="flex flex-col space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
            {checkedIn.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted))] text-center py-4">Ingen spillere tjekket ind</p>
            ) : (
              [...checkedIn].sort((a, b) => {
                const firstNameA = a.name.split(' ')[0] || ''
                const firstNameB = b.name.split(' ')[0] || ''
                return firstNameA.localeCompare(firstNameB, 'da')
              }).map((player) => {
                const isOneRoundOnly = player.maxRounds === 1
                const isAnimatingOut = animatingOut.has(player.id)
                const isAnimatingIn = animatingIn.has(player.id)
                return (
                  <div
                    key={player.id}
                    className={clsx(
                      'flex items-center justify-between gap-2 rounded-md border-hair px-2 py-2 min-h-[48px] hover:shadow-sm transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ring-1 ring-[hsl(var(--line)/.12)]',
                      getInitialsBgColor(player.gender),
                      isAnimatingOut && 'opacity-0 scale-95 translate-x-4 pointer-events-none',
                      isAnimatingIn && 'opacity-0 scale-95 -translate-x-4'
                    )}
                    style={{
                      animation: isAnimatingIn ? 'slideInFromLeft 0.3s ease-out forwards' : undefined
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {getCategoryBadge(player.primaryCategory)}
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
              })
            )}
          </div>
        </PageCard>

        {/* Players overview */}
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
              const oneRoundOnly = oneRoundOnlyPlayers.has(player.id)
              const isJustCheckedIn = justCheckedIn.has(player.id)
              const isAnimatingOut = animatingOut.has(player.id)
              const isAnimatingIn = animatingIn.has(player.id)
              
              return (
                <div
                  key={player.id}
                  onClick={() => {
                    handleCheckIn(player, oneRoundOnly ? 1 : undefined)
                    // Clear the checkbox after check-in
                    const newSet = new Set(oneRoundOnlyPlayers)
                    newSet.delete(player.id)
                    setOneRoundOnlyPlayers(newSet)
                  }}
                  className={clsx(
                    'border-hair flex min-h-[56px] items-center justify-between gap-3 rounded-lg px-3 py-2.5',
                    'transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none',
                    'cursor-pointer hover:shadow-sm hover:ring-[hsl(var(--accent)/.15)] ring-1 ring-[hsl(var(--line)/.12)]',
                    getInitialsBgColor(player.gender),
                    isJustCheckedIn && 'ring-2 ring-[hsl(206_88%_60%)] scale-[1.02] shadow-lg',
                    isAnimatingOut && 'opacity-0 scale-95 -translate-x-4 pointer-events-none',
                    isAnimatingIn && 'opacity-0 scale-95 translate-x-4'
                  )}
                  style={{
                    animation: isAnimatingIn ? 'slideInFromRight 0.3s ease-out forwards' : undefined
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {getCategoryBadge(player.primaryCategory)}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
                        {player.name}
                        {player.alias && (
                          <span className="text-xs font-normal text-[hsl(var(--muted))]"> ({player.alias})</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <label 
                        className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-[hsl(var(--surface-2)/.5)] transition-colors"
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
                          className="w-4 h-4 rounded ring-1 ring-[hsl(var(--line)/.12)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none cursor-pointer flex-shrink-0"
                        />
                        <span className="text-xs text-[hsl(var(--muted))] whitespace-nowrap font-medium">Kun 1 runde</span>
                      </label>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation() // Prevent row click from triggering
                        handleCheckIn(player, oneRoundOnly ? 1 : undefined)
                        // Clear the checkbox after check-in
                        const newSet = new Set(oneRoundOnlyPlayers)
                        newSet.delete(player.id)
                        setOneRoundOnlyPlayers(newSet)
                      }}
                      className={clsx('ring-2 ring-[hsl(var(--accent)/.2)]', 'text-xs px-3 py-1.5')}
                    >
                      Check ind
                    </Button>
                  </div>
                </div>
              )
            })
          )}
          </div>
        </PageCard>
      </div>
    </section>
  )
}

export default CheckInPage