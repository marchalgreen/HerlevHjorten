/**
 * Editable partner cell component for table inline editing.
 * 
 * Allows users to select a preferred partner (doubles or mixed) for a player
 * with inline editing, search, and confirmation dialogs.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '@rundeklar/common'
import api from '../../api'
import { formatPlayerName } from '../../lib/formatting'
import { normalizeError } from '../../lib/errors'
import { PLAYER_GENDERS } from '../../constants'
import { useToast } from '../ui/Toast'

/**
 * Props for EditablePartnerCell component.
 */
interface EditablePartnerCellProps {
  /** Player to edit partner for. */
  player: Player
  
  /** Type of partner (doubles or mixed). */
  partnerType: 'doubles' | 'mixed'
  
  /** All available players for selection. */
  allPlayers: Player[]
  
  /** Callback when partner is updated. */
  onUpdate: () => void
  
  /** Optional callback to call before update (e.g., to save scroll position). */
  onBeforeUpdate?: () => void
}

/**
 * Confirmation dialog component for partner override.
 */
const PartnerOverrideDialog: React.FC<{
  existingPartnerName: string
  onConfirm: () => void
  onCancel: () => void
}> = ({ existingPartnerName, onConfirm, onCancel }) => (
  <div
    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    onClick={(e) => {
      if (e.target === e.currentTarget) {
        onCancel()
      }
    }}
  >
    <div
      className="bg-[hsl(var(--surface))] rounded-lg shadow-lg p-4 sm:p-6 max-w-md w-full mx-4 ring-1 ring-[hsl(var(--line)/.12)]"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-2">Bekræft overskrivning</h3>
      <p className="text-sm text-[hsl(var(--muted))] mb-4">
        Den valgte spiller er allerede tildelt til <strong>{existingPartnerName}</strong>. Vil du overskrive denne
        tilknytning?
      </p>
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onCancel()
          }}
          className="px-4 py-2 text-sm rounded bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.85)] transition-colors"
        >
          Annuller
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onConfirm()
          }}
          className="px-4 py-2 text-sm rounded bg-[hsl(var(--primary))] text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          Overskriv
        </button>
      </div>
    </div>
  </div>
)

/**
 * Editable partner cell component.
 * 
 * Allows inline editing of player's preferred partner with search and confirmation.
 * 
 * @example
 * ```tsx
 * <EditablePartnerCell
 *   player={player}
 *   partnerType="doubles"
 *   allPlayers={allPlayers}
 *   onUpdate={handleUpdate}
 * />
 * ```
 */
