import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { Player, PlayerStatistics } from '@herlev-hjorten/common'
import { BarChart3, TrendingUp, Users, Target, X, Search } from 'lucide-react'
import api from '../api'
import statsApi from '../api/stats'
import { Badge, PageCard } from '../components/ui'
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
  const [isGeneratingDummyData, setIsGeneratingDummyData] = useState(false)
  const [hasHistoricalData, setHasHistoricalData] = useState(false)
  const { notify } = useToast()

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
        notify(err.message ?? 'Kunne ikke hente statistik', 'error')
      } finally {
        setLoadingStats(false)
      }
    },
    [notify]
  )

  /** Checks if historical data exists. */
  const checkHistoricalData = useCallback(async () => {
    try {
      const seasons = await statsApi.getAllSeasons()
      setHasHistoricalData(seasons.length > 0)
    } catch {
      setHasHistoricalData(false)
    }
  }, [])

  /** Generates dummy historical data for demo purposes. */
  const handleGenerateDummyData = useCallback(async () => {
    setIsGeneratingDummyData(true)
    setError(null)
    try {
      await statsApi.generateDummyHistoricalData()
      await checkHistoricalData()
      notify('Historiske dummy data er blevet genereret', 'success')
      // Reload statistics if a player is selected
      if (selectedPlayerId) {
        await loadStatistics(selectedPlayerId)
      }
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke generere dummy data')
      notify(err.message ?? 'Kunne ikke generere dummy data', 'error')
    } finally {
      setIsGeneratingDummyData(false)
    }
  }, [selectedPlayerId, loadStatistics, checkHistoricalData, notify])

  // WHY: Load players on mount
  useEffect(() => {
    void loadPlayers()
    void checkHistoricalData()
  }, [loadPlayers, checkHistoricalData])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-[hsl(var(--muted))]">Indlæser...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Statistik</h1>
        <button
          type="button"
          onClick={handleGenerateDummyData}
          disabled={isGeneratingDummyData}
          className="px-4 py-2 text-sm font-medium text-white bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.9)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          {isGeneratingDummyData ? 'Genererer...' : 'Demo: Input historiske dummy data'}
        </button>
      </div>

      {/* Player Selector */}
      {selectedPlayer ? (
        <PageCard className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] font-semibold text-sm flex-shrink-0">
                {selectedPlayer.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm text-[hsl(var(--muted))]">Valgt spiller</span>
                <span className="font-semibold text-[hsl(var(--foreground))] truncate">{selectedPlayer.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowSearch(!showSearch)}
                className="px-3 py-2 text-sm font-medium text-[hsl(var(--foreground))] bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--surface-glass)/.85)] rounded-lg transition-colors flex items-center gap-2"
                title="Skift spiller"
              >
                <Search className="w-4 h-4" />
                Skift
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPlayerId(null)
                  setShowSearch(false)
                  setSearch('')
                }}
                className="px-3 py-2 text-sm font-medium text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2))] rounded-lg transition-colors flex items-center gap-2"
                title="Fjern valg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {showSearch && (
            <div className="mt-4 pt-4 border-t border-[hsl(var(--line)/.12)]">
              <div className="flex flex-col gap-3">
                <TableSearch
                  value={search}
                  onChange={(value) => setSearch(value)}
                  placeholder="Søg efter spiller..."
                />
                <div className="max-h-[200px] overflow-y-auto border border-[hsl(var(--line)/.12)] rounded-lg">
                  {filteredPlayers.length === 0 ? (
                    <div className="p-3 text-center text-sm text-[hsl(var(--muted))]">Ingen spillere fundet</div>
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
                          className={`w-full px-3 py-2 text-left hover:bg-[hsl(var(--surface-2))] transition-colors ${
                            selectedPlayerId === player.id ? 'bg-[hsl(var(--primary)/.1)]' : ''
                          }`}
                        >
                          <span className="text-sm font-medium text-[hsl(var(--foreground))]">{player.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </PageCard>
      ) : (
        <PageCard>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                Vælg spiller
              </label>
              <TableSearch
                value={search}
                onChange={(value) => setSearch(value)}
                placeholder="Søg efter spiller..."
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto border border-[hsl(var(--line)/.12)] rounded-lg">
              {filteredPlayers.length === 0 ? (
                <div className="p-4 text-center text-sm text-[hsl(var(--muted))]">Ingen spillere fundet</div>
              ) : (
                <div className="divide-y divide-[hsl(var(--line)/.12)]">
                  {filteredPlayers.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => setSelectedPlayerId(player.id)}
                      className="w-full px-4 py-3 text-left hover:bg-[hsl(var(--surface-2))] transition-colors"
                    >
                      <span className="font-medium text-[hsl(var(--foreground))]">{player.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PageCard>
      )}

      {/* Statistics Display */}
      {selectedPlayer && statistics && (
        <div className="flex flex-col gap-6">
          {/* Overview Section */}
          <PageCard>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-[hsl(var(--primary))]" />
              <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">Oversigt</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-[hsl(var(--muted))]">Total indtjekninger</span>
                <span className="text-2xl font-bold text-[hsl(var(--foreground))]">{statistics.totalCheckIns}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-[hsl(var(--muted))]">Total kampe</span>
                <span className="text-2xl font-bold text-[hsl(var(--foreground))]">{statistics.totalMatches}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-[hsl(var(--muted))]">Sidst spillet</span>
                <span className="text-lg font-semibold text-[hsl(var(--foreground))]">
                  {formatDate(statistics.lastPlayedDate)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-[hsl(var(--muted))]">Mest spillede kategori</span>
                <span className="text-lg font-semibold text-[hsl(var(--foreground))]">
                  {statistics.preferredCategory ?? 'Ingen'}
                </span>
              </div>
            </div>

            {/* Check-ins by Season */}
            {Object.keys(statistics.checkInsBySeason).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-[hsl(var(--foreground))] mb-3">Indtjekninger pr. sæson</h3>
                <div className="space-y-2">
                  {Object.entries(statistics.checkInsBySeason)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([season, count]) => (
                      <div key={season} className="flex items-center gap-3">
                        <span className="text-sm text-[hsl(var(--muted))]">Sæson {season}</span>
                        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </PageCard>

          {/* Top Partners and Opponents Section - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Partners Section */}
            <PageCard>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-[hsl(var(--primary))]" />
                <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">Top 5 makkere</h2>
              </div>
              {statistics.partners.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted))]">Ingen partnerdata tilgængelig</p>
              ) : (
                <div className="space-y-3">
                  {statistics.partners.map((partner, index) => (
                    <div
                      key={partner.playerId}
                      className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-2))]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] font-bold text-sm">
                          {index + 1}
                        </div>
                        <span className="font-medium text-[hsl(var(--foreground))]">{partner.names}</span>
                      </div>
                      <Badge variant="default" className="text-xs">
                        {partner.count} {partner.count === 1 ? 'gang' : 'gange'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </PageCard>

            {/* Top Opponents Section */}
            <PageCard>
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-[hsl(var(--primary))]" />
                <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">Top 5 modstandere</h2>
              </div>
              {statistics.opponents.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted))]">Ingen modstanderdata tilgængelig</p>
              ) : (
                <div className="space-y-3">
                  {statistics.opponents.map((opponent, index) => (
                    <div
                      key={opponent.playerId}
                      className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-2))]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))] font-bold text-sm">
                          {index + 1}
                        </div>
                        <span className="font-medium text-[hsl(var(--foreground))]">{opponent.names}</span>
                      </div>
                      <Badge variant="danger" className="text-xs">
                        {opponent.count} {opponent.count === 1 ? 'gang' : 'gange'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </PageCard>
          </div>

          {/* Additional Metrics Section */}
          <PageCard>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-[hsl(var(--primary))]" />
              <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">Yderligere statistik</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {statistics.mostPlayedCourt !== null && (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-[hsl(var(--muted))]">Mest spillede bane</span>
                  <span className="text-lg font-semibold text-[hsl(var(--foreground))]">Bane {statistics.mostPlayedCourt}</span>
                </div>
              )}
              {statistics.averageLevelDifference !== null && (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-[hsl(var(--muted))]">Gennemsnitlig niveauforskel</span>
                  <span className="text-lg font-semibold text-[hsl(var(--foreground))]">
                    {Math.round(statistics.averageLevelDifference)} point
                  </span>
                </div>
              )}
              {Object.keys(statistics.matchesBySeason).length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-[hsl(var(--muted))]">Kampe pr. sæson</span>
                  <div className="mt-2 space-y-1">
                    {Object.entries(statistics.matchesBySeason)
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([season, count]) => (
                        <div key={season} className="flex items-center justify-between text-sm">
                          <span className="text-[hsl(var(--muted))]">Sæson {season}</span>
                          <span className="font-semibold text-[hsl(var(--foreground))]">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </PageCard>
        </div>
      )}

      {/* Loading Stats Indicator */}
      {selectedPlayer && loadingStats && (
        <PageCard>
          <div className="flex items-center justify-center py-8">
            <p className="text-[hsl(var(--muted))]">Indlæser statistik...</p>
          </div>
        </PageCard>
      )}

      {/* Empty State */}
      {!selectedPlayer && !loading && (
        <PageCard>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="w-12 h-12 text-[hsl(var(--muted))] mb-4" />
            <p className="text-lg font-medium text-[hsl(var(--foreground))] mb-2">Vælg en spiller</p>
            <p className="text-sm text-[hsl(var(--muted))]">Vælg en spiller fra listen ovenfor for at se deres statistik</p>
          </div>
        </PageCard>
      )}

      {/* Error Display */}
      {error && (
        <PageCard>
          <div className="p-4 bg-[hsl(var(--destructive)/.1)] border border-[hsl(var(--destructive)/.2)] rounded-lg">
            <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
          </div>
        </PageCard>
      )}
    </div>
  )
}

export default StatisticsPage
