import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { Player, PlayerStatistics } from '@rundeklar/common'
import { BarChart3, Users, Target, X, Search } from 'lucide-react'
import api from '../api'
import statsApi from '../api/stats'
import { PageCard } from '../components/ui'
import { TableSearch } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'

/**
 * Formats a date string to Danish locale format.
 * @param dateStr - ISO date string
 * @returns Formatted date string
 */
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Aldrig'
  return new Intl.DateTimeFormat('da-DK', {
    dateStyle: 'medium'
  }).format(new Date(dateStr))
}

/**
 * Statistics dashboard page — displays player statistics and analytics.
 * @remarks Renders player selector, overview metrics, top partners/opponents,
 * and additional analytics. Delegates data operations to statsApi.
 */
const StatisticsPage = () => {
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [statistics, setStatistics] = useState<PlayerStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { notify } = useToast()
  
  // Player comparison state
  const [comparisonSearch, setComparisonSearch] = useState('')
  const [comparisonPlayerId, setComparisonPlayerId] = useState<string | null>(null)
  const [comparisonStats, setComparisonStats] = useState<{ partnerCount: number; opponentCount: number } | null>(null)
  const [loadingComparison, setLoadingComparison] = useState(false)
  const [showComparisonSearch, setShowComparisonSearch] = useState(false)

  /** Loads all players from API. */
  const loadPlayers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.players.list()
      setPlayers(result)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente spillere')
    } finally {
      setLoading(false)
    }
  }, [])

  /** Loads player statistics from API. */
  const loadStatistics = useCallback(
    async (playerId: string) => {
      setLoadingStats(true)
      setError(null)
      try {
        const stats = await statsApi.getPlayerStatistics(playerId)
        setStatistics(stats)
      } catch (err: any) {
        setError(err.message ?? 'Kunne ikke hente statistik')
        notify({ variant: 'danger', title: err.message ?? 'Kunne ikke hente statistik' })
      } finally {
        setLoadingStats(false)
      }
    },
    [notify]
  )

  // WHY: Load players on mount
  useEffect(() => {
    void loadPlayers()
  }, [loadPlayers])

  // WHY: Load statistics when player is selected
  useEffect(() => {
    if (selectedPlayerId) {
      void loadStatistics(selectedPlayerId)
    } else {
      setStatistics(null)
    }
  }, [selectedPlayerId, loadStatistics])

  /** Memoized filtered players list — applies search term to name/alias. */
  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return players
    return players.filter((player) => {
      const alias = (player.alias ?? '').toLowerCase()
      return player.name.toLowerCase().includes(term) || alias.includes(term)
    })
  }, [players, search])

  /** Selected player object. */
  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null
    return players.find((p) => p.id === selectedPlayerId) ?? null
  }, [players, selectedPlayerId])

  /** Comparison player object. */
  const comparisonPlayer = useMemo(() => {
    if (!comparisonPlayerId) return null
    return players.find((p) => p.id === comparisonPlayerId) ?? null
  }, [players, comparisonPlayerId])

  /** Memoized filtered players list for comparison — applies search term to name/alias. */
  const filteredComparisonPlayers = useMemo(() => {
    const term = comparisonSearch.trim().toLowerCase()
    if (!term) return players.filter((p) => p.id !== selectedPlayerId)
    return players.filter((player) => {
      if (player.id === selectedPlayerId) return false
      const alias = (player.alias ?? '').toLowerCase()
      return player.name.toLowerCase().includes(term) || alias.includes(term)
    })
  }, [players, comparisonSearch, selectedPlayerId])

  /** Loads comparison statistics between two players. */
  const loadComparison = useCallback(
    async (playerId1: string, playerId2: string) => {
      setLoadingComparison(true)
      setError(null)
      try {
        const stats = await statsApi.getPlayerComparison(playerId1, playerId2)
        setComparisonStats(stats)
      } catch (err: any) {
        setError(err.message ?? 'Kunne ikke hente sammenligning')
        notify({ variant: 'danger', title: err.message ?? 'Kunne ikke hente sammenligning' })
      } finally {
        setLoadingComparison(false)
      }
    },
    [notify]
  )

  // WHY: Load comparison when both players are selected
  useEffect(() => {
    if (selectedPlayerId && comparisonPlayerId) {
      void loadComparison(selectedPlayerId, comparisonPlayerId)
    } else {
      setComparisonStats(null)
    }
  }, [selectedPlayerId, comparisonPlayerId, loadComparison])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-3 sm:p-4">
        <p className="text-sm sm:text-base text-[hsl(var(--muted))]">Indlæser...</p>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4 sm:gap-6 pt-2 sm:pt-4 xl:pt-2">
      <header className="flex flex-col gap-2 sm:gap-3 mb-2 lg:mb-1.5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))]">Statistik</h1>
            <p className="text-xs sm:text-sm md:text-base text-[hsl(var(--muted))] mt-1">Se spillernes statistik og sammenlign data.</p>
          </div>
        </div>
      </header>

      {/* FilterBar */}
      {selectedPlayer ? (
        <div className="card-glass-active border-hair rounded-lg p-3 sm:p-4 md:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] font-semibold text-xs sm:text-sm flex-shrink-0">
                {selectedPlayer.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs sm:text-sm font-semibold text-[hsl(var(--foreground))] truncate">{selectedPlayer.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowSearch(!showSearch)}
                className="rounded-full bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] border-hair px-2 py-1 text-xs transition-colors motion-reduce:transition-none flex items-center gap-1.5 focus-visible:ring-focus"
                title="Skift spiller"
              >
                <Search className="w-3 h-3" />
                <span className="hidden sm:inline">Skift</span>
              </button>
              <button
                type="button"
                onClick={() => setShowComparisonSearch(!showComparisonSearch)}
                className={`rounded-full border-hair px-2 py-1 text-xs transition-colors motion-reduce:transition-none flex items-center gap-1.5 focus-visible:ring-focus ${
                  showComparisonSearch || comparisonPlayer
                    ? 'bg-[hsl(var(--surface))] text-[hsl(var(--foreground))] border-hair shadow-sm'
                    : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))]'
                }`}
                title="Sammenlign med anden spiller"
              >
                <span className="hidden sm:inline">Sammenlign</span>
                <span className="sm:hidden">Sml.</span>
              </button>
            </div>
          </div>
          {showSearch && (
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-hair">
              <div className="flex flex-col gap-2 sm:gap-3">
                <TableSearch
                  value={search}
                  onChange={(value) => setSearch(value)}
                  placeholder="Søg efter spiller..."
                />
                <div className="max-h-[200px] overflow-y-auto border-hair rounded-lg">
                  {filteredPlayers.length === 0 ? (
                    <div className="p-2 sm:p-3 text-center text-xs sm:text-sm text-[hsl(var(--muted))]">Ingen spillere fundet</div>
                  ) : (
                    <div className="divide-y divide-[hsl(var(--line)/.12)]">
                      {filteredPlayers.map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlayerId(player.id)
                            setShowSearch(false)
                            setSearch('')
                          }}
                          className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left hover:bg-[hsl(var(--surface-2))] transition-colors motion-reduce:transition-none focus-visible:ring-focus ${
                            selectedPlayerId === player.id ? 'bg-[hsl(var(--primary)/.1)]' : ''
                          }`}
                        >
                          <span className="text-xs sm:text-sm font-medium text-[hsl(var(--foreground))]">{player.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {(showComparisonSearch || comparisonPlayer) && (
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-hair">
              {!comparisonPlayer ? (
                <div className="space-y-2 sm:space-y-3">
                  <TableSearch
                    value={comparisonSearch}
                    onChange={(value) => {
                      setComparisonSearch(value)
                      if (value.trim()) {
                        setShowComparisonSearch(true)
                      }
                    }}
                    placeholder="Søg efter spiller at sammenligne med..."
                  />
                  {showComparisonSearch && filteredComparisonPlayers.length > 0 && (
                    <div className="max-h-[200px] overflow-y-auto border-hair rounded-lg">
                      <div className="divide-y divide-[hsl(var(--line)/.12)]">
                        {filteredComparisonPlayers.map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => {
                              setComparisonPlayerId(player.id)
                              setComparisonSearch('')
                              setShowComparisonSearch(false)
                            }}
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left hover:bg-[hsl(var(--surface-2))] transition-colors motion-reduce:transition-none focus-visible:ring-focus"
                          >
                            <span className="text-xs sm:text-sm font-medium text-[hsl(var(--foreground))]">{player.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] font-semibold text-xs sm:text-sm flex-shrink-0">
                        {comparisonPlayer.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs sm:text-sm text-[hsl(var(--muted))]">Sammenlignet med</span>
                        <span className="text-xs sm:text-sm font-semibold text-[hsl(var(--foreground))] truncate">{comparisonPlayer.name}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setComparisonPlayerId(null)
                        setComparisonSearch('')
                        setShowComparisonSearch(false)
                      }}
                      className="h-6 w-6 rounded-full bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] border-hair transition-colors motion-reduce:transition-none flex items-center justify-center focus-visible:ring-focus flex-shrink-0"
                      title="Fjern sammenligning"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  
                  {loadingComparison ? (
                    <div className="flex items-center justify-center py-3 sm:py-4">
                      <p className="text-xs sm:text-sm text-[hsl(var(--muted))]">Indlæser sammenligning...</p>
                    </div>
                  ) : comparisonStats ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                      <div className="flex items-center justify-between rounded-md bg-[hsl(var(--surface))] border-hair px-2 sm:px-3 py-1.5 sm:py-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[hsl(var(--primary))] flex-shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs sm:text-sm text-[hsl(var(--muted))]">Spillet sammen</span>
                            <span className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))]">
                              {comparisonStats.partnerCount} {comparisonStats.partnerCount === 1 ? 'gang' : 'gange'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-[hsl(var(--surface))] border-hair px-2 sm:px-3 py-1.5 sm:py-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <Target className="w-4 h-4 sm:w-5 sm:h-5 text-[hsl(var(--danger))] flex-shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs sm:text-sm text-[hsl(var(--muted))]">Spillet mod</span>
                            <span className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))]">
                              {comparisonStats.opponentCount} {comparisonStats.opponentCount === 1 ? 'gang' : 'gange'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <PageCard>
          <div className="flex flex-col gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-[hsl(var(--foreground))] mb-1.5 sm:mb-2">
                Vælg spiller
              </label>
              <TableSearch
                value={search}
                onChange={(value) => setSearch(value)}
                placeholder="Søg efter spiller..."
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto border-hair rounded-lg">
              {filteredPlayers.length === 0 ? (
                <div className="p-3 sm:p-4 text-center text-xs sm:text-sm text-[hsl(var(--muted))]">Ingen spillere fundet</div>
              ) : (
                <div className="divide-y divide-[hsl(var(--line)/.12)]">
                  {filteredPlayers.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => setSelectedPlayerId(player.id)}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-left hover:bg-[hsl(var(--surface-2))] transition-colors motion-reduce:transition-none focus-visible:ring-focus"
                    >
                      <span className="text-sm sm:text-base font-medium text-[hsl(var(--foreground))]">{player.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PageCard>
      )}

      {/* Statistics Display */}
      {selectedPlayer && (
        <div className="space-y-4 sm:space-y-6">
          {loadingStats ? (
            <>
              {/* KPI Skeletons */}
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="card-glass-active border-hair rounded-lg p-3 sm:p-4 md:p-5 shadow-sm">
                    <div className="flex flex-col justify-between gap-1">
                      <div className="h-3 sm:h-4 w-20 sm:w-24 bg-[hsl(var(--surface-2))] rounded animate-pulse" />
                      <div className="h-6 sm:h-8 w-12 sm:w-16 bg-[hsl(var(--surface-2))] rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
              {/* Season List Skeleton */}
              <div className="card-glass-active border-hair rounded-lg p-4 md:p-5 shadow-sm">
                <div className="space-y-3">
                  <div className="h-5 w-48 bg-[hsl(var(--surface-2))] rounded animate-pulse" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 bg-[hsl(var(--surface-2))] rounded-md animate-pulse" />
                    ))}
                  </div>
                </div>
              </div>
              {/* Top Lists Skeletons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <div key={i} className="card-glass-active border-hair rounded-lg p-4 md:p-5 shadow-sm">
                    <div className="space-y-3">
                      <div className="h-5 w-32 bg-[hsl(var(--surface-2))] rounded animate-pulse" />
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map((j) => (
                          <div key={j} className="h-10 bg-[hsl(var(--surface-2))] rounded-md animate-pulse" />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : statistics ? (
            <>
              {/* KPI Tiles */}
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card-glass-active border-hair rounded-lg p-3 sm:p-4 md:p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-1">
                <span className="text-xs sm:text-sm text-[hsl(var(--muted))]">Indtjekninger</span>
                <span className="text-xl sm:text-2xl font-semibold text-[hsl(var(--foreground))]">{statistics.totalCheckIns}</span>
                <span className="text-xs sm:text-sm text-[hsl(var(--muted))]">Total</span>
              </div>
            </div>
            <div className="card-glass-active border-hair rounded-lg p-3 sm:p-4 md:p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-1">
                <span className="text-xs sm:text-sm text-[hsl(var(--muted))]">Kampe</span>
                <span className="text-xl sm:text-2xl font-semibold text-[hsl(var(--foreground))]">{statistics.totalMatches}</span>
                <span className="text-xs sm:text-sm text-[hsl(var(--muted))]">Total</span>
              </div>
            </div>
            <div className="card-glass-active border-hair rounded-lg p-3 sm:p-4 md:p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-1">
                <span className="text-xs sm:text-sm text-[hsl(var(--muted))]">Sidst spillet</span>
                <span className="text-lg sm:text-xl md:text-2xl font-semibold text-[hsl(var(--foreground))]">
                  {formatDate(statistics.lastPlayedDate)}
                </span>
              </div>
            </div>
            <div className="card-glass-active border-hair rounded-lg p-3 sm:p-4 md:p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-1">
                <span className="text-xs sm:text-sm text-[hsl(var(--muted))]">Mest spillede kategori</span>
                <span className="text-lg sm:text-xl md:text-2xl font-semibold text-[hsl(var(--foreground))]">
                  {statistics.preferredCategory ?? 'Ingen'}
                </span>
              </div>
            </div>
          </div>

          {/* Check-ins by Season */}
          {Object.keys(statistics.checkInsBySeason).length > 0 && (
            <div className="card-glass-active border-hair rounded-lg p-3 sm:p-4 md:p-5 shadow-sm">
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-sm sm:text-base font-semibold text-[hsl(var(--foreground))]">Indtjekninger pr. sæson</h3>
                <div className="space-y-1.5 sm:space-y-2">
                  {Object.entries(statistics.checkInsBySeason)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([season, count]) => (
                      <div key={season} className="flex items-center justify-between rounded-md bg-[hsl(var(--surface))] border-hair px-2 sm:px-3 py-1.5 sm:py-2 hover:shadow-sm transition-shadow motion-reduce:transition-none">
                        <span className="text-xs sm:text-sm text-[hsl(var(--foreground))]">Sæson {season}</span>
                        <span className="rounded-full bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] border-hair px-2 py-0.5 sm:py-1 text-xs">
                          {String(count)} {Number(count) === 1 ? 'gang' : 'gange'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Top Partners and Opponents Section - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
            {/* Top Partners Section */}
            <div className="card-glass-active border-hair rounded-lg p-3 sm:p-4 md:p-5 shadow-sm">
              <div className="space-y-2 sm:space-y-3">
                <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--foreground))]">Top 5 makkere</h2>
                {statistics.partners.length === 0 ? (
                  <p className="text-xs sm:text-sm text-[hsl(var(--muted))]">Ingen partnerdata tilgængelig</p>
                ) : (
                  <div className="space-y-1.5 sm:space-y-2">
                    {statistics.partners.map((partner, index) => (
                      <div
                        key={partner.playerId}
                        className="flex items-center justify-between rounded-md bg-[hsl(var(--surface))] border-hair px-2 sm:px-3 py-1.5 sm:py-2"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="h-5 w-5 sm:h-6 sm:w-6 grid place-items-center rounded-full bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] border-hair text-xs font-semibold flex-shrink-0">
                            {index + 1}
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-[hsl(var(--foreground))] truncate">{partner.names}</span>
                        </div>
                        <span className="rounded-full bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] border-hair px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs flex-shrink-0 ml-1 sm:ml-2">
                          {partner.count} {partner.count === 1 ? 'gang' : 'gange'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Opponents Section */}
            <div className="card-glass-active border-hair rounded-lg p-3 sm:p-4 md:p-5 shadow-sm">
              <div className="space-y-2 sm:space-y-3">
                <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--foreground))]">Top 5 modstandere</h2>
                {statistics.opponents.length === 0 ? (
                  <p className="text-xs sm:text-sm text-[hsl(var(--muted))]">Ingen modstanderdata tilgængelig</p>
                ) : (
                  <div className="space-y-1.5 sm:space-y-2">
                    {statistics.opponents.map((opponent, index) => (
                      <div
                        key={opponent.playerId}
                        className="flex items-center justify-between rounded-md bg-[hsl(var(--surface))] border-hair px-2 sm:px-3 py-1.5 sm:py-2"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="h-5 w-5 sm:h-6 sm:w-6 grid place-items-center rounded-full bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] border-hair text-xs font-semibold flex-shrink-0">
                            {index + 1}
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-[hsl(var(--foreground))] truncate">{opponent.names}</span>
                        </div>
                        <span className="rounded-full bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] border-hair px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs flex-shrink-0 ml-1 sm:ml-2">
                          {opponent.count} {opponent.count === 1 ? 'gang' : 'gange'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

            </>
          ) : null}
        </div>
      )}

      {/* Empty State */}
      {!selectedPlayer && !loading && (
        <PageCard>
          <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
            <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 text-[hsl(var(--muted))] mb-3 sm:mb-4" />
            <p className="text-base sm:text-lg font-medium text-[hsl(var(--foreground))] mb-1.5 sm:mb-2">Vælg en spiller</p>
            <p className="text-xs sm:text-sm text-[hsl(var(--muted))] px-4">Vælg en spiller for at se statistik.</p>
          </div>
        </PageCard>
      )}

      {/* Error Display */}
      {error && (
        <PageCard>
          <div className="p-3 sm:p-4 bg-[hsl(var(--destructive)/.1)] ring-1 ring-[hsl(var(--destructive)/.2)] rounded-lg">
            <p className="text-xs sm:text-sm text-[hsl(var(--destructive))]">{error}</p>
          </div>
        </PageCard>
      )}
    </section>
  )
}

export default StatisticsPage
