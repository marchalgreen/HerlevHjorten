import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '../ui'
import { ArrowDown, Play, ExternalLink } from 'lucide-react'
import { useTenant } from '../../contexts/TenantContext'

/**
 * Hero section component for marketing landing page.
 * Features parallax effect and call-to-action buttons.
 */
export const HeroSection: React.FC = () => {
  const { config } = useTenant()
  const logoPath = `${import.meta.env.BASE_URL}${config.logo}`

  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features')
    featuresSection?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Parallax background */}
      <motion.div
        className="absolute inset-0 z-0"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/.1)] via-transparent to-[hsl(var(--success)/.08)]" />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-32">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Logo */}
          <motion.div
            className="mb-8 sm:mb-12 flex justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <img
              src={logoPath}
              alt={config.name}
              className="h-16 sm:h-20 md:h-24 lg:h-28 object-contain"
            />
          </motion.div>

          {/* Overline */}
          <motion.p
            className="text-sm sm:text-base text-[hsl(var(--muted))] mb-4 uppercase tracking-wide"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            For klubber med faste træningsaftener
          </motion.p>

          {/* Headline */}
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[hsl(var(--foreground))] mb-6 sm:mb-8 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Gør træningsaftenerne <span className="text-[hsl(var(--primary))]">rundeklar på få minutter</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="text-lg sm:text-xl md:text-2xl text-[hsl(var(--muted))] mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            Rundeklar samler indtjekning, runder og statistik i ét enkelt system. Mindre administration, slut med pen og papir og mere tid på banen.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center mb-6 sm:mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <Button
              size="md"
              onClick={() => {
                window.location.href = '/?plan=professional'
              }}
              className="w-full sm:w-auto text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7"
            >
              Start gratis prøveperiode
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => window.open('https://demo.rundeklar.dk', '_blank')}
              className="w-full sm:w-auto text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7"
              aria-label="Prøv live demo (åbner i nyt vindue)"
            >
              <Play className="w-5 h-5 sm:w-6 sm:h-6" />
              Prøv live demo
              <ExternalLink className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          </motion.div>

          {/* Microcopy */}
          <motion.p
            className="text-sm text-[hsl(var(--muted))] mb-12 sm:mb-16 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.0 }}
          >
            Ingen kortoplysninger. 14 dages gratis prøveperiode. Klar til brug på under 10 minutter.
          </motion.p>

          {/* Scroll indicator */}
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
          >
            <motion.button
              onClick={scrollToFeatures}
              className="flex flex-col items-center gap-2 text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
              aria-label="Scroll ned"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="text-sm font-medium">Udforsk mere</span>
              <ArrowDown className="w-5 h-5" />
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

