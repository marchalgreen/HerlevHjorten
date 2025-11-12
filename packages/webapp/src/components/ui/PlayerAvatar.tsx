import React, { useMemo } from 'react'

// Deterministic pastel background; to avoid cross-gender collisions we map to disjoint hue bands.
// Herre → lower band, Dame → upper band. Unknown → full spectrum.
export const getSeedHue = (seed: string, gender?: 'Herre' | 'Dame' | null) => {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  // New bands to increase separation and avoid stereotypical palettes:
  // Inverted as requested:
  // Herre → green 80–140, Dame → blue/purple 200–260
  if (gender === 'Herre')  { const start = 80,  span = 60; return start + (h % span) }
  if (gender === 'Dame')   { const start = 200, span = 60; return start + (h % span) }
  // Unknown: full range
  return h
}

const hslFromSeed = (seed: string, gender?: 'Herre' | 'Dame' | null) => {
  const hue = getSeedHue(seed, gender)
  return `hsl(${hue} 70% 90%)`
}

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('')
}

export const InitialsAvatar: React.FC<{ seed: string; name: string; size?: number; gender?: 'Herre' | 'Dame' | null }> = ({
  seed,
  name,
  size = 28,
  gender
}) => {
  const bg = useMemo(() => hslFromSeed(seed || name, gender), [seed, name, gender])
  const initials = useMemo(() => initialsOf(name), [name])
  return (
    <div
      className="relative inline-flex items-center justify-center rounded-full font-semibold text-[11px]"
      style={{ width: size, height: size, backgroundColor: bg, color: 'hsl(220 20% 20%)' }}
      aria-label={name}
    >
      {initials || '•'}
      {gender ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -bottom-0.5 bg-[hsl(var(--surface-3))] ring-1 ring-[hsl(var(--line)/.2)]"
          style={{ width: Math.max(8, size * 0.35), height: Math.max(8, size * 0.35), borderRadius: gender === 'Dame' ? 999 : 2 }}
          title={gender}
        />
      ) : null}
    </div>
  )
}

// Very small 3x3 identicon (deterministic) using blocks
export const MiniIdenticon: React.FC<{ seed: string; size?: number; cat?: 'S' | 'D' | 'B'; gender?: 'Herre' | 'Dame' | null }> = ({ seed, size = 28, cat, gender }) => {
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (s * 33 + seed.charCodeAt(i)) >>> 0
  // Calm, monochrome look: use theme foreground with soft opacity; surface-2 as background
  const alpha = 25 + (s % 20) // 25–44
  let color: string
  if (gender) {
    const hue = getSeedHue(seed, gender)
    color = `hsl(${hue} 70% 45% / .${alpha})`
  } else if (cat) {
    color =
      cat === 'S'
        ? `hsl(var(--cat-single)/.${alpha})`
        : cat === 'D'
          ? `hsl(var(--cat-double)/.${alpha})`
          : `hsl(var(--cat-mixed)/.${alpha})`
  } else {
    color = `hsl(var(--foreground)/.${alpha})`
  }
  const light = `hsl(var(--surface-2))`
  // generate 5 bits for mirrored 3x3 (center column unique)
  const bits = Array.from({ length: 5 }, (_, i) => ((s >> (i * 3)) & 1) === 1)
  const cells = [bits[0], bits[1], bits[2], bits[3], bits[4], bits[3], bits[2], bits[1], bits[0]]
  const cell = Math.floor(size / 3)
  return (
    <div className="inline-block rounded-sm ring-1 ring-[hsl(var(--line)/.2)] overflow-hidden" style={{ width: size, height: size, background: light }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${cell}px)`, gridTemplateRows: `repeat(3, ${cell}px)` }}>
        {cells.map((on, i) => (
          <div key={i} style={{ width: cell, height: cell, background: on ? color : 'transparent' }} />
        ))}
      </div>
    </div>
  )
}


