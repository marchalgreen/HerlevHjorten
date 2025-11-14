/**
 * Shared types for match program components.
 */

import type { Player } from '@rundeklar/common'
import type React from 'react'

/**
 * Handlers for player slot drag-and-drop operations.
 */
export interface PlayerSlotHandlers {
  /** Handler for drag start */
  onDragStart: (event: React.DragEvent<HTMLDivElement>, player: Player, courtIdx: number, slotIndex: number) => void
  /** Handler for drag end */
  onDragEnd: () => void
  /** Handler for drag over */
  onDragOver: (event: React.DragEvent<HTMLDivElement>, courtIdx: number, slotIndex: number) => void
  /** Handler for drag leave */
  onDragLeave: () => void
  /** Handler for drop */
  onDrop: (event: React.DragEvent<HTMLDivElement>, courtIdx: number, slotIndex: number) => void
}

