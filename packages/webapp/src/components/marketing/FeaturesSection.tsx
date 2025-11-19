import React from 'react'
import { motion } from 'framer-motion'
import { PageCard } from '../ui'
import { UserCheck, Grid2x2, Users, BarChart3, Zap, Shield } from 'lucide-react'
import { useInView } from 'framer-motion'
import { useRef } from 'react'

interface Feature {
  icon: React.ReactNode
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: <UserCheck className="w-8 h-8 sm:w-10 sm:h-10" />,
    title: 'Hurtigt tjek ind',
    description: 'Spillerne tjekker ind på få sekunder via tablet eller mobil. Du har altid styr på hvem der er mødt op.'
  },
  {
    icon: <Grid2x2 className="w-8 h-8 sm:w-10 sm:h-10" />,
    title: 'Drag & drop matchmaking',
    description: 'Træk spillere mellem bænk og baner med intuitiv drag & drop. Rundeklar matcher automatisk runder på tværs af alle baner.'
  },
  {
    icon: <Users className="w-8 h-8 sm:w-10 sm:h-10" />,
    title: 'Spilleradministration',
    description: 'Samlet spillerkartotek med hold, niveauer og træningsgrupper. Slut med papir og løse lister.'
  },
  {
    icon: <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10" />,
    title: 'Avancerede statistikker',
    description: 'Følg fremmøde, aktivitet og udvikling på spillere og grupper over tid. Hjælper dig med at træffe bedre trænerbeslutninger.'
  },
  {
    icon: <Zap className="w-8 h-8 sm:w-10 sm:h-10" />,
    title: 'Hurtig og effektiv',
    description: 'Designet til at køre stabilt på både klub PC, iPad og mobil. Perfekt til travle træningsaftener.'
  },
  {
    icon: <Shield className="w-8 h-8 sm:w-10 sm:h-10" />,
    title: 'Sikker og privat',
    description: 'Dine data behandles efter gældende GDPR og gemmes sikkert. Du beholder altid ejerskab over klubbens data.'
  }
]

const FeatureCard: React.FC<{ feature: Feature; index: number }> = ({ feature, index }) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <PageCard hover className="h-full">
        <div className="flex flex-col items-start gap-4">
          <div className="text-[hsl(var(--primary))]">
            {feature.icon}
          </div>
          <h3 className="text-xl sm:text-2xl font-semibold text-[hsl(var(--foreground))]">
            {feature.title}
          </h3>
          <p className="text-[hsl(var(--muted))] text-sm sm:text-base leading-relaxed">
            {feature.description}
          </p>
        </div>
      </PageCard>
    </motion.div>
  )
}

/**
 * Features section component for marketing landing page.
 * Displays key features in a grid layout with animations.
 */
export const FeaturesSection: React.FC = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="features" ref={ref} className="relative py-20 sm:py-24 lg:py-32 bg-[hsl(var(--bg-canvas))] overflow-hidden">
      {/* Blurred background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}tennis1.jpg)`,
          filter: 'blur(8px)',
          transform: 'scale(1.05)',
        }}
      />
      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--bg-canvas)/.7)] via-[hsl(var(--bg-canvas)/.6)] to-[hsl(var(--bg-canvas)/.7)] z-0" />
      
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-12 sm:mb-16 lg:mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--foreground))] mb-4 sm:mb-6">
            Alt hvad din klub har brug for til træningsaftenen
          </h2>
          <p className="text-lg sm:text-xl text-[hsl(var(--muted))] max-w-2xl mx-auto">
            Samlet system til indtjekning, runder og overblik. Udviklet til danske klubber med faste træningsaftener.
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <FeatureCard key={index} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

