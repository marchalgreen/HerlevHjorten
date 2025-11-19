import React, { useEffect } from 'react'
import { HeroSection } from '../components/marketing/HeroSection'
import { FeaturesSection } from '../components/marketing/FeaturesSection'
import { InteractiveDemoSection } from '../components/marketing/InteractiveDemoSection'
import { PricingSection } from '../components/marketing/PricingSection'
import { TestimonialsSection } from '../components/marketing/TestimonialsSection'
import { FAQSection } from '../components/marketing/FAQSection'
import { MarketingFooter } from '../components/marketing/MarketingFooter'
import { trackPageView } from '../lib/analytics/track'

/**
 * Main marketing landing page component.
 * Displays all marketing sections with scroll animations.
 */
export default function MarketingLandingPage() {
  useEffect(() => {
    // Track page view for marketing site
    trackPageView('marketing')
  }, [])

  return (
    <div className="min-h-screen bg-[hsl(var(--bg-canvas))] overflow-x-hidden">
      <HeroSection />
      <FeaturesSection />
      <InteractiveDemoSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <MarketingFooter />
    </div>
  )
}

