import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { PageCard } from '../ui'
import { Button } from '../ui'
import { pricingPlans, type PricingPlan } from '../../lib/marketing/pricing'
import { Check, Sparkles, Crown } from 'lucide-react'

/**
 * Pricing card component with playful animations.
 */
const PricingCard: React.FC<{ 
  plan: PricingPlan
  isYearly: boolean
  index: number
  isHovered: string | null
  onHover: (id: string | null) => void
}> = ({ plan, isYearly, index, isHovered, onHover }) => {
  const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice
  const monthlyEquivalent = plan.monthlyPrice === 0 ? null : isYearly ? `${Math.round(plan.yearlyPrice / 12)} kr/måned` : null
  
  // Determine power level for icon progression
  const getPowerLevel = () => {
    if (plan.id === 'basic') return 1
    if (plan.id === 'professional') return 3
    return 5 // enterprise
  }
  
  const powerLevel = getPowerLevel()
  const isHoveredCard = isHovered === plan.id
  const isProfessional = plan.id === 'professional'
  
  // Hover cascade effect - tilt ONLY when Professional is hovered
  const getTilt = () => {
    if (!isHovered || isHoveredCard || isHovered !== 'professional') return 0
    // When Professional is hovered - Basic and Enterprise tilt towards it
    if (plan.id === 'basic') return -1.5 // Basic tilts left towards Professional
    if (plan.id === 'enterprise') return 1.5 // Enterprise tilts right towards Professional
    return 0
  }

  // Scale effect - hovered card scales up, others scale down slightly
  const getScale = () => {
    if (isHoveredCard) {
      // Hovered card scales up
      return isProfessional ? 1.08 : 1.05
    }
    if (isHovered && !isHoveredCard) {
      // Other cards scale down slightly when any card is hovered
      return 0.98
    }
    // Default scale
    return isProfessional ? 1.05 : 1
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        rotate: getTilt(),
        scale: getScale()
      }}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.15,
        rotate: { duration: 0.3, ease: 'easeOut' },
        scale: { duration: 0.3, ease: 'easeOut' }
      }}
      className={`h-full relative ${plan.featured ? 'lg:-mt-4 lg:mb-4' : ''}`}
      onMouseEnter={() => onHover(plan.id)}
      onMouseLeave={() => onHover(null)}
    >
      <PageCard
        hover
        className={`h-full flex flex-col transition-all duration-300 ${
          plan.featured
            ? 'ring-2 ring-[hsl(var(--primary))] shadow-lg'
            : ''
        } ${
          isHoveredCard 
            ? plan.featured 
              ? 'shadow-2xl ring-2 ring-[hsl(var(--primary))] ring-offset-2' 
              : 'shadow-xl ring-2 ring-[hsl(var(--muted))]'
            : ''
        }`}
      >
        {/* Icon progression - Power level indicator */}
        <motion.div 
          className="mb-4 flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.15 + 0.3 }}
        >
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: i < powerLevel ? 1 : 0.3,
                  opacity: i < powerLevel ? 1 : 0.3
                }}
                transition={{ 
                  delay: index * 0.15 + 0.4 + i * 0.05,
                  type: 'spring',
                  stiffness: 200,
                  damping: 10
                }}
                className={`w-2 h-2 rounded-full ${
                  i < powerLevel 
                    ? 'bg-[hsl(var(--primary))]' 
                    : 'bg-[hsl(var(--muted))]'
                }`}
              />
            ))}
          </div>
          {plan.id === 'professional' && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                delay: index * 0.15 + 0.7,
                type: 'spring',
                stiffness: 200
              }}
              className="ml-1"
            >
              <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
            </motion.div>
          )}
          {plan.id === 'enterprise' && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                delay: index * 0.15 + 0.7,
                type: 'spring',
                stiffness: 200
              }}
              className="ml-1"
            >
              <Crown className="w-4 h-4 text-[hsl(var(--primary))]" />
            </motion.div>
          )}
        </motion.div>

        {plan.featured && (
          <motion.div 
            className="mb-4"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              delay: index * 0.15 + 0.5,
              type: 'spring',
              stiffness: 200
            }}
          >
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[hsl(var(--primary))] text-white">
              Mest valgt
            </span>
          </motion.div>
        )}

        <div className="flex-1">
          <h3 className="text-2xl font-bold text-[hsl(var(--foreground))] mb-2">{plan.name}</h3>
          <p className="text-[hsl(var(--muted))] mb-6 text-sm">{plan.description}</p>

          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-[hsl(var(--foreground))]">
                {plan.monthlyPrice === 0 ? 'Pris efter aftale' : isYearly ? `${price} kr/år` : `${price} kr pr måned`}
              </span>
            </div>
            {monthlyEquivalent && (
              <p className="text-sm text-[hsl(var(--muted))] mt-1">{monthlyEquivalent}</p>
            )}
            {isYearly && plan.monthlyPrice > 0 && (
              <p className="text-xs text-[hsl(var(--success))] mt-1">Spar 10% ved årlig betaling</p>
            )}
          </div>

          <ul className="space-y-3 mb-8">
            {plan.features.map((feature, idx) => (
              <motion.li 
                key={idx} 
                className="flex items-start gap-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ 
                  delay: index * 0.15 + 0.5 + idx * 0.05,
                  type: 'spring',
                  stiffness: 300,
                  damping: 20
                }}
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ 
                    delay: index * 0.15 + 0.5 + idx * 0.05,
                    type: 'spring',
                    stiffness: 300,
                    damping: 10
                  }}
                >
                  <Check className="w-5 h-5 text-[hsl(var(--success))] flex-shrink-0 mt-0.5" />
                </motion.div>
                <span className="text-sm text-[hsl(var(--foreground))]">{feature}</span>
              </motion.li>
            ))}
            {plan.limitations && plan.limitations.length > 0 && (
              <>
                {plan.limitations.map((limitation, idx) => (
                  <li key={`lim-${idx}`} className="flex items-start gap-2">
                    <span className="w-5 h-5 flex-shrink-0 mt-0.5 text-[hsl(var(--muted))]">•</span>
                    <span className="text-sm text-[hsl(var(--muted))]">{limitation}</span>
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>

        <Button
          variant={plan.featured ? 'primary' : 'secondary'}
          size="md"
          className="w-full"
          onClick={() => {
            if (plan.monthlyPrice === 0) {
              // Enterprise - open contact form or email
              window.location.href = 'mailto:marc@rundeklar.dk?subject=Enterprise henvendelse'
            } else {
              // Navigate to signup with plan parameter
              const signupUrl = `/?plan=${plan.id}`
              window.location.href = signupUrl
            }
          }}
        >
          {plan.ctaText}
        </Button>
      </PageCard>
    </motion.div>
  )
}

/**
 * Pricing section component for marketing landing page.
 * Displays pricing plans with monthly/yearly toggle.
 */
export const PricingSection: React.FC = () => {
  const [isYearly, setIsYearly] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} id="pricing" className="py-20 sm:py-24 lg:py-32 bg-[hsl(var(--bg-canvas))]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-12 sm:mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--foreground))] mb-4 sm:mb-6">
            Enkle, gennemsigtige priser
          </h2>
          <p className="text-lg sm:text-xl text-[hsl(var(--muted))] max-w-2xl mx-auto mb-8">
            Vælg den pakke der passer til din klub. Ingen opstartsgebyrer og ingen skjulte omkostninger.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${!isYearly ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted))]'}`}>
              Månedlig
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                isYearly ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--surface-2))]'
              }`}
              aria-label="Skift mellem månedlig og årlig betaling"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  isYearly ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${isYearly ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted))]'}`}>
              Årlig (10 procent rabat)
            </span>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <PricingCard 
              key={plan.id} 
              plan={plan} 
              isYearly={isYearly} 
              index={index}
              isHovered={hoveredCard}
              onHover={setHoveredCard}
            />
          ))}
        </div>

        {/* Microcopy */}
        <motion.p
          className="text-center text-sm text-[hsl(var(--muted))] mt-8"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          Ingen binding. Opsig når som helst.
        </motion.p>
      </div>
    </section>
  )
}

