import React from 'react'
import { useTenant } from '../../contexts/TenantContext'
import { useNavigation } from '../../contexts/NavigationContext'
import { Button } from '../ui'
import { Mail, LogIn } from 'lucide-react'

/**
 * Marketing footer component.
 * Displays logo, navigation links, and contact information.
 */
export const MarketingFooter: React.FC = () => {
  const { config } = useTenant()
  const { navigateToAuth } = useNavigation()
  const logoPath = `${import.meta.env.BASE_URL}${config.logo}`

  return (
    <footer className="bg-[hsl(var(--bg-gradient-2))] border-t border-[hsl(var(--line)/.12)] py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
          {/* Logo & Description */}
          <div>
            <img
              src={logoPath}
              alt={config.name}
              className="h-10 sm:h-12 mb-4 object-contain"
            />
            <p className="text-sm text-[hsl(var(--muted))] leading-relaxed">
              Din badmintonklubs digitale hjerteskud. Rundeklar forenkler træningsadministration med moderne teknologi.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Hurtige links</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="#features"
                  className="text-sm text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  Funktioner
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="text-sm text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  Priser
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  className="text-sm text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  FAQ
                </a>
              </li>
              <li>
                <a
                  href="https://demo.rundeklar.dk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  Prøv demo
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Kontakt</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:marchalgreen@gmail.com"
                  className="flex items-center gap-2 text-sm text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Kontakt os
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-[hsl(var(--line)/.12)]">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <p className="text-xs text-[hsl(var(--muted))]">
              © {new Date().getFullYear()} Rundeklar. Alle rettigheder forbeholdes.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigateToAuth('login')}
              className="flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Log ind
            </Button>
          </div>
        </div>
      </div>
    </footer>
  )
}

