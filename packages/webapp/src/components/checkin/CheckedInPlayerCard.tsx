/**
 * Checked-in player card component.
 * 
 * Displays a checked-in player with check-out functionality.
 */

import React, { useEffect, useMemo, useState } from 'react'
import type { CheckedInPlayer } from '@herlev-hjorten/common'
import { clsx } from 'clsx'
import { Button } from '../ui'
import { formatCategoryLetter, formatPlayerCardName } from '../../lib/formatting'
import { PLAYER_CATEGORIES } from '../../constants'
import { InitialsAvatar, MiniIdenticon, getSeedHue } from '../ui/PlayerAvatar'
import { getPlayerUiVariant, VARIANT_CHANGED_EVENT, type PlayerUiVariant } from '../../lib/uiVariants'

/**
 * Props for CheckedInPlayerCard component.
 */
interface CheckedInPlayerCardProps {
  /** Checked-in player data. */
  player: CheckedInPlayer
  
  /** Whether player is animating out. */
  isAnimatingOut: boolean
  
  /** Whether player is animating in. */
  isAnimatingIn: boolean
  
  /** Callback when player is checked out. */
  onCheckOut: (player: CheckedInPlayer) => void
}

/**
 * Category badge component.
 */
const CategoryBadge = ({ category }: { category: CheckedInPlayer['primaryCategory'] }) => {
  if (!category) return null
  
  const labels: Record<typeof category, string> = {
    [PLAYER_CATEGORIES.SINGLE]: 'S',
    [PLAYER_CATEGORIES.DOUBLE]: 'D',
    [PLAYER_CATEGORIES.BOTH]: 'B'
  }
  
  const catLetter = formatCategoryLetter(category)
  
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full text-xs font-bold w-6 h-6',
        'bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] border-hair',
        catLetter && 'cat-ring'
      )}
      data-cat={catLetter || undefined}
      title={category}
    >
      {labels[category]}
    </span>
  )
}

/**
 * Checked-in player card component.
 * 
 * @example
 * ```tsx
 * <CheckedInPlayerCard
 *   player={checkedInPlayer}
 *   onCheckOut={handleCheckOut}
 * />
 * ```
 */
export const CheckedInPlayerCard: React.FC<CheckedInPlayerCardProps> = ({
  player,
  isAnimatingOut,
  isAnimatingIn,
  onCheckOut
}) => {
  const isOneRoundOnly = player.maxRounds === 1
  const catLetter = formatCategoryLetter(player.primaryCategory)
  const [variant, setVariant] = useState<PlayerUiVariant>(() => getPlayerUiVariant())
  useEffect(() => {
    const onChange = (e: Event) => {
      const ev = e as CustomEvent
      setVariant(ev.detail?.variant ?? getPlayerUiVariant())
    }
    window.addEventListener(VARIANT_CHANGED_EVENT, onChange as EventListener)
    return () => window.removeEventListener(VARIANT_CHANGED_EVENT, onChange as EventListener)
  }, [])
  const trainingGroups = useMemo(() => ((player as any).trainingGroups as string[] | undefined) ?? [], [player])
  const avatarRailColor = useMemo(() => {
    if (variant !== 'A') return undefined
    const hue = getSeedHue(player.id || player.name, player.gender ?? null)
    return `hsl(${hue} 70% 75% / .26)`
  }, [variant, player])
  const variantCardBg = useMemo(() => {
    if (variant !== 'C') return undefined
    const hue = getSeedHue(player.id || player.name, player.gender ?? null)
    return `hsl(${hue} 55% 96%)`
  }, [variant, player])
  
  return (
    <div
      className={clsx(
        'flex items-center justify-between gap-3 rounded-md border-hair px-2 py-2 sm:px-3 sm:py-3 min-h-[64px]',
        'hover:shadow-sm transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)]',
        'motion-reduce:transition-none bg-[hsl(var(--success)/.06)]',
        variant === 'A' ? 'avatar-rail' : variant === 'D' ? (catLetter ? 'cat-rail' : '') : '',
        isAnimatingOut && 'opacity-0 scale-95 translate-x-4 pointer-events-none',
        isAnimatingIn && 'opacity-0 scale-95 -translate-x-4'
      )}
      data-cat={variant === 'A' ? undefined : catLetter || undefined}
      style={{
        animation: isAnimatingIn ? 'slideInFromLeft 0.3s ease-out forwards' : undefined,
        ...(variant === 'A' && avatarRailColor ? ({ ['--railColor' as any]: avatarRailColor } as React.CSSProperties) : {}),
        ...(variantCardBg ? ({ backgroundColor: variantCardBg } as React.CSSProperties) : {})
      }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {variant === 'D' && <CategoryBadge category={player.primaryCategory} />}
        {(variant === 'A' || variant === 'C') && (
          <InitialsAvatar seed={player.id} name={player.name} gender={player.gender ?? null} />
        )}
        {variant === 'B' && <MiniIdenticon seed={player.id} gender={player.gender ?? null} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`font-semibold text-[hsl(var(--foreground))] truncate ${variant === 'B' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}>
              {formatPlayerCardName(player.name, player.alias)}
            </p>
            {isOneRoundOnly && (
              <span className="inline-flex items-center rounded-full bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))] border-hair px-2 py-1 text-xs whitespace-nowrap">
                Kun 1 runde
              </span>
            )}
          </div>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onCheckOut(player)}
        className="text-xs px-3 py-1.5 flex-shrink-0"
      >
        Tjek ud
      </Button>
    </div>
  )
}

