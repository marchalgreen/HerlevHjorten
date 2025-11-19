import React from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { PageCard } from '../ui'
import { Quote } from 'lucide-react'

interface Testimonial {
  quote: string
  author: string
  role: string
  club?: string
}

const testimonials: Testimonial[] = [
  {
    quote: 'Før sad vi med pen og papir. Nu har vi overblik over baner, spillere og fremmøde på én skærm.',
    author: 'Morten Regaard',
    role: 'Træner, Herlev/Hjorten Badmintonklub'
  },
  {
    quote: 'Vi har fået meget bedre ro på træningsaftenerne. Spillerne tjekker selv ind, og vi kan sætte runderne på få minutter.',
    author: 'Kristian Simoni',
    role: 'Træner, Herlev/Hjorten Badmintonklub'
  }
]

/**
 * Testimonials section component for marketing landing page.
 * Displays customer testimonials in a grid format.
 */
export const TestimonialsSection: React.FC = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="relative py-20 sm:py-24 lg:py-32 bg-[hsl(var(--bg-canvas))] overflow-hidden">
      {/* Blurred background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}badminton3.jpg)`,
          filter: 'blur(8px)',
          transform: 'scale(1.05)',
        }}
      />
      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--bg-canvas)/.7)] via-[hsl(var(--bg-canvas)/.6)] to-[hsl(var(--bg-canvas)/.7)] z-0" />
      
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-12 sm:mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--foreground))] mb-4 sm:mb-6">
            Klubberne mærker forskellen
          </h2>
          <p className="text-lg sm:text-xl text-[hsl(var(--foreground))] max-w-2xl mx-auto opacity-90">
            Udviklet i tæt samarbejde med Herlev/Hjorten Badmintonklub. Her er hvad trænerne siger.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <PageCard hover className="h-full flex flex-col card-white-bg">
                  <Quote className="w-8 h-8 text-[hsl(var(--primary))] mb-4" />
                  <p className="text-[hsl(var(--foreground))] mb-6 leading-relaxed flex-1">
                    &quot;{testimonial.quote}&quot;
                  </p>
                  <div className="mt-auto">
                    <p className="font-semibold text-[hsl(var(--foreground))]">{testimonial.author}</p>
                    <p className="text-sm text-[hsl(var(--muted))]">{testimonial.role}</p>
                  </div>
                </PageCard>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-sm text-[hsl(var(--muted))] mt-6">
            Brugt i Herlev/Hjorten Badmintonklub
          </p>
        </div>
      </div>
    </section>
  )
}

