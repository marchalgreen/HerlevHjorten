/**
 * Check-in page — manages player check-in/out for active training session.
 * 
 * @remarks Renders active session UI, filters players, and handles check-in/out
 * with animations. Uses custom hooks for data management and sub-components for UI.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { Player } from '@herlev-hjorten/common'
import { UsersRound } from 'lucide-react'
import { PageCard, EmptyState, Button } from '../components/ui'
import { TableSearch } from '../components/ui/Table'
import { PlayerCard, CheckedInPlayerCard, LetterFilters, AnimatedList } from '../components/checkin'
import { useSession, useCheckIns, usePlayers } from '../hooks'
import { formatDate } from '../lib/formatting'
import { LETTER_FILTERS, UI_CONSTANTS } from '../constants'
import coachLandingApi from '../services/coachLandingApi'
import CrossGroupSearchModal from '../components/checkin/CrossGroupSearchModal'
import api from '../api'
import { getPlayerUiVariant, setPlayerUiVariant } from '../lib/uiVariants'

/**
 * Check-in page component.
 * 
 * @example
 * ```tsx
 * <CheckInPage />
 * ```
 */
const CheckInPage = () => {
  // Data hooks
  const { session, loading: sessionLoading } = useSession()
  const { players, loading: playersLoading, refetch: refetchPlayers } = usePlayers({ active: true })
  const { checkedIn, checkIn, checkOut } = useCheckIns(session?.id ?? null)

  // UI state
  const [search, setSearch] = useState('')
  // Optional defaults from coach landing handoff
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null)
  const [extraAllowedIds, setExtraAllowedIds] = useState<Set<string>>(new Set())
  const [filterLetter, setFilterLetter] = useState<string>(LETTER_FILTERS.ALL)
  const [oneRoundOnlyPlayers, setOneRoundOnlyPlayers] = useState<Set<string>>(new Set())
  const [justCheckedIn, setJustCheckedIn] = useState<Set<string>>(new Set())
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set())
  const [animatingIn, setAnimatingIn] = useState<Set<string>>(new Set())
  // Cross-group search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; displayName: string; groupId: string | null }>>([])
  const [searching, setSearching] = useState(false)
  const [searchOpener, setSearchOpener] = useState<HTMLElement | null>(null)
  // Confirm action modal for picked cross-group player
  const [confirmPlayerId, setConfirmPlayerId] = useState<string | null>(null)
  // Derived prevent-pick set (extra allowed + already checked-in)
  const pickedIdsSet = useMemo(() => {
    const ids = new Set<string>(extraAllowedIds)
    checkedIn.forEach((p) => ids.add(p.id))
    return ids
  }, [extraAllowedIds, checkedIn])

  const loading = sessionLoading || playersLoading
  // Read one-time handoff seed from LandingPage to prefilter group and include cross-group players in list
  useEffect(() => {
    const seed = coachLandingApi.readAndClearPendingSeed?.()
    if (seed) {
      setDefaultGroupId(seed.groupId ?? null)
      setExtraAllowedIds(new Set(seed.extraPlayerIds ?? []))
    } else {
      // Fallback to last known group if opening Check-in without a fresh seed
      const lastGroup = coachLandingApi.readLastGroupId?.() ?? null
      setDefaultGroupId(lastGroup)
    }
  }, [])

  // Fetch cross-group search results
  useEffect(() => {
    if (!searchOpen) return
    let cancelled = false
    const run = async () => {
      setSearching(true)
      try {
        const res = await coachLandingApi.searchPlayers({
          q: searchTerm,
          groupId: null,
          excludeGroupId: defaultGroupId ?? undefined,
          limit: 50
        })
        if (!cancelled) setSearchResults(res)
      } finally {
        if (!cancelled) setSearching(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [searchOpen, searchTerm, defaultGroupId])

  /**
   * Handles player check-in with animation feedback.
   * 
   * @param player - Player to check in
   * @param maxRounds - Optional max rounds (1 for "kun 1 runde")
   */
  const handleCheckIn = useCallback(
    async (player: Player, maxRounds?: number) => {
      if (!session) return

      // Add animation state for moving out of main list
      setAnimatingOut((prev) => new Set(prev).add(player.id))
      // Add visual feedback immediately
      setJustCheckedIn((prev) => new Set(prev).add(player.id))

      // Wait for exit animation to complete before API call
      await new Promise((resolve) => setTimeout(resolve, UI_CONSTANTS.CHECK_IN_ANIMATION_DURATION_MS))

      const success = await checkIn(player.id, maxRounds)

      if (success) {
        // Add animation state for moving into checked-in section
        setAnimatingIn((prev) => new Set(prev).add(player.id))
        setAnimatingOut((prev) => {
          const newSet = new Set(prev)
          newSet.delete(player.id)
          return newSet
        })

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
        }, UI_CONSTANTS.ANIMATION_CLEANUP_DELAY_MS)
      } else {
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
    [checkIn, session]
  )

  /**
   * Handles player check-out with animation feedback.
   * 
   * @param player - Checked-in player to check out
   */
  const handleCheckOut = useCallback(
    async (player: { id: string }) => {
      if (!session) return

      // Add animation state for moving out of checked-in section
      setAnimatingOut((prev) => new Set(prev).add(player.id))

      // Wait for exit animation to complete before API call
      await new Promise((resolve) => setTimeout(resolve, UI_CONSTANTS.CHECK_IN_ANIMATION_DURATION_MS))

      const success = await checkOut(player.id)

      if (success) {
        // Add animation state for moving back into main list
        setAnimatingIn((prev) => new Set(prev).add(player.id))
        setAnimatingOut((prev) => {
          const newSet = new Set(prev)
          newSet.delete(player.id)
          return newSet
        })

        // Remove animation state after animation
        setTimeout(() => {
          setAnimatingIn((prev) => {
            const newSet = new Set(prev)
            newSet.delete(player.id)
            return newSet
          })
        }, UI_CONSTANTS.ANIMATION_CLEANUP_DELAY_MS)
      } else {
        setAnimatingOut((prev) => {
          const newSet = new Set(prev)
          newSet.delete(player.id)
          return newSet
        })
      }
    },
    [checkOut, session]
  )

  /**
   * Handles "one round only" checkbox change.
   */
  const handleOneRoundOnlyChange = useCallback((playerId: string, checked: boolean) => {
    setOneRoundOnlyPlayers((prev) => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(playerId)
      } else {
        newSet.delete(playerId)
      }
      return newSet
    })
  }, [])

  /** Memoized Set of checked-in player IDs for fast lookup. */
  const checkedInIds = useMemo(() => new Set(checkedIn.map((player) => player.id)), [checkedIn])

  /** Gender breakdown of checked-in players. */
  const genderBreakdown = useMemo(() => {
    const male = checkedIn.filter((player) => player.gender === 'Herre').length
    const female = checkedIn.filter((player) => player.gender === 'Dame').length
    return { male, female }
  }, [checkedIn])

  /** Memoized filtered players list — excludes checked-in players, applies search/letter filters. */
  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return players.filter((player) => {
      // Exclude checked-in players from the main list
      if (checkedInIds.has(player.id)) return false
      // Default to selected group from landing, but include extra allowed cross-group players
      const groups = ((player as any).trainingGroups as string[] | undefined) ?? []
      const matchesGroup = defaultGroupId ? (groups.includes(defaultGroupId) || extraAllowedIds.has(player.id)) : true
      if (!matchesGroup) return false
      const matchesLetter =
        filterLetter === LETTER_FILTERS.ALL || (typeof filterLetter === 'string' && player.name.toLowerCase().startsWith(filterLetter.toLowerCase()))
      const nameLower = player.name.toLowerCase()
      const aliasLower = (player.alias ?? '').toLowerCase()
      const matchesSearch = !term || nameLower.includes(term) || aliasLower.includes(term)
      return matchesLetter && matchesSearch
    })
  }, [players, search, filterLetter, checkedInIds, defaultGroupId, extraAllowedIds])

  /** Sorted checked-in players by first name. */
  const sortedCheckedIn = useMemo(() => {
    return [...checkedIn].sort((a, b) => {
      const firstNameA = a.name.split(' ')[0] || ''
      const firstNameB = b.name.split(' ')[0] || ''
      return firstNameA.localeCompare(firstNameB, 'da')
    })
  }, [checkedIn])

  if (loading) {
    return (
      <section className="mx-auto flex h-full max-w-4xl items-center justify-center">
        <p className="text-lg text-[hsl(var(--muted))]">Loader...</p>
      </section>
    )
  }

  if (!session) {
    return (
      <section className="mx-auto flex h-full max-w-4xl items-center justify-center p-4 sm:p-6">
        <PageCard className="rounded-full px-6 py-3 text-center text-[hsl(var(--muted))]">
          Ingen aktiv træning. Gå til Træner-siden for at starte en træning.
        </PageCard>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4 sm:gap-6 pt-2 sm:pt-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3">
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))]">Indtjekning</h1>
          <p className="text-base text-[hsl(var(--muted))] mt-1">
            Aktiv træning: {formatDate(session.date, false)}
            {checkedIn.length > 0 && (
              <>
                {' '}
                <span className="font-bold text-[hsl(var(--foreground))]">•</span> Indtjekkede spillere:{' '}
                {checkedIn.length}{' '}
                <span className="font-bold text-[hsl(var(--foreground))]">•</span> {genderBreakdown.male} Herrer &{' '}
                {genderBreakdown.female} Damer
              </>
            )}
          </p>
        </div>
        {/* Variant selector removed — only option A is kept */}
      </header>

      <div className="grid gap-4 lg:grid-cols-[35%_65%] lg:items-start">
        {/* Checked-in players section */}
        <PageCard className="space-y-2 flex flex-col">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tjekket ind</h3>
            <span className="rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-xs font-medium">
              {checkedIn.length}
            </span>
          </header>
          <div className="flex flex-col space-y-2 pr-2">
            {checkedIn.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted))] text-center py-4">Ingen spillere tjekket ind</p>
            ) : (
              sortedCheckedIn.map((player) => (
                <CheckedInPlayerCard
                  key={player.id}
                  player={player}
                  isAnimatingOut={animatingOut.has(player.id)}
                  isAnimatingIn={animatingIn.has(player.id)}
                  onCheckOut={handleCheckOut}
                />
              ))
            )}
          </div>
        </PageCard>

        {/* Players overview */}
        <PageCard className="space-y-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <TableSearch value={search} onChange={setSearch} placeholder="Søg efter spiller" />
              </div>
              <Button
                variant="secondary"
                onClick={(ev) => {
                  setSearchOpener((ev.currentTarget ?? null) as HTMLElement | null)
                  setSearchOpen(true)
                }}
                title="Tillad spiller fra anden gruppe i denne træning"
              >
                Tilføj fra anden gruppe
              </Button>
            </div>
            <LetterFilters selectedLetter={filterLetter} onLetterSelect={setFilterLetter} />
          </div>

          <div className="flex flex-col">
            {filteredPlayers.length === 0 ? (
              <EmptyState
                icon={<UsersRound />}
                title="Ingen spillere matcher"
                helper="Prøv en anden søgning eller vælg et andet bogstav."
              />
            ) : (
              <AnimatedList
                items={filteredPlayers}
                onItemSelect={(player) => {
                  handleCheckIn(player, oneRoundOnlyPlayers.has(player.id) ? 1 : undefined)
                  handleOneRoundOnlyChange(player.id, false)
                }}
                showGradients={true}
                enableArrowNavigation={true}
                displayScrollbar={true}
                maxHeight="600px"
                renderItem={(player, index, isSelected) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    oneRoundOnly={oneRoundOnlyPlayers.has(player.id)}
                    isJustCheckedIn={justCheckedIn.has(player.id)}
                    isAnimatingOut={animatingOut.has(player.id)}
                    isAnimatingIn={animatingIn.has(player.id)}
                    onCheckIn={handleCheckIn}
                    onOneRoundOnlyChange={handleOneRoundOnlyChange}
                  />
                )}
              />
            )}
          </div>
        </PageCard>
      </div>
      <CrossGroupSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        term={searchTerm}
        setTerm={setSearchTerm}
        results={searchResults}
        onPick={(id) => {
          // Defer action choice to a custom confirm modal (no automatic allow)
          setConfirmPlayerId(id)
        }}
        pickedIds={pickedIdsSet}
        returnFocusTo={searchOpener}
      />
      {/* Confirm modal with three choices */}
      {confirmPlayerId && (() => {
        const picked = players.find((p) => p.id === confirmPlayerId) || null
        if (!picked) return null
        const canAddToGroup = Boolean(defaultGroupId)
        const onClose = () => setConfirmPlayerId(null)
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose()
            }}
          >
            <div
              className="w-full max-w-md mx-4 bg-[hsl(var(--surface)/.98)] backdrop-blur-md ring-1 ring-[hsl(var(--line)/.12)] rounded-lg shadow-[var(--shadow-md)] p-4 sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Tillad {picked.name}</h3>
              <p className="text-sm text-[hsl(var(--muted))] mt-1">
                Vælg hvad du vil gøre med denne spiller.
              </p>
              <div className="mt-4 grid gap-2">
                <Button
                  onClick={() => {
                    void (async () => {
                      // Ensure allowed for this session (even though we check in immediately)
                      setExtraAllowedIds((prev) => {
                        const next = new Set(prev)
                        next.add(picked.id)
                        return next
                      })
                      await handleCheckIn(picked)
                      setSearchOpen(false)
                      onClose()
                    })()
                  }}
                >
                  Tjek ind nu
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    // Temporarily allow for this active session only
                    setExtraAllowedIds((prev) => {
                      const next = new Set(prev)
                      next.add(picked.id)
                      return next
                    })
                    setSearchOpen(false)
                    onClose()
                  }}
                >
                  Tillad for denne træning
                </Button>
                <Button
                  variant="secondary"
                  disabled={!canAddToGroup}
                  onClick={() => {
                    if (!defaultGroupId) return
                    void (async () => {
                      // Permanently add to the active training group
                      const existing = ((picked as any).trainingGroups as string[] | undefined) ?? []
                      const next = Array.from(new Set([...existing, defaultGroupId]))
                      await api.players.update({ id: picked.id, patch: { trainingGroups: next } } as any)
                      await refetchPlayers()
                      // Close both modals; player will now be part of the group list
                      setSearchOpen(false)
                      onClose()
                    })()
                  }}
                  title={!canAddToGroup ? 'Ingen aktiv gruppe valgt' : undefined}
                >
                  Tilføj permanent til denne træningsgruppe
                </Button>
                <Button
                  variant="ghost"
                  onClick={onClose}
                >
                  Annuller
                </Button>
              </div>
            </div>
          </div>
        )
      })()}
    </section>
  )
}

export default CheckInPage
