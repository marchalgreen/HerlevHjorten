/**
 * Player form component for creating and editing players.
 * 
 * Provides a modal form for creating new players or editing existing ones
 * with all player fields including preferred partners.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import type { Player, PlayerCategory, PlayerGender } from '@herlev-hjorten/common'
import { Button } from '../ui'
import { formatPlayerName } from '../../lib/formatting'
import { PLAYER_CATEGORIES, PLAYER_GENDERS } from '../../constants'
import { fetchTrainingGroups } from '../../services/coachLandingApi'

/**
 * Props for PlayerForm component.
 */
interface PlayerFormProps {
  /** Whether the form is open. */
  isOpen: boolean
  
  /** Form mode (create or edit). */
  mode: 'create' | 'edit'
  
  /** Current player being edited (null for create mode). */
  currentPlayer: Player | null
  
  /** All players for partner selection. */
  allPlayers: Player[]
  
  /** Form state values. */
  formState: {
    name: string
    alias: string
    levelSingle: string
    levelDouble: string
    levelMix: string
    gender: PlayerGender | ''
    primaryCategory: PlayerCategory | ''
    active: boolean
    preferredDoublesPartners: string[]
    preferredMixedPartners: string[]
    trainingGroups: string[]
  }
  
  /** Form state setters. */
  formSetters: {
    setName: (value: string) => void
    setAlias: (value: string) => void
    setLevelSingle: (value: string) => void
    setLevelDouble: (value: string) => void
    setLevelMix: (value: string) => void
    setGender: (value: PlayerGender | '') => void
    setPrimaryCategory: (value: PlayerCategory | '') => void
    setActive: (value: boolean) => void
    setPreferredDoublesPartners: (value: string[]) => void
    setPreferredMixedPartners: (value: string[]) => void
    setTrainingGroups: (value: string[]) => void
  }
  
  /** Callback when form is submitted. */
  onSubmit: (event: React.FormEvent) => void
  
  /** Callback when form is closed. */
  onClose: () => void
}

/**
 * Player form component.
 * 
 * @example
 * ```tsx
 * <PlayerForm
 *   isOpen={isOpen}
 *   mode="create"
 *   currentPlayer={null}
 *   allPlayers={players}
 *   formState={formState}
 *   formSetters={formSetters}
 *   onSubmit={handleSubmit}
 *   onClose={handleClose}
 * />
 * ```
 */
