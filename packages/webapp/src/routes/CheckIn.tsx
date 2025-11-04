import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { CheckedInPlayer, Player, TrainingSession } from '@badminton/common'
import { clsx } from 'clsx'
import { UsersRound } from 'lucide-react'
import api from '../api'
import { Button, PageCard, EmptyState, Badge } from '../components/ui'
import { TableSearch } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'

const LETTER_FILTERS = ['Alle', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('')]

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

const CheckInPage = () => {
  const [players, setPlayers] = useState<Player[]>([])
  const [checkedIn, setCheckedIn] = useState<CheckedInPlayer[]>([])
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLetter, setFilterLetter] = useState('Alle')
  const [error, setError] = useState<string | null>(null)
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
    async (player: Player) => {
      if (!session) return
      setError(null)
      try {
        await api.checkIns.add({ playerId: player.id })
        await loadCheckIns()
        notify({ variant: 'success', title: 'Spiller tjekket ind', description: player.name })
      } catch (err: any) {
        setError(err.message ?? 'Kunne ikke tjekke ind')
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
        {error && <span className="mt-2 inline-block text-sm text-[hsl(var(--destructive))]">{error}</span>}
      </header>

      <PageCard className="space-y-6">
        <div className="flex flex-col gap-4">
          <TableSearch value={search} onChange={setSearch} placeholder="Søg efter spiller" />
          <div className="flex gap-2 flex-wrap">
            {LETTER_FILTERS.map((letter) => (
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

        <div className="flex flex-col space-y-3">
          {filteredPlayers.length === 0 ? (
            <EmptyState
              icon={<UsersRound />}
              title="Ingen spillere matcher"
              helper="Prøv en anden søgning eller vælg et andet bogstav."
            />
          ) : (
            filteredPlayers.map((player) => {
              const isChecked = checkedInIds.has(player.id)
              const initials = getInitials(player.name)
              return (
                <div
                  key={player.id}
                  className={clsx(
                    'card-glass-active border-hair flex min-h-[72px] items-center justify-between gap-4 rounded-xl px-4 py-4',
                    'transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none hover:shadow-sm',
                    isChecked && 'bg-[hsl(var(--success)/.06)]'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={clsx(
                      'flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--line)/.12)]',
                      getInitialsBgColor(player.gender)
                    )}>
                      {initials}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-[hsl(var(--foreground))]">{player.name}</p>
                      <p className="text-sm text-[hsl(var(--muted))]">
                        {player.alias ?? 'Ingen kaldenavn'} · Niveau {player.level ?? '–'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={isChecked ? 'success' : 'muted'}>{isChecked ? 'Tjekket ind' : 'Klar'}</Badge>
                    <Button
                      variant={isChecked ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => (isChecked ? handleCheckOut(player) : handleCheckIn(player))}
                      className={clsx(!isChecked && 'ring-2 ring-[hsl(var(--accent)/.2)]')}
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
    </section>
  )
}

export default CheckInPage