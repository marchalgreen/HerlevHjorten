import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageCard } from '../../ui'
import { InitialsAvatar } from '../../ui/PlayerAvatar'
import { formatPlayerCardName } from '../../../lib/formatting'
import type { Player } from '@rundeklar/common'

interface CourtSlot {
  courtIdx: number
  slot: number
  player: Player | null
}

interface DragDropDemoProps {
  checkedInPlayers: Player[]
}

/**
 * Simplified drag-and-drop demo component for marketing page.
 * Shows interactive match program with drag-and-drop functionality.
 * Uses checked-in players from check-in demo as bench players.
 */
export const DragDropDemo: React.FC<DragDropDemoProps> = ({ checkedInPlayers }) => {
  // Initialize courts with 4 slots per court (like the real system)
  const [courts, setCourts] = useState<CourtSlot[]>(() => {
    const slots: CourtSlot[] = []
    for (let courtIdx = 1; courtIdx <= 2; courtIdx++) {
      for (let slot = 1; slot <= 4; slot++) {
        slots.push({ courtIdx, slot, player: null })
      }
    }
    return slots
  })
  
  // Bench players are the checked-in players that aren't on a court
  const [playersOnCourts, setPlayersOnCourts] = useState<Set<string>>(new Set())
  const benchPlayers = checkedInPlayers.filter(p => !playersOnCourts.has(p.id))
  const [dragOverSlot, setDragOverSlot] = useState<{ courtIdx: number; slot: number } | null>(null)

  const handleDragStart = (e: React.DragEvent, player: Player) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-player-id', player.id)
  }

  const handleDragEnd = () => {
    setDragOverSlot(null)
  }

  const handleDragOver = (e: React.DragEvent, courtIdx: number, slot: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverSlot({ courtIdx, slot })
  }

  const handleDrop = (e: React.DragEvent, courtIdx: number, slot: number) => {
    e.preventDefault()
    const playerId = e.dataTransfer.getData('application/x-player-id')
    const player = checkedInPlayers.find(p => p.id === playerId)

    if (!player) return

    // Find the target slot and the source slot using current courts state
    const targetSlot = courts.find(c => c.courtIdx === courtIdx && c.slot === slot)
    const sourceSlot = courts.find(c => c.player?.id === playerId)
    
    if (!targetSlot) return

    // If target slot has a player, swap them
    if (targetSlot.player && sourceSlot) {
      const targetPlayer = targetSlot.player
      
      // Swap players - both stay on courts (no change to playersOnCourts needed)
      setCourts(prev => prev.map(c => {
        if (c.courtIdx === courtIdx && c.slot === slot) {
          // Target slot gets the dragged player
          return { ...c, player }
        } else if (c.courtIdx === sourceSlot.courtIdx && c.slot === sourceSlot.slot) {
          // Source slot gets the target player
          return { ...c, player: targetPlayer }
        }
        return c
      }))
    } else {
      // Target slot is empty, just move the player
      setCourts(prev => prev.map(c => {
        if (c.courtIdx === courtIdx && c.slot === slot) {
          // Add player to target slot
          return { ...c, player }
        } else if (c.player?.id === playerId) {
          // Remove player from source slot
          return { ...c, player: null }
        }
        return c
      }))

      // Update playersOnCourts set
      setPlayersOnCourts(prevSet => {
        const newSet = new Set(prevSet)
        if (sourceSlot) {
          // Player was already on a court, keep them in the set
          return newSet
        } else {
          // Player was on bench, add them to courts set
          newSet.add(playerId)
          return newSet
        }
      })
    }

    setDragOverSlot(null)
    setDraggedPlayer(null)
  }

  const handleDragLeave = () => {
    setDragOverSlot(null)
  }

  const handleRemoveFromCourt = (player: Player) => {
    setCourts(prev => prev.map(c => {
      if (c.player?.id === player.id) {
        setPlayersOnCourts(prevSet => {
          const newSet = new Set(prevSet)
          newSet.delete(player.id)
          return newSet
        })
        return { ...c, player: null }
      }
      return c
    }))
  }

  const getCourtSlots = (courtIdx: number) => {
    return courts.filter(c => c.courtIdx === courtIdx).sort((a, b) => a.slot - b.slot)
  }

  const renderNetDivider = () => (
    <div className="relative flex items-center justify-center py-1">
      <div className="absolute inset-0 flex items-center">
        <div className="h-px w-full bg-[hsl(var(--line)/.3)]"></div>
      </div>
      <div className="relative bg-[hsl(var(--surface))] px-2">
        <div className="h-1 w-8 rounded-full bg-[hsl(var(--primary)/.2)] ring-1 ring-[hsl(var(--primary)/.3)]"></div>
      </div>
    </div>
  )

  const renderSlot = (courtSlot: CourtSlot) => {
    const hasPlayer = courtSlot.player !== null
    const minHeight = hasPlayer ? 'min-h-[56px] sm:min-h-[64px]' : 'min-h-[56px] sm:min-h-[64px]'
    
    return (
      <div
        key={`${courtSlot.courtIdx}-${courtSlot.slot}`}
        onDragOver={(e) => handleDragOver(e, courtSlot.courtIdx, courtSlot.slot)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, courtSlot.courtIdx, courtSlot.slot)}
        className={`${minHeight} rounded-lg border-2 border-dashed transition-colors ${
          dragOverSlot?.courtIdx === courtSlot.courtIdx && dragOverSlot?.slot === courtSlot.slot
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)]'
            : 'border-[hsl(var(--line)/.3)] bg-[hsl(var(--surface-2)/.5)]'
        }`}
      >
        {courtSlot.player ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <div
              className="h-full flex items-center justify-between gap-2 sm:gap-3 rounded-md px-2 py-1.5 sm:py-2 bg-[hsl(var(--surface))] cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={(e) => handleDragStart(e, courtSlot.player!)}
              onDragEnd={handleDragEnd}
            >
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <InitialsAvatar seed={courtSlot.player.id} name={courtSlot.player.name} gender={courtSlot.player.gender ?? null} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[hsl(var(--foreground))] truncate text-xs sm:text-sm">
                    {formatPlayerCardName(courtSlot.player.name, courtSlot.player.alias)}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveFromCourt(courtSlot.player!)
                }}
                className="text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] text-xs flex-shrink-0"
                aria-label="Fjern spiller"
              >
                ×
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-[hsl(var(--muted))]">
            Slip her
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-x-hidden pb-2">
      {/* Bench */}
      <div className="overflow-x-hidden">
        <h3 className="text-sm font-semibold text-[hsl(var(--muted))] mb-3 uppercase tracking-wide">
          Bænk ({benchPlayers.length})
        </h3>
        {benchPlayers.length === 0 ? (
          <div className="text-center py-8 text-[hsl(var(--muted))]">
            <p className="text-sm">Ingen spillere på bænken</p>
            <p className="text-xs mt-1">Tjek spillere ind i &quot;Tjek ind&quot; for at se dem her</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-2">
            <AnimatePresence>
              {benchPlayers.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <PageCard
                    className="cursor-grab active:cursor-grabbing bg-[hsl(var(--surface))]"
                    draggable
                    onDragStart={(e) => handleDragStart(e, player)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex items-center gap-3">
                      <InitialsAvatar seed={player.id} name={player.name} gender={player.gender ?? null} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[hsl(var(--foreground))] truncate text-sm">
                          {formatPlayerCardName(player.name, player.alias)}
                        </p>
                      </div>
                    </div>
                  </PageCard>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Courts */}
      <div className="overflow-x-hidden">
        <h3 className="text-sm font-semibold text-[hsl(var(--muted))] mb-3 uppercase tracking-wide">
          Baner
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((courtIdx) => {
            const slots = getCourtSlots(courtIdx)
            const slotsAboveNet = slots.filter(s => s.slot <= 2)
            const slotsBelowNet = slots.filter(s => s.slot > 2)
            
            return (
              <div key={courtIdx} className="overflow-x-hidden">
                <h4 className="text-xs font-medium text-[hsl(var(--muted))] mb-2">Bane {courtIdx}</h4>
                <div className="flex flex-col gap-1.5">
                  {/* Slots above net */}
                  <div className="grid grid-cols-2 gap-2">
                    {slotsAboveNet.map(renderSlot)}
                  </div>
                  {/* Net divider */}
                  {renderNetDivider()}
                  {/* Slots below net */}
                  <div className="grid grid-cols-2 gap-2">
                    {slotsBelowNet.map(renderSlot)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

