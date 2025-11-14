/**
 * Test page for Prism background component.
 */

import React from 'react'
import Prism from '../components/Prism'
import { PageCard } from '../components/ui'

const PrismTestPage = () => {
  return (
    <section className="flex flex-col gap-4 sm:gap-6 pt-2 sm:pt-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))]">
          Prism Background Test
        </h1>
        <p className="text-sm text-[hsl(var(--muted))]">
          Testing the animated Prism background component
        </p>
      </header>

      <PageCard className="relative overflow-hidden" style={{ width: '100%', height: '600px' }}>
        <Prism
          animationType="rotate"
          timeScale={0.5}
          height={3.5}
          baseWidth={5.5}
          scale={3.6}
          hueShift={0}
          colorFrequency={1}
          noise={0}
          glow={1}
        />
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-[hsl(var(--surface)/.9)] backdrop-blur-sm rounded-lg px-6 py-4 shadow-lg">
            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-2">
              Prism Background
            </h2>
            <p className="text-sm text-[hsl(var(--muted))]">
              This is a test of the animated Prism background component
            </p>
          </div>
        </div>
      </PageCard>
    </section>
  )
}

export default PrismTestPage

