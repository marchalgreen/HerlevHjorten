/**
 * Editable training groups cell with inline multi-select editing.
 * Allows adding/removing existing groups and creating new ones on the fly.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '@rundeklar/common'
import api from '../../api'
import { normalizeError } from '../../lib/errors'
import { useToast } from '../ui/Toast'
import { fetchTrainingGroups } from '../../services/coachLandingApi'

interface EditableTrainingGroupsCellProps {
  player: Player
  onUpdate: () => void
  onBeforeUpdate?: () => void
}

export const EditableTrainingGroupsCell: React.FC<EditableTrainingGroupsCellProps> = ({
  player,
  onUpdate,
  onBeforeUpdate
}) => {
  const { notify } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [availableGroups, setAvailableGroups] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [newGroupInput, setNewGroupInput] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const playerGroups = useMemo(() => {
    const anyPlayer = player as Player & { trainingGroups?: string[] | null }
    return anyPlayer.trainingGroups ?? []
  }, [player])

  useEffect(() => {
    setSelected(playerGroups)
  }, [playerGroups, isEditing])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const groups = await fetchTrainingGroups()
        if (!mounted) return
        setAvailableGroups(groups.map((g) => g.name))
      } catch {
        // ignore, UI will still allow free-text add
      }
    }
    if (isEditing) void load()
    return () => {
      mounted = false
    }
  }, [isEditing])

  const handleSave = useCallback(async () => {
    try {
      if (onBeforeUpdate) onBeforeUpdate()
      await api.players.update({
        id: player.id,
        patch: { trainingGroups: selected }
      } as any)
      await onUpdate()
      setIsEditing(false)
      setSearch('')
      setNewGroupInput('')
      notify({ variant: 'success', title: 'Træningsgrupper opdateret' })
    } catch (err) {
      const e = normalizeError(err)
      notify({ variant: 'danger', title: 'Kunne ikke opdatere træningsgrupper', description: e.message })
    }
  }, [onBeforeUpdate, player.id, selected, onUpdate, notify])

  useEffect(() => {
    if (!isEditing) return
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        // Auto-save on outside click if there are changes
        const a = new Set(selected)
        const b = new Set(playerGroups)
        const sizesEqual = a.size === b.size
        const contentsEqual = sizesEqual && Array.from(a).every((x) => b.has(x))
        if (!contentsEqual) {
          void handleSave()
        } else {
          setIsEditing(false)
        }
        setSearch('')
        setNewGroupInput('')
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [isEditing, selected, playerGroups, handleSave])

  const filteredGroups = useMemo(() => {
    const lower = search.trim().toLowerCase()
    const uniq = Array.from(new Set([...availableGroups].sort((a, b) => a.localeCompare(b, 'da'))))
    if (!lower) return uniq
    return uniq.filter((g) => g.toLowerCase().includes(lower))
  }, [availableGroups, search])

  const toggleSelection = useCallback((name: string) => {
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }, [])

  const addNewGroup = useCallback(() => {
    const name = newGroupInput.trim()
    if (!name) return
    setSelected((prev) => (prev.includes(name) ? prev : [...prev, name]))
    setAvailableGroups((prev) => (prev.includes(name) ? prev : [...prev, name]))
    setNewGroupInput('')
  }, [newGroupInput])

  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-1">
        {playerGroups.length === 0 ? (
          <span className="text-xs text-[hsl(var(--muted))]">–</span>
        ) : (
          playerGroups.map((g) => (
            <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--surface-2))] ring-1 ring-[hsl(var(--line)/.12)]">
              {g}
            </span>
          ))
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsEditing(true)
          }}
          className="ml-1 text-xs px-2 py-0.5 rounded bg-[hsl(var(--surface))] ring-1 ring-[hsl(var(--line)/.14)] hover:ring-2 hover:ring-[hsl(var(--ring))]"
          title="Rediger træningsgrupper"
        >
          Rediger
        </button>
      </div>
    )
  }

  return (
    <div ref={dropdownRef} className="relative w-full max-w-[240px] mx-auto">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Søg gruppe..."
        className="w-full text-xs rounded bg-[hsl(var(--surface))] px-2 py-1 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none"
        autoFocus
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute top-[28px] left-0 right-0 bg-[hsl(var(--surface))] border border-[hsl(var(--line)/.14)] rounded shadow-lg max-h-[160px] overflow-y-auto z-[100]">
        {/* Quick-add when no exact match exists for current search */}
        {(() => {
          const term = search.trim()
          const exists = term.length > 0 && availableGroups.some((g) => g.localeCompare(term, 'da', { sensitivity: 'accent' }) === 0)
          if (term && !exists) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  // Add to available + select it
                  setAvailableGroups((prev) => (prev.includes(term) ? prev : [...prev, term]))
                  setSelected((prev) => (prev.includes(term) ? prev : [...prev, term]))
                  // Keep search so user sees it selected; they can save after
                }}
                className="w-full text-left px-2 py-1 text-xs bg-[hsl(var(--accent)/.08)] hover:bg-[hsl(var(--accent)/.12)] transition-colors"
                title="Tilføj ny gruppe"
              >
                Tilføj “{term}”
              </button>
            )
          }
          return null
        })()}
        {filteredGroups.length === 0 ? (
          <div className="px-2 py-1 text-xs text-[hsl(var(--muted))]">Ingen grupper</div>
        ) : (
          filteredGroups.map((g) => {
            const checked = selected.includes(g)
            return (
              <button
                key={g}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleSelection(g)
                }}
                className={`w-full text-left px-2 py-1 text-xs hover:bg-[hsl(var(--surface-2))] transition-colors ${checked ? 'bg-[hsl(var(--primary)/.08)]' : ''}`}
              >
                <span className="inline-flex items-center gap-2">
                  <span className={`inline-block w-3 h-3 rounded border ${checked ? 'bg-[hsl(var(--primary))] border-[hsl(var(--primary))]' : 'border-[hsl(var(--line)/.35)]'}`} />
                  {g}
                </span>
              </button>
            )
          })
        )}
      </div>
      <div className="flex items-center gap-1 mt-1">
        <input
          type="text"
          value={newGroupInput}
          onChange={(e) => setNewGroupInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addNewGroup()
            }
          }}
          placeholder="Ny gruppe..."
          className="flex-1 text-xs rounded bg-[hsl(var(--surface))] px-2 py-1 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            addNewGroup()
          }}
          className="text-xs px-2 py-1 bg-[hsl(var(--surface-2))] rounded hover:opacity-90"
        >
          Tilføj
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            void handleSave()
          }}
          className="text-xs px-2 py-1 bg-[hsl(var(--primary))] text-white rounded hover:opacity-90"
        >
          Gem
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsEditing(false)
            setSearch('')
            setNewGroupInput('')
          }}
          className="text-xs px-2 py-1 bg-[hsl(var(--surface-2))] rounded hover:opacity-90"
        >
          Annuller
        </button>
      </div>
    </div>
  )
}