export const PlayerForm: React.FC<PlayerFormProps> = ({
  isOpen,
  mode,
  currentPlayer,
  allPlayers,
  formState,
  formSetters,
  onSubmit,
  onClose
}) => {
  const [availableGroups, setAvailableGroups] = useState<string[]>([])
  const [newGroupInput, setNewGroupInput] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const groups = await fetchTrainingGroups()
        if (!mounted) return
        setAvailableGroups(groups.map((g) => g.name))
      } catch {
        setAvailableGroups([])
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  const toggleGroup = useCallback((name: string) => {
    formSetters.setTrainingGroups(
      formState.trainingGroups.includes(name)
        ? formState.trainingGroups.filter((n) => n !== name)
        : [...formState.trainingGroups, name]
    )
  }, [formSetters, formState.trainingGroups])

  const addNewGroup = useCallback(() => {
    const name = newGroupInput.trim()
    if (!name) return
    if (!availableGroups.includes(name)) {
      setAvailableGroups((prev) => [...prev, name])
    }
    if (!formState.trainingGroups.includes(name)) {
      formSetters.setTrainingGroups([...formState.trainingGroups, name])
    }
    setNewGroupInput('')
  }, [newGroupInput, availableGroups, formSetters, formState.trainingGroups])

  /**
   * Filters players for doubles partner selection.
   */
  const availableDoublesPartners = useMemo(() => {
    return allPlayers.filter((p) => {
      // Exclude self
      if (p.id === currentPlayer?.id) return false
      // Same gender for doubles partner
      if (formState.gender === PLAYER_GENDERS.MALE) return p.gender === PLAYER_GENDERS.MALE
      if (formState.gender === PLAYER_GENDERS.FEMALE) return p.gender === PLAYER_GENDERS.FEMALE
      return true
    })
  }, [allPlayers, currentPlayer?.id, formState.gender])

  /**
   * Filters players for mixed partner selection.
   */
  const availableMixedPartners = useMemo(() => {
    return allPlayers.filter((p) => {
      // Exclude self
      if (p.id === currentPlayer?.id) return false
      // Opposite gender for mixed partner
      if (formState.gender === PLAYER_GENDERS.MALE) return p.gender === PLAYER_GENDERS.FEMALE
      if (formState.gender === PLAYER_GENDERS.FEMALE) return p.gender === PLAYER_GENDERS.MALE
      return true
    })
  }, [allPlayers, currentPlayer?.id, formState.gender])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="h-full w-full max-w-md mx-4 sm:mx-0 ring-1 ring-[hsl(var(--line)/.12)] bg-[hsl(var(--surface)/.98)] backdrop-blur-md shadow-[0_2px_8px_hsl(var(--line)/.12)] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-[hsl(var(--line)/.12)] flex-shrink-0">
          <div>
            <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">
              {mode === 'create' ? 'Ny spiller' : 'Rediger spiller'}
            </h3>
            <p className="text-sm text-[hsl(var(--muted))] mt-1">Udfyld oplysningerne og gem.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Luk
          </Button>
        </div>
        {/* Scrollable content */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 min-h-0">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[hsl(var(--foreground))]">Navn *</span>
            <input
              value={formState.name}
              onChange={(event) => formSetters.setName(event.target.value)}
              className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
              required
            />
          </label>
          <div className="space-y-2 pt-1">
            <h4 className="text-sm font-medium text-[hsl(var(--foreground))]">Træningsgrupper</h4>
            <div className="flex flex-wrap gap-2">
              {availableGroups.length === 0 ? (
                <span className="text-xs text-[hsl(var(--muted))]">Ingen eksisterende grupper</span>
              ) : (
                availableGroups
                  .slice()
                  .sort((a, b) => a.localeCompare(b, 'da'))
                  .map((name) => {
                    const selected = formState.trainingGroups.includes(name)
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleGroup(name)}
                        className={`text-xs px-2 py-1 rounded-full ring-1 transition-colors ${
                          selected
                            ? 'bg-[hsl(var(--primary))] text-white ring-[hsl(var(--primary)/.3)]'
                            : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] ring-[hsl(var(--line)/.12)]'
                        }`}
                        title={selected ? 'Klik for at fjerne' : 'Klik for at tilføje'}
                      >
                        {name}
                      </button>
                    )
                  })
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newGroupInput}
                onChange={(e) => setNewGroupInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addNewGroup()
                  }
                }}
                placeholder="Ny gruppe..."
                className="flex-1 rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 text-[hsl(var(--foreground))]"
              />
              <Button type="button" onClick={addNewGroup}>
                Tilføj
              </Button>
            </div>
            {formState.trainingGroups.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {formState.trainingGroups.map((g) => (
                  <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--surface-2))] ring-1 ring-[hsl(var(--line)/.12)]">
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[hsl(var(--foreground))]">Kaldenavn</span>
            <input
              value={formState.alias}
              onChange={(event) => formSetters.setAlias(event.target.value)}
              className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
            />
          </label>
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[hsl(var(--foreground))]">Rangliste</h4>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[hsl(var(--foreground))]">Rangliste Single</span>
              <input
                type="number"
                value={formState.levelSingle}
                onChange={(event) => formSetters.setLevelSingle(event.target.value)}
                className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[hsl(var(--foreground))]">Rangliste Double</span>
              <input
                type="number"
                value={formState.levelDouble}
                onChange={(event) => formSetters.setLevelDouble(event.target.value)}
                className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[hsl(var(--foreground))]">Rangliste Mix</span>
              <input
                type="number"
                value={formState.levelMix}
                onChange={(event) => formSetters.setLevelMix(event.target.value)}
                className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
              />
            </label>
          </div>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[hsl(var(--foreground))]">Køn</span>
            <select
              value={formState.gender}
              onChange={(event) => formSetters.setGender(event.target.value as PlayerGender | '')}
              className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
            >
              <option value="">Vælg køn</option>
              <option value={PLAYER_GENDERS.MALE}>{PLAYER_GENDERS.MALE}</option>
              <option value={PLAYER_GENDERS.FEMALE}>{PLAYER_GENDERS.FEMALE}</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[hsl(var(--foreground))]">Primær kategori</span>
            <select
              value={formState.primaryCategory}
              onChange={(event) => formSetters.setPrimaryCategory(event.target.value as PlayerCategory | '')}
              className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
            >
              <option value="">Vælg kategori</option>
              <option value={PLAYER_CATEGORIES.SINGLE}>{PLAYER_CATEGORIES.SINGLE}</option>
              <option value={PLAYER_CATEGORIES.DOUBLE}>{PLAYER_CATEGORIES.DOUBLE}</option>
              <option value={PLAYER_CATEGORIES.BOTH}>{PLAYER_CATEGORIES.BOTH}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted))] cursor-pointer">
            <input
              type="checkbox"
              checked={formState.active}
              onChange={(event) => formSetters.setActive(event.target.checked)}
              className="h-4 w-4 rounded bg-[hsl(var(--surface))] ring-1 ring-[hsl(var(--line)/.12)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none"
            />
            Aktiv spiller
          </label>

          {/* Preferred Partners Section */}
          <div className="space-y-4 pt-4 border-t border-[hsl(var(--line)/.12)]">
            <h4 className="text-sm font-medium text-[hsl(var(--foreground))]">Fast makker</h4>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[hsl(var(--foreground))]">Double makker</span>
              <select
                value={formState.preferredDoublesPartners[0] ?? ''}
                onChange={(event) => {
                  const selectedId = event.target.value
                  formSetters.setPreferredDoublesPartners(selectedId ? [selectedId] : [])
                }}
                className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
              >
                <option value="">Ingen</option>
                {availableDoublesPartners.map((player) => (
                  <option key={player.id} value={player.id}>
                    {formatPlayerName(player.name, player.alias)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[hsl(var(--foreground))]">Mix makker</span>
              <select
                value={formState.preferredMixedPartners[0] ?? ''}
                onChange={(event) => {
                  const selectedId = event.target.value
                  formSetters.setPreferredMixedPartners(selectedId ? [selectedId] : [])
                }}
                className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none transition-all duration-200 motion-reduce:transition-none text-[hsl(var(--foreground))]"
              >
                <option value="">Ingen</option>
                {availableMixedPartners.map((player) => (
                  <option key={player.id} value={player.id}>
                    {formatPlayerName(player.name, player.alias)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>
        {/* Sticky footer actions */}
        <div className="sticky bottom-0 border-t border-[hsl(var(--line)/.12)] bg-[hsl(var(--surface)/.98)]/95 backdrop-blur p-4 sm:p-6 flex justify-end gap-3">
          <Button variant="ghost" type="button" onClick={onClose}>
            Annuller
          </Button>
          <Button type="submit" className="ring-2 ring-[hsl(var(--accent)/.2)]" onClick={(e) => { e.preventDefault(); /* submit via form */ const form = (e.currentTarget.closest('div')?.previousElementSibling as HTMLFormElement | null); form?.requestSubmit?.() }}>
            Gem spiller
          </Button>
        </div>
      </div>
    </div>
  )
}

