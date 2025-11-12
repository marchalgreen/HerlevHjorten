/**
 * Players page — manages player CRUD operations and listing.
 * 
 * @remarks Renders player table with search/sort, handles create/edit forms,
 * and delegates data operations to usePlayers hook. Uses sub-components for
 * partner editing and form management.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Player, PlayerCategory, PlayerGender } from '@herlev-hjorten/common'
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import { Badge, Button, EmptyState, PageCard } from '../components/ui'
import { DataTable, TableSearch, type Column } from '../components/ui/Table'
import { EditablePartnerCell, PlayerForm } from '../components/players'
import { EditableTrainingGroupsCell } from '../components/players/EditableTrainingGroupsCell'
import { usePlayers } from '../hooks'
import { formatDate, formatPlayerName } from '../lib/formatting'
import { PLAYER_CATEGORIES, UI_CONSTANTS } from '../constants'

/**
 * Players page component.
 * 
 * @example
 * ```tsx
 * <PlayersPage />
 * ```
 */
const PlayersPage = () => {
  // Data hooks
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const { players, loading, error, createPlayer, updatePlayer, refetch } = usePlayers({
    q: search.trim() || undefined,
    active: showInactive ? undefined : true
  })

  // Get all players for dropdown (no filters)
  const { players: allPlayersForDropdown } = usePlayers({})

  // UI state
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [sort, setSort] = useState<{ columnId: string; direction: 'asc' | 'desc' } | undefined>({
    columnId: 'name',
    direction: 'asc'
  })
  const scrollPositionRef = useRef<number>(0)
  const shouldRestoreScrollRef = useRef(false)
  const [scrollRestoreKey, setScrollRestoreKey] = useState(0)

  /**
   * Saves current scroll position and marks it for restoration.
   * Stores it in both a ref (for parent restoration) and data attribute (for DataTable).
   */
  const saveScrollPosition = useCallback(() => {
    const tableContainer = document.querySelector('[data-table-container]') as HTMLElement
    if (tableContainer) {
      const currentScroll = tableContainer.scrollTop
      if (currentScroll > 0) {
        scrollPositionRef.current = currentScroll
        shouldRestoreScrollRef.current = true
        // Store scroll position in data attribute for DataTable to read
        // Use a timestamp to ensure it's fresh
        tableContainer.setAttribute('data-saved-scroll', currentScroll.toString())
        tableContainer.setAttribute('data-saved-scroll-time', Date.now().toString())
        setScrollRestoreKey((prev) => prev + 1)
      }
    }
  }, [])

  // Form state
  const [formName, setFormName] = useState('')
  const [formAlias, setFormAlias] = useState('')
  const [formLevelSingle, setFormLevelSingle] = useState<string>('')
  const [formLevelDouble, setFormLevelDouble] = useState<string>('')
  const [formLevelMix, setFormLevelMix] = useState<string>('')
  const [formGender, setFormGender] = useState<PlayerGender | ''>('')
  const [formPrimaryCategory, setFormPrimaryCategory] = useState<PlayerCategory | ''>('')
  const [formActive, setFormActive] = useState(true)
  const [formPreferredDoublesPartners, setFormPreferredDoublesPartners] = useState<string[]>([])
  const [formPreferredMixedPartners, setFormPreferredMixedPartners] = useState<string[]>([])
  const [formTrainingGroups, setFormTrainingGroups] = useState<string[]>([])

  /**
   * Resets form state to initial values.
   */
  const resetForm = useCallback(() => {
    setFormName('')
    setFormAlias('')
    setFormLevelSingle('')
    setFormLevelDouble('')
    setFormLevelMix('')
    setFormGender('')
    setFormPrimaryCategory('')
    setFormActive(true)
    setFormPreferredDoublesPartners([])
    setFormPreferredMixedPartners([])
    setFormTrainingGroups([])
    setCurrentPlayer(null)
  }, [])

  /**
   * Opens create player form dialog.
   */
  const openCreate = useCallback(() => {
    setDialogMode('create')
    resetForm()
    setIsSheetOpen(true)
  }, [resetForm])

  /**
   * Opens edit player form dialog with player data pre-filled.
   */
  const openEdit = useCallback(
    (player: Player) => {
    setDialogMode('edit')
    setCurrentPlayer(player)
      const playerAny = player as any
    setFormName(player.name)
    setFormAlias(player.alias ?? '')
      setFormLevelSingle((playerAny.levelSingle ?? null)?.toString() ?? '')
      setFormLevelDouble((playerAny.levelDouble ?? null)?.toString() ?? '')
      setFormLevelMix((playerAny.levelMix ?? null)?.toString() ?? '')
    setFormGender(player.gender ?? '')
    setFormPrimaryCategory(player.primaryCategory ?? '')
    setFormActive(player.active)
      setFormPreferredDoublesPartners((playerAny.preferredDoublesPartners ?? null) ?? [])
      setFormPreferredMixedPartners((playerAny.preferredMixedPartners ?? null) ?? [])
      setFormTrainingGroups((playerAny.trainingGroups ?? null) ?? [])
    setIsSheetOpen(true)
    },
    []
  )

  /**
   * Handles form submission for create/edit player.
   */
  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formName.trim()) return

      // Save scroll position before update (for edit mode)
      if (dialogMode === 'edit') {
        saveScrollPosition()
      }

    try {
      if (dialogMode === 'create') {
          const createInput: any = {
          name: formName.trim(),
          alias: formAlias.trim() || undefined,
            levelSingle: formLevelSingle ? Number(formLevelSingle) : undefined,
            levelDouble: formLevelDouble ? Number(formLevelDouble) : undefined,
            levelMix: formLevelMix ? Number(formLevelMix) : undefined,
          gender: formGender || undefined,
          primaryCategory: formPrimaryCategory || undefined,
            trainingGroups: formTrainingGroups,
            active: formActive,
            preferredDoublesPartners: formPreferredDoublesPartners.length > 0 ? formPreferredDoublesPartners : undefined,
            preferredMixedPartners: formPreferredMixedPartners.length > 0 ? formPreferredMixedPartners : undefined
          }
          await createPlayer(createInput)
      } else if (currentPlayer) {
          const patch: any = {
            name: formName.trim(),
            alias: formAlias || null,
            levelSingle: formLevelSingle ? Number(formLevelSingle) : null,
            levelDouble: formLevelDouble ? Number(formLevelDouble) : null,
            levelMix: formLevelMix ? Number(formLevelMix) : null,
            gender: formGender || null,
            primaryCategory: formPrimaryCategory || null,
            trainingGroups: formTrainingGroups,
            active: formActive,
            preferredDoublesPartners: formPreferredDoublesPartners.length > 0 ? formPreferredDoublesPartners : null,
            preferredMixedPartners: formPreferredMixedPartners.length > 0 ? formPreferredMixedPartners : null
      }
          await updatePlayer({
            id: currentPlayer.id,
            patch
          })
        }
      setIsSheetOpen(false)
      } catch (err) {
        // Error is handled by the hook
      }
    },
    [
      formName,
      formAlias,
      formLevelSingle,
      formLevelDouble,
      formLevelMix,
      formGender,
      formPrimaryCategory,
      formActive,
      formPreferredDoublesPartners,
      formPreferredMixedPartners,
      formTrainingGroups,
      dialogMode,
      currentPlayer,
      createPlayer,
      updatePlayer,
      saveScrollPosition
    ]
  )

  /**
   * Toggles player active status.
   */
  const toggleActive = useCallback(
    async (player: Player) => {
      // Save scroll position before update
      saveScrollPosition()
      
      await updatePlayer({
        id: player.id,
        patch: { active: !player.active }
      })
    },
    [updatePlayer, saveScrollPosition]
  )

  /**
   * Updates player primary category.
   */
  const updatePrimaryCategory = useCallback(
    async (player: Player, category: PlayerCategory | null) => {
      // Save scroll position before update
      saveScrollPosition()

      await updatePlayer({
        id: player.id,
        patch: { primaryCategory: category }
      })
    },
    [updatePlayer, saveScrollPosition]
  )

  /**
   * Restores scroll position after data changes.
   * This effect runs when loading changes from true to false (update complete)
   * and when players array changes. We use useLayoutEffect to restore before paint.
   */
  useLayoutEffect(() => {
    // Only restore when loading is false (data has finished loading) and we have a saved position
    if (!loading && shouldRestoreScrollRef.current && scrollPositionRef.current > 0) {
      // Use multiple RAFs to ensure we restore after DataTable's effects have run
      // This ensures the table has fully rendered before we restore scroll
      const restoreScroll = () => {
      const tableContainer = document.querySelector('[data-table-container]') as HTMLElement
      if (tableContainer) {
          const savedScroll = scrollPositionRef.current
          if (savedScroll > 0) {
            tableContainer.scrollTop = savedScroll
            shouldRestoreScrollRef.current = false
          }
        }
      }
      
      // Use multiple RAFs to ensure restoration happens after DataTable's layout effects
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(restoreScroll)
        })
      })
    }
  }, [loading, players, scrollRestoreKey])

  /**
   * Memoized filtered players list — applies search term to name/alias.
   */
  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return players
    return players.filter((player) => {
      const alias = (player.alias ?? '').toLowerCase()
      return player.name.toLowerCase().includes(term) || alias.includes(term)
    })
  }, [players, search])

  /**
   * Memoized table column definitions with sort/filter logic.
   */
  const columns: Column<Player>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Navn',
        sortable: true,
        sortValue: (row: Player) => row.name.toLowerCase(),
        cell: (row: Player) => (
          <div className="flex flex-col">
            <span className="font-semibold text-[hsl(var(--foreground))]">{row.name}</span>
            <span className="text-xs text-[hsl(var(--muted))]">
              {row.alias ?? 'Ingen kaldenavn'}
            </span>
          </div>
        )
      },
      {
        id: 'levelSingle',
        header: 'Rangliste Single',
        align: 'center',
        sortable: true,
        sortValue: (row) => ((row as any).levelSingle ?? null) ?? 0,
        accessor: (row: Player) => ((row as any).levelSingle ?? null) ?? '–'
      },
      {
        id: 'levelDouble',
        header: 'Rangliste Double',
        align: 'center',
        sortable: true,
        sortValue: (row) => ((row as any).levelDouble ?? null) ?? 0,
        accessor: (row: Player) => ((row as any).levelDouble ?? null) ?? '–'
      },
      {
        id: 'levelMix',
        header: 'Rangliste Mix',
        align: 'center',
        sortable: true,
        sortValue: (row) => ((row as any).levelMix ?? null) ?? 0,
        accessor: (row: Player) => ((row as any).levelMix ?? null) ?? '–'
      },
      {
        id: 'gender',
        header: 'Køn',
        align: 'center',
        sortable: true,
        sortValue: (row: Player) => row.gender ?? '',
        accessor: (row: Player) => row.gender ?? '–'
      },
      {
        id: 'primaryCategory',
        header: 'Primær kategori',
        align: 'center',
        sortable: true,
        sortValue: (row: Player) => row.primaryCategory ?? '',
        cell: (row: Player) => (
          <div className="flex items-center justify-center gap-1">
            {([PLAYER_CATEGORIES.SINGLE, PLAYER_CATEGORIES.DOUBLE, PLAYER_CATEGORIES.BOTH] as PlayerCategory[]).map(
              (category) => {
              const isSelected = row.primaryCategory === category
              return (
                <button
                  key={category}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    updatePrimaryCategory(row, isSelected ? null : category)
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${
                    isSelected
                      ? 'bg-[hsl(var(--primary))] text-white ring-1 ring-[hsl(var(--primary)/.3)]'
                      : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] hover:bg-[hsl(var(--surface-glass)/.85)] hover:text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--line)/.12)]'
                  }`}
                  title={isSelected ? 'Klik for at fjerne' : `Klik for at sætte til ${category}`}
                >
                    {category === PLAYER_CATEGORIES.SINGLE
                      ? 'S'
                      : category === PLAYER_CATEGORIES.DOUBLE
                        ? 'D'
                        : 'B'}
                </button>
              )
              }
            )}
          </div>
        )
      },
      {
        id: 'trainingGroups',
        header: 'Træningsgrupper',
        align: 'center',
        sortable: true,
        sortValue: (row: Player) => {
          const groups = (row as any).trainingGroups as string[] | undefined
          return (groups ?? []).join(' | ')
        },
        cell: (row: Player) => (
          <EditableTrainingGroupsCell
            player={row}
            onUpdate={refetch}
            onBeforeUpdate={saveScrollPosition}
          />
        )
      },
      {
        id: 'preferredDoublesPartner',
        header: 'Double makker',
        align: 'center',
        width: '200px',
        cell: (row: Player) => (
          <div className="w-full max-w-[200px] mx-auto">
            <EditablePartnerCell
              player={row}
              partnerType="doubles"
              allPlayers={allPlayersForDropdown}
              onUpdate={refetch}
              onBeforeUpdate={saveScrollPosition}
            />
          </div>
        )
      },
      {
        id: 'preferredMixedPartner',
        header: 'Mix makker',
        align: 'center',
        width: '200px',
        cell: (row: Player) => (
          <div className="w-full max-w-[200px] mx-auto">
            <EditablePartnerCell
              player={row}
              partnerType="mixed"
              allPlayers={allPlayersForDropdown}
              onUpdate={refetch}
              onBeforeUpdate={saveScrollPosition}
            />
          </div>
        )
      },
      {
        id: 'createdAt',
        header: 'Oprettet',
        sortable: true,
        sortValue: (row) => new Date(row.createdAt).getTime(),
        accessor: (row: Player) => formatDate(row.createdAt, true)
      },
      {
        id: 'status',
        header: 'Status',
        align: 'center',
        cell: (row: Player) => (
          <Badge variant={row.active ? 'success' : 'muted'}>{row.active ? 'Aktiv' : 'Inaktiv'}</Badge>
        )
      },
      {
        id: 'actions',
        header: 'Handling',
        align: 'right',
        cell: (row: Player) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(row)}
              aria-label={`Rediger ${row.name}`}
            >
              <Pencil size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleActive(row)}
              aria-label={`Skift status for ${row.name}`}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        )
      }
    ],
    [allPlayersForDropdown, refetch, toggleActive, updatePrimaryCategory, openEdit]
  )

  return (
    <section className="flex flex-col gap-4 sm:gap-6 pt-4 sm:pt-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-[hsl(var(--foreground))]">Spillere</h1>
          <p className="text-base text-[hsl(var(--muted))] mt-1">Administrer medlemslisten og deres status.</p>
          {error && (
            <span className="mt-2 inline-block text-sm text-[hsl(var(--destructive))]">{error}</span>
          )}
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted))] cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              className="h-4 w-4 rounded bg-[hsl(var(--surface))] ring-1 ring-[hsl(var(--line)/.12)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none"
            />
            Vis inaktive
          </label>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-sm font-medium whitespace-nowrap bg-[hsl(var(--surface-glass)/.85)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.95)] ring-1 ring-[hsl(var(--line)/.12)] transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            <span>Ny spiller</span>
          </button>
        </div>
      </header>

      <PageCard className="space-y-3 sm:space-y-4">
        <TableSearch
          value={search}
          onChange={(value) => setSearch(value)}
          placeholder="Søg efter navn eller kaldenavn"
        />
        {loading ? (
          <div className="py-16 text-center text-[hsl(var(--muted))]">Henter spillere...</div>
        ) : (
          <DataTable
            data={filteredPlayers}
            columns={columns}
            initialSort={{ columnId: 'name', direction: 'asc' }}
            sort={sort}
            onSortChange={setSort}
            emptyState={
              <EmptyState
                icon={<UsersRound />}
                title="Ingen spillere"
                helper="Tilføj klubbens spillere for at komme i gang."
                action={<Button onClick={openCreate}>Ny spiller</Button>}
              />
            }
          />
        )}
      </PageCard>

      <PlayerForm
        isOpen={isSheetOpen}
        mode={dialogMode}
        currentPlayer={currentPlayer}
        allPlayers={allPlayersForDropdown}
        formState={{
          name: formName,
          alias: formAlias,
          levelSingle: formLevelSingle,
          levelDouble: formLevelDouble,
          levelMix: formLevelMix,
          gender: formGender,
          primaryCategory: formPrimaryCategory,
          active: formActive,
          preferredDoublesPartners: formPreferredDoublesPartners,
          preferredMixedPartners: formPreferredMixedPartners,
          trainingGroups: formTrainingGroups
        }}
        formSetters={{
          setName: setFormName,
          setAlias: setFormAlias,
          setLevelSingle: setFormLevelSingle,
          setLevelDouble: setFormLevelDouble,
          setLevelMix: setFormLevelMix,
          setGender: setFormGender,
          setPrimaryCategory: setFormPrimaryCategory,
          setActive: setFormActive,
          setPreferredDoublesPartners: setFormPreferredDoublesPartners,
          setPreferredMixedPartners: setFormPreferredMixedPartners,
          setTrainingGroups: setFormTrainingGroups
        }}
        onSubmit={handleSubmit}
        onClose={() => setIsSheetOpen(false)}
      />
    </section>
  )
}

export default PlayersPage