export const EditablePartnerCell: React.FC<EditablePartnerCellProps> = ({
  player,
  partnerType,
  allPlayers,
  onUpdate,
  onBeforeUpdate
}) => {
  const { notify } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingPartnerId, setPendingPartnerId] = useState<string | null>(null)
  const [existingPartnerName, setExistingPartnerName] = useState<string>('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get current partner ID
  const partnerId = useMemo(() => {
    const doublesPartners = (player as Player & { preferredDoublesPartners?: string[] | null }).preferredDoublesPartners
    const mixedPartners = (player as Player & { preferredMixedPartners?: string[] | null }).preferredMixedPartners
    return partnerType === 'doubles'
      ? (doublesPartners?.[0] ?? null)
      : (mixedPartners?.[0] ?? null)
  }, [player, partnerType])

  // Get current partner
  const partner = useMemo(() => {
    return partnerId ? allPlayers.find((p) => p.id === partnerId) ?? null : null
  }, [partnerId, allPlayers])

  /**
   * Filters available players based on gender logic.
   */
  const availablePlayers = useMemo(() => {
    // First, get all players excluding self
    const allExceptSelf = allPlayers.filter((p) => p.id !== player.id)

    // If player has no gender set, show all players from the club
    if (!player.gender) return allExceptSelf

    // Apply gender-based filtering
    let filtered: Player[] = []
    if (partnerType === 'doubles') {
      // Same gender for doubles partner
      filtered = allExceptSelf.filter((p) => p.gender === player.gender)
    } else {
      // Opposite gender for mixed partner
      if (player.gender === PLAYER_GENDERS.MALE) {
        filtered = allExceptSelf.filter((p) => p.gender === PLAYER_GENDERS.FEMALE)
      } else if (player.gender === PLAYER_GENDERS.FEMALE) {
        filtered = allExceptSelf.filter((p) => p.gender === PLAYER_GENDERS.MALE)
      } else {
        filtered = allExceptSelf
      }
    }

    // If no players match the gender filter, fall back to showing all players
    return filtered.length > 0 ? filtered : allExceptSelf
  }, [allPlayers, player.id, player.gender, partnerType])

  /**
   * Filters players by search term.
   */
  const filteredPlayers = useMemo(() => {
    if (!searchTerm) return availablePlayers
    const search = searchTerm.toLowerCase()
    return availablePlayers.filter((p) => {
      const nameLower = p.name.toLowerCase()
      const aliasLower = (p.alias ?? '').toLowerCase()
      return nameLower.includes(search) || aliasLower.includes(search)
    })
  }, [availablePlayers, searchTerm])

  /**
   * Closes dropdown when clicking outside.
   * Note: Don't close if confirmation dialog is showing.
   */
  useEffect(() => {
    if (!isEditing || showConfirmDialog) return

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEditing(false)
        setEditingPartnerId(partnerId)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isEditing, partnerId, showConfirmDialog])

  /**
   * Resets editing state when player changes.
   */
  useEffect(() => {
    const playerAny = player as any
    const currentPartnerId = partnerType === 'doubles'
      ? (playerAny.preferredDoublesPartners?.[0] ?? null)
      : (playerAny.preferredMixedPartners?.[0] ?? null)
    if (!isEditing) {
      setEditingPartnerId(currentPartnerId)
    }
  }, [player, partnerType, isEditing])

  /**
   * Performs the partner update operation.
   */
  const performPartnerUpdate = useCallback(
    async (selectedId: string | null) => {
      try {
        // Step 0: Save scroll position if callback provided (before any updates)
        if (onBeforeUpdate) {
          onBeforeUpdate()
        }

        // Step 1: Fetch fresh data directly from API to ensure we have the latest state
        // Note: We don't call onUpdate() here to avoid triggering a re-render before updates are complete
        const freshPlayers = await api.players.list({})
        const freshCurrentPlayer = freshPlayers.find((p) => p.id === player.id)
        if (!freshCurrentPlayer) {
          throw new Error('Current player not found after reload')
        }

        // Step 2: Clear the current player's old partner relationship (if any)
        const freshPlayer = freshCurrentPlayer as Player & {
          preferredDoublesPartners?: string[] | null
          preferredMixedPartners?: string[] | null
        }
        const currentPartnerId = partnerType === 'doubles'
          ? (freshPlayer.preferredDoublesPartners?.[0] ?? null)
          : (freshPlayer.preferredMixedPartners?.[0] ?? null)

        if (currentPartnerId && currentPartnerId !== selectedId) {
        // Clear the old partner's relationship
        const clearOldPartnerData: any = partnerType === 'doubles'
          ? { preferredDoublesPartners: [] }
          : { preferredMixedPartners: [] }

        await api.players.update({
          id: currentPartnerId,
          patch: clearOldPartnerData
        })
        }

        // Step 3: If a partner was selected, clear their existing relationship first
        if (selectedId) {
          const selectedPartner = freshPlayers.find((p) => p.id === selectedId)

          if (selectedPartner) {
            const selectedPartnerWithPartners = selectedPartner as Player & {
              preferredDoublesPartners?: string[] | null
              preferredMixedPartners?: string[] | null
            }
            const existingPartnerId = partnerType === 'doubles'
              ? (selectedPartnerWithPartners.preferredDoublesPartners?.[0] ?? null)
              : (selectedPartnerWithPartners.preferredMixedPartners?.[0] ?? null)

            // If they have an existing partner (and it's not the current player), remove that relationship
            if (existingPartnerId && existingPartnerId !== player.id) {
              // Clear the existing partner's relationship
              const clearExistingData: any = partnerType === 'doubles'
                ? { preferredDoublesPartners: [] }
                : { preferredMixedPartners: [] }

              await api.players.update({
                id: existingPartnerId,
                patch: clearExistingData
              })
            }
          }
        }

        // Step 4: Update the current player with the new partner
        const updateData: any = partnerType === 'doubles'
          ? { preferredDoublesPartners: selectedId ? [selectedId] : [] }
          : { preferredMixedPartners: selectedId ? [selectedId] : [] }

        await api.players.update({
          id: player.id,
          patch: updateData
        })

        // Step 5: If a partner was selected, set the bidirectional relationship
        if (selectedId) {
          const partnerUpdateData: any = partnerType === 'doubles'
            ? { preferredDoublesPartners: [player.id] }
            : { preferredMixedPartners: [player.id] }

          await api.players.update({
            id: selectedId,
            patch: partnerUpdateData
          })
        }

        // Step 6: Reload data and close
        await onUpdate()
        setIsEditing(false)
        setSearchTerm('')
        setShowConfirmDialog(false)
        setPendingPartnerId(null)
        setExistingPartnerName('')
        notify({
          variant: 'success',
          title: selectedId
            ? `${partnerType === 'doubles' ? 'Double' : 'Mix'} makker opdateret`
            : `${partnerType === 'doubles' ? 'Double' : 'Mix'} makker fjernet`
        })
      } catch (err: unknown) {
        const normalizedError = normalizeError(err)
        notify({
          variant: 'danger',
          title: `Kunne ikke opdatere ${partnerType === 'doubles' ? 'double' : 'mix'} makker`,
          description: normalizedError.message
        })
        setShowConfirmDialog(false)
        setPendingPartnerId(null)
        setExistingPartnerName('')
      }
    },
    [player.id, partnerType, onUpdate, notify, onBeforeUpdate]
  )

  /**
   * Handles selecting a player as partner.
   */
  const handleSelectPlayer = useCallback(
    async (selectedId: string | null) => {
      try {
      // If clearing, proceed directly
      if (!selectedId) {
        await performPartnerUpdate(null)
        return
      }

        // Step 1: Reload fresh data to ensure we have the latest state
        // Note: We fetch fresh data directly without calling onUpdate() first
        // to avoid triggering a re-render that might reset our state
        const freshPlayers = await api.players.list({})

        // Step 2: Check if the selected partner already has a preferred partner using fresh data
        const selectedPartner = freshPlayers.find((p) => p.id === selectedId)
        if (!selectedPartner) {
          // Selected partner not found, proceed anyway (will fail gracefully in performPartnerUpdate)
          await performPartnerUpdate(selectedId)
          return
        }

        const selectedPartnerWithPartners = selectedPartner as Player & {
          preferredDoublesPartners?: string[] | null
          preferredMixedPartners?: string[] | null
        }
        const existingPartnerId = partnerType === 'doubles'
          ? (selectedPartnerWithPartners.preferredDoublesPartners?.[0] ?? null)
          : (selectedPartnerWithPartners.preferredMixedPartners?.[0] ?? null)

        // If they already have a partner and it's not the current player, show confirmation
        if (existingPartnerId && existingPartnerId !== player.id) {
          const existingPartner = freshPlayers.find((p) => p.id === existingPartnerId)
          if (existingPartner) {
            // Set state synchronously to ensure dialog shows
            setPendingPartnerId(selectedId)
            setExistingPartnerName(existingPartner.name)
            setShowConfirmDialog(true)
            return
        }
      }

      // No existing partner or it's the current player, proceed directly
      await performPartnerUpdate(selectedId)
      } catch (err: unknown) {
        const normalizedError = normalizeError(err)
        notify({
          variant: 'danger',
          title: `Kunne ikke vælge ${partnerType === 'doubles' ? 'double' : 'mix'} makker`,
          description: normalizedError.message
        })
      }
    },
    [partnerType, player.id, performPartnerUpdate, notify]
  )

  /**
   * Handles confirming partner override.
   */
  const handleConfirmOverride = useCallback(async () => {
    if (pendingPartnerId) {
      await performPartnerUpdate(pendingPartnerId)
    }
  }, [pendingPartnerId, performPartnerUpdate])

  /**
   * Handles canceling partner selection.
   */
  const handleCancel = useCallback(() => {
    setIsEditing(false)
    setEditingPartnerId(partnerId)
    setSearchTerm('')
  }, [partnerId])

  /**
   * Handles saving partner selection.
   */
  const handleSave = useCallback(async () => {
    await performPartnerUpdate(editingPartnerId)
  }, [editingPartnerId, performPartnerUpdate])

  // Render confirmation dialog even when not in editing mode (if it's showing)
  const dialogElement = showConfirmDialog ? (
    <PartnerOverrideDialog
      existingPartnerName={existingPartnerName}
      onConfirm={handleConfirmOverride}
      onCancel={() => {
        setShowConfirmDialog(false)
        setPendingPartnerId(null)
        setExistingPartnerName('')
        // If we were editing, close editing mode
        if (isEditing) {
          setIsEditing(false)
          setEditingPartnerId(partnerId)
          setSearchTerm('')
        }
      }}
    />
  ) : null

  // Early return for non-editing state
  if (!isEditing) {
    return (
      <>
        {dialogElement}
      <div className="w-full max-w-full sm:max-w-[200px] mx-auto">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="w-full text-xs rounded bg-[hsl(var(--surface))] px-2 py-1 ring-1 ring-[hsl(var(--line)/.14)] hover:ring-2 hover:ring-[hsl(var(--ring))] transition-colors text-left"
        >
          {partner ? formatPlayerName(partner.name, partner.alias) : 'Ingen'}
        </button>
      </div>
      </>
    )
  }

  // Editing state - render the editing UI
  return (
      <>
        {dialogElement}
      <div ref={dropdownRef} className="relative w-full max-w-full sm:max-w-[200px]">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && filteredPlayers.length > 0) {
              e.preventDefault()
              const firstButton = dropdownRef.current?.querySelector('button[type="button"]:not(:first-child)') as HTMLButtonElement
              firstButton?.focus()
            }
          }}
          placeholder="Søg..."
          className="w-full text-xs rounded bg-[hsl(var(--surface))] px-2 py-1 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
        <div className="absolute top-[28px] left-0 w-full min-w-[180px] sm:min-w-[200px] bg-[hsl(var(--surface))] border border-[hsl(var(--line)/.14)] rounded shadow-lg max-h-[150px] overflow-y-auto z-[100]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
                  void handleSelectPlayer(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                    void handleSelectPlayer(null)
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                const next = e.currentTarget.nextElementSibling as HTMLButtonElement
                next?.focus()
              }
            }}
            tabIndex={0}
            className={`w-full text-left px-2 py-1 text-xs hover:bg-[hsl(var(--surface-2))] transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] ${
              editingPartnerId === null ? 'bg-[hsl(var(--primary)/.1)]' : ''
            }`}
          >
            Ingen
          </button>
          {availablePlayers.length === 0 ? (
            <div className="px-2 py-1 text-xs text-[hsl(var(--muted))]">Ingen andre spillere i klubben</div>
          ) : filteredPlayers.length === 0 ? (
            <div className="px-2 py-1 text-xs text-[hsl(var(--muted))]">Ingen spillere fundet</div>
          ) : (
            filteredPlayers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  void handleSelectPlayer(p.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    void handleSelectPlayer(p.id)
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    const next = e.currentTarget.nextElementSibling as HTMLButtonElement
                    next?.focus()
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    const prev = e.currentTarget.previousElementSibling as HTMLButtonElement
                    prev?.focus()
                  }
                }}
                tabIndex={0}
                className={`w-full text-left px-2 py-1 text-xs hover:bg-[hsl(var(--surface-2))] transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] ${
                  editingPartnerId === p.id ? 'bg-[hsl(var(--primary)/.1)]' : ''
                }`}
              >
                {formatPlayerName(p.name, p.alias)}
              </button>
            ))
          )}
        </div>
        <div className="flex gap-1 mt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleSave()
            }}
            className="text-xs px-2 py-1 bg-[hsl(var(--primary))] text-white rounded hover:opacity-90"
          >
            Gem
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleCancel()
            }}
            className="text-xs px-2 py-1 bg-[hsl(var(--surface-2))] rounded hover:opacity-90"
          >
            Annuller
          </button>
        </div>
      </div>
    </>
  )
}

