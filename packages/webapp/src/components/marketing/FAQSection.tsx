import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { PageCard } from '../ui'
import { ChevronDown } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

const faqs: FAQItem[] = [
  {
    question: 'Hvordan kommer vi i gang?',
    answer: 'I kan starte med at prøve vores gratis demo på demo.rundeklar.dk. Når det føles rigtigt, hjælper vi jer med at sætte klubbens rigtige data op og komme sikkert i gang.'
  },
  {
    question: 'Kan vi prøve produktet før vi køber?',
    answer: 'Ja. I får adgang til en fuld demo, hvor I kan afprøve alle funktioner uden at oprette betalingsoplysninger. Vi tilbyder også en personlig gennemgang hvis I ønsker det.'
  },
  {
    question: 'Hvad sker der med vores data?',
    answer: 'Vi følger GDPR reglerne og gemmer data sikkert. I kan til enhver tid få data udleveret eller få den slettet, hvis I ønsker at stoppe.'
  },
  {
    question: 'Kan vi ændre pakke senere?',
    answer: 'Ja. I kan altid opgradere eller nedgradere mellem pakker. Ændringen træder i kraft fra næste faktureringsperiode.'
  },
  {
    question: 'Hvad hvis vi har brug for hjælp?',
    answer: 'Alle kunder har adgang til email support. På Professionel og Enterprise giver vi prioriteret support og kan aftale fast kontaktperson.'
  },
  {
    question: 'Understøtter I flere klubber eller afdelinger?',
    answer: 'Ja. Enterprise pakken er egnet til flere klubber, forbund eller større organisationer. Kontakt os, så finder vi en løsning der passer.'
  }
]

/**
 * FAQ accordion item component.
 */
const FAQItem: React.FC<{ faq: FAQItem; index: number }> = ({ faq, index }) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <PageCard hover className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] flex-1 text-left">
            {faq.question}
          </h3>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0"
          >
            <ChevronDown className="w-5 h-5 text-[hsl(var(--muted))]" />
          </motion.div>
        </div>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <p className="text-[hsl(var(--muted))] mt-4 leading-relaxed">
                {faq.answer}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </PageCard>
    </motion.div>
  )
}

/**
 * FAQ section component for marketing landing page.
 * Displays frequently asked questions in an accordion format.
 */
export const FAQSection: React.FC = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} id="faq" className="relative py-20 sm:py-24 lg:py-32 bg-[hsl(var(--bg-canvas))] overflow-hidden">
      {/* Blurred background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}padel2.jpg)`,
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
            Ofte stillede spørgsmål
          </h2>
          <p className="text-lg sm:text-xl text-[hsl(var(--muted))] max-w-2xl mx-auto">
            Har du spørgsmål, så har vi svarene.
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <FAQItem key={index} faq={faq} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

