import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Player, PlayerGender, PlayerCategory } from '@herlev-hjorten/common'
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import api from '../api'
import { Badge, Button, EmptyState, PageCard } from '../components/ui'
import { DataTable, TableSearch, Column } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('da-DK', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(iso))

/**
 * Players page — manages player CRUD operations and listing.
 * @remarks Renders player table with search/sort, handles create/edit forms,
 * and delegates data operations to api.players.
 */
const PlayersPage = () => {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [formName, setFormName] = useState('')
  const [formAlias, setFormAlias] = useState('')
  const [formLevel, setFormLevel] = useState<string>('')
  const [formGender, setFormGender] = useState<PlayerGender | ''>('')
  const [formPrimaryCategory, setFormPrimaryCategory] = useState<PlayerCategory | ''>('')
  const [formActive, setFormActive] = useState(true)
  const [sort, setSort] = useState<{ columnId: string; direction: 'asc' | 'desc' } | undefined>({ columnId: 'name', direction: 'asc' })
  const scrollPositionRef = useRef<number>(0)
  const shouldRestoreScrollRef = useRef(false)
  const [hasBackup, setHasBackup] = useState(false)
  const { notify } = useToast()

  /** Loads players from API with optional filters. */
  const loadPlayers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.players.list({
        q: search.trim() || undefined,
        active: showInactive ? undefined : true
      })
      setPlayers(result)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke hente spillere')
    } finally {
      setLoading(false)
      // Restore scroll position after loading completes
      if (shouldRestoreScrollRef.current) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const tableContainer = document.querySelector('[data-table-container]') as HTMLElement
            if (tableContainer && scrollPositionRef.current > 0) {
              tableContainer.scrollTop = scrollPositionRef.current
            }
            shouldRestoreScrollRef.current = false
          })
        })
      }
    }
  }, [search, showInactive])

  // WHY: Reload players when showInactive filter changes; search is debounced via loadPlayers
  useEffect(() => {
    void loadPlayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive])

  // WHY: Create backup on mount if one doesn't exist to preserve current state
  useEffect(() => {
    const backupExists = api.database.hasBackup()
    setHasBackup(backupExists)
    if (!backupExists) {
      api.database.createBackup()
      setHasBackup(true)
      console.log('Backup created automatically on first load')
    }
  }, [])

  /** Memoized filtered players list — applies search term to name/alias. */
  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return players
    return players.filter((player) => {
      const alias = (player.alias ?? '').toLowerCase()
      return player.name.toLowerCase().includes(term) || alias.includes(term)
    })
  }, [players, search])

  /** Resets form state to initial values. */
  const resetForm = () => {
    setFormName('')
    setFormAlias('')
    setFormLevel('')
    setFormGender('')
    setFormPrimaryCategory('')
    setFormActive(true)
    setCurrentPlayer(null)
  }

  /** Opens create player form dialog. */
  const openCreate = () => {
    setDialogMode('create')
    resetForm()
    setIsSheetOpen(true)
  }

  /** Opens edit player form dialog with player data pre-filled. */
  const openEdit = (player: Player) => {
    setDialogMode('edit')
    setCurrentPlayer(player)
    setFormName(player.name)
    setFormAlias(player.alias ?? '')
    setFormLevel(player.level?.toString() ?? '')
    setFormGender(player.gender ?? '')
    setFormPrimaryCategory(player.primaryCategory ?? '')
    setFormActive(player.active)
    setIsSheetOpen(true)
  }

  /** Handles form submission for create/edit player. */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formName.trim()) return
    try {
      if (dialogMode === 'create') {
        await api.players.create({
          name: formName.trim(),
          alias: formAlias.trim() || undefined,
          level: formLevel ? Number(formLevel) : undefined,
          gender: formGender || undefined,
          primaryCategory: formPrimaryCategory || undefined,
          active: formActive
        })
        notify({ variant: 'success', title: 'Spiller oprettet' })
      } else if (currentPlayer) {
        await api.players.update({
          id: currentPlayer.id,
          patch: {
            name: formName.trim(),
            alias: formAlias || null,
            level: formLevel ? Number(formLevel) : null,
            gender: formGender || null,
            primaryCategory: formPrimaryCategory || null,
            active: formActive
          }
        })
        notify({ variant: 'success', title: 'Spiller opdateret' })
      }
      await loadPlayers()
      setIsSheetOpen(false)
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke gemme spiller')
    }
  }

  /** Toggles player active status. */
  const toggleActive = useCallback(async (player: Player) => {
    try {
      // Save scroll position before update
      const tableContainer = document.querySelector('[data-table-container]') as HTMLElement
      if (tableContainer) {
        scrollPositionRef.current = tableContainer.scrollTop
        shouldRestoreScrollRef.current = true
      }
      
      await api.players.update({ id: player.id, patch: { active: !player.active } })
      await loadPlayers()
      
      notify({ variant: 'success', title: player.active ? 'Spiller deaktiveret' : 'Spiller aktiveret' })
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke opdatere spiller')
      shouldRestoreScrollRef.current = false
    }
  }, [loadPlayers, notify])

  /** Updates player primary category. */
  const updatePrimaryCategory = useCallback(async (player: Player, category: PlayerCategory | null) => {
    try {
      // Save scroll position before update
      const tableContainer = document.querySelector('[data-table-container]') as HTMLElement
      if (tableContainer) {
        scrollPositionRef.current = tableContainer.scrollTop
        shouldRestoreScrollRef.current = true
      }
      
      await api.players.update({ id: player.id, patch: { primaryCategory: category } })
      await loadPlayers()
      
      notify({ variant: 'success', title: 'Kategori opdateret' })
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke opdatere kategori')
      shouldRestoreScrollRef.current = false
    }
  }, [loadPlayers, notify])

  /** Memoized table column definitions with sort/filter logic. */
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
            <span className="text-xs text-[hsl(var(--muted))]">{row.alias ?? 'Ingen kaldenavn'}</span>
          </div>
        )
      },
      {
        id: 'level',
        header: 'Rangliste',
        align: 'center',
        sortable: true,
        sortValue: (row) => row.level ?? 0,
        accessor: (row: Player) => row.level ?? '–'
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
            {(['Single', 'Double', 'Begge'] as PlayerCategory[]).map((category) => {
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
                  {category === 'Single' ? 'S' : category === 'Double' ? 'D' : 'B'}
                </button>
              )
            })}
          </div>
        )
      },
      {
        id: 'createdAt',
        header: 'Oprettet',
        sortable: true,
        sortValue: (row) => new Date(row.createdAt).getTime(),
        accessor: (row: Player) => formatDate(row.createdAt)
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
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)} aria-label={`Rediger ${row.name}`}>
              <Pencil size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toggleActive(row)} aria-label={`Skift status for ${row.name}`}>
              <Trash2 size={16} />
            </Button>
          </div>
        )
      }
    ],
    [toggleActive, updatePrimaryCategory]
  )

  return (
    <section className="flex flex-col gap-6 pt-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Spillere</h1>
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
            onClick={() => {
              api.database.createBackup()
              setHasBackup(true)
              notify({ variant: 'success', title: 'Backup oprettet', description: 'Nuværende database er gemt som backup' })
            }}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-sm font-medium whitespace-nowrap bg-[hsl(var(--surface-glass)/.85)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.95)] ring-1 ring-[hsl(var(--line)/.12)] transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            title="Gem nuværende database som backup"
          >
            <span>Gem backup</span>
          </button>
          {hasBackup && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Er du sikker på at du vil gendanne fra backup? Dette vil overskrive alle nuværende ændringer.')) {
                  const restored = api.database.restoreFromBackup()
                  if (restored) {
                    notify({ variant: 'success', title: 'Backup gendannet', description: 'Database er gendannet fra backup' })
                    loadPlayers()
                  } else {
                    notify({ variant: 'danger', title: 'Kunne ikke gendanne backup' })
                  }
                }
              }}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-sm font-medium whitespace-nowrap bg-[hsl(var(--surface-glass)/.85)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.95)] ring-1 ring-[hsl(var(--line)/.12)] transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              title="Gendan database fra backup"
            >
              <span>Gendan fra backup</span>
            </button>
          )}
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

      <PageCard className="space-y-4">
        <TableSearch value={search} onChange={(value) => setSearch(value)} placeholder="Søg efter navn eller kaldenavn" />
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

      {isSheetOpen && (
        /* A11y: Dialog pattern — modal form with backdrop and role="dialog" */
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none" role="dialog" aria-modal="true">
          <div className="h-full w-full max-w-md ring-1 ring-[hsl(var(--line)/.12)] bg-[hsl(var(--surface)/.98)] backdrop-blur-md p-6 shadow-[0_2px_8px_hsl(var(--line)/.12)]">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">
                  {dialogMode === 'create' ? 'Ny spiller' : 'Rediger spiller'}
                </h3>
                <p className="text-sm text-[hsl(var(--muted))] mt-1">Udfyld oplysningerne og gem.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsSheetOpen(false)}>
                Luk
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[hsl(var(--foreground))]">Navn *</span>
                <input
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
                  className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[hsl(var(--foreground))]">Kaldenavn</span>
                <input
                  value={formAlias}
                  onChange={(event) => setFormAlias(event.target.value)}
                  className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[hsl(var(--foreground))]">Rangliste</span>
                <input
                  type="number"
                  value={formLevel}
                  onChange={(event) => setFormLevel(event.target.value)}
                  className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[hsl(var(--foreground))]">Køn</span>
                <select
                  value={formGender}
                  onChange={(event) => setFormGender(event.target.value as PlayerGender | '')}
                  className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
                >
                  <option value="">Vælg køn</option>
                  <option value="Herre">Herre</option>
                  <option value="Dame">Dame</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[hsl(var(--foreground))]">Primær kategori</span>
                <select
                  value={formPrimaryCategory}
                  onChange={(event) => setFormPrimaryCategory(event.target.value as PlayerCategory | '')}
                  className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
                >
                  <option value="">Vælg kategori</option>
                  <option value="Single">Single</option>
                  <option value="Double">Double</option>
                  <option value="Begge">Begge</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted))] cursor-pointer">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(event) => setFormActive(event.target.checked)}
                  className="h-4 w-4 rounded bg-[hsl(var(--surface))] ring-1 ring-[hsl(var(--line)/.12)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none"
                />
                Aktiv spiller
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" type="button" onClick={() => setIsSheetOpen(false)}>
                  Annuller
                </Button>
                <Button type="submit" className="ring-2 ring-[hsl(var(--accent)/.2)]">Gem spiller</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default PlayersPage
