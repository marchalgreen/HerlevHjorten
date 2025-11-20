import React, { useState, useEffect } from 'react'
import { PageCard } from '../../components/ui'
import { Button } from '../../components/ui'
import { Mail, Send, Eye, Clock, CheckCircle2, XCircle, Trash2 } from 'lucide-react'

interface EmailHistory {
  id: string
  email: string
  clubName: string
  presidentName: string
  sentAt: string
  status: 'sent' | 'failed'
  resendId?: string
}

export default function ColdCallEmailsPage() {
  const [clubName, setClubName] = useState('')
  const [presidentName, setPresidentName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [emailHistory, setEmailHistory] = useState<EmailHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchEmailHistory()
  }, [])

  const fetchEmailHistory = async () => {
    try {
      setLoadingHistory(true)
      setError(null) // Clear previous errors
      const token = localStorage.getItem('auth_access_token')
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/admin/cold-call-emails'
        : '/api/admin/cold-call-emails'
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      // Clone response to check content type without consuming the body
      const contentType = response.headers.get('content-type')
      const isJson = contentType?.includes('application/json')

      if (!response.ok) {
        if (isJson) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch email history')
        } else {
          // Response is HTML (404 page, etc.)
          throw new Error(`API endpoint not found (${response.status}). Please ensure the API server is running on port 3000.`)
        }
      }

      if (!isJson) {
        throw new Error('API returned non-JSON response. Please check that the API server is running.')
      }

      const data = await response.json()
      setEmailHistory(data.history || [])
    } catch (err) {
      console.error('Failed to fetch email history:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch email history'
      setError(`Kunne ikke hente email historik: ${errorMessage}`)
      setEmailHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handlePreview = () => {
    if (!clubName || !presidentName || !email) {
      setError('Udfyld alle felter for at se forhåndsvisning')
      return
    }
    setShowPreview(true)
    setError(null)
  }

  const handleSend = async () => {
    if (!clubName || !presidentName || !email) {
      setError('Udfyld alle felter')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Ugyldig email-adresse')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const token = localStorage.getItem('auth_access_token')
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/admin/cold-call-emails'
        : '/api/admin/cold-call-emails'
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          clubName,
          presidentName
        })
      })

      // Check content type before parsing
      const contentType = response.headers.get('content-type')
      const isJson = contentType?.includes('application/json')

      if (!response.ok) {
        if (isJson) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Kunne ikke sende email')
        } else {
          // Response is HTML (404 page, etc.)
          throw new Error(`API endpoint not found (${response.status}). Please ensure the API server is running on port 3000.`)
        }
      }

      if (!isJson) {
        throw new Error('API returned non-JSON response. Please check that the API server is running.')
      }

      const data = await response.json()
      
      if (data.warning) {
        setSuccess(`Email sendt til ${email} (${data.warning})`)
      } else {
        setSuccess(`Email sendt til ${email}`)
      }
      
      setClubName('')
      setPresidentName('')
      setEmail('')
      setShowPreview(false)
      
      // Refresh history
      await fetchEmailHistory()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunne ikke sende email'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Er du sikker på at du vil slette denne email fra historikken?')) {
      return
    }

    try {
      setDeletingIds(prev => new Set(prev).add(id))
      const token = localStorage.getItem('auth_access_token')
      const apiUrl = import.meta.env.DEV 
        ? `http://127.0.0.1:3000/api/admin/cold-call-emails/${id}`
        : `/api/admin/cold-call-emails/${id}`
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        const isJson = contentType?.includes('application/json')
        
        if (isJson) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Kunne ikke slette email')
        } else {
          throw new Error(`Kunne ikke slette email (${response.status})`)
        }
      }

      // Remove from local state
      setEmailHistory(prev => prev.filter(item => item.id !== id))
      setSuccess('Email slettet fra historikken')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunne ikke slette email'
      setError(errorMessage)
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Send Email Form */}
      <PageCard>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-2">
              Send Cold-Call Email
            </h2>
            <p className="text-sm text-[hsl(var(--muted))]">
              Udfyld formularen nedenfor for at sende en personlig cold-call email til en klubformand.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-[hsl(var(--destructive)/.1)] border border-[hsl(var(--destructive)/.2)] flex items-start gap-3">
              <XCircle className="w-5 h-5 text-[hsl(var(--destructive))] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-lg bg-[hsl(var(--success)/.1)] border border-[hsl(var(--success)/.2)] flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[hsl(var(--success))]">{success}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                Klubnavn *
              </span>
              <input
                type="text"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="fx. Herlev Badmintonklub"
                className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none text-[hsl(var(--foreground))] transition-all"
                disabled={loading}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                Formandsnavn *
              </span>
              <input
                type="text"
                value={presidentName}
                onChange={(e) => setPresidentName(e.target.value)}
                placeholder="fx. Lars Nielsen"
                className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none text-[hsl(var(--foreground))] transition-all"
                disabled={loading}
              />
            </label>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">
              Email-adresse *
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="formand@klub.dk"
              className="rounded-md bg-[hsl(var(--surface))] px-3 py-2 ring-1 ring-[hsl(var(--line)/.14)] focus:ring-2 focus:ring-[hsl(var(--ring))] outline-none text-[hsl(var(--foreground))] transition-all"
              disabled={loading}
            />
          </label>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handlePreview}
              disabled={loading || !clubName || !presidentName || !email}
              className="flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Forhåndsvis email
            </Button>
            <Button
              variant="primary"
              onClick={handleSend}
              loading={loading}
              disabled={!clubName || !presidentName || !email}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send email
            </Button>
          </div>

          {showPreview && (
            <div className="mt-6 rounded-lg bg-[hsl(var(--surface-2))] border border-[hsl(var(--line)/.12)] overflow-hidden">
              <div className="p-4 border-b border-[hsl(var(--line)/.12)] flex items-center justify-between bg-[hsl(var(--surface))]">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                  Email Forhåndsvisning
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  Luk
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="text-sm space-y-2">
                  <p className="text-[hsl(var(--muted))]">
                    <span className="font-medium text-[hsl(var(--foreground))]">Til:</span> {email}
                  </p>
                  <p className="text-[hsl(var(--muted))]">
                    <span className="font-medium text-[hsl(var(--foreground))]">Emne:</span> Vi gjorde vores træningsaftener lettere. Måske kan det også hjælpe i {clubName}?
                  </p>
                </div>
                <div className="pt-4 border-t border-[hsl(var(--line)/.12)]">
                  <div className="bg-white rounded-lg p-6 border border-[hsl(var(--line)/.12)] max-w-2xl">
                    <div className="prose prose-sm max-w-none" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      <p style={{ margin: '0 0 20px 0', fontSize: '16px', lineHeight: '1.6', color: '#495057' }}>
                        Hej {presidentName.trim().split(/\s+/)[0] || presidentName}
                      </p>
                      <p style={{ margin: '0 0 20px 0', fontSize: '16px', lineHeight: '1.6', color: '#495057' }}>
                        Jeg håber alt er godt hos jer. Mit navn er Marc, og jeg spiller selv i Herlev/Hjorten Badminton. De sidste par måneder har jeg brugt en del tid sammen med vores trænere på at løse en udfordring, som jeg tror mange klubber kender: de travle aftener hvor man både skal tage imod spillere, holde overblik og samtidig få runderne sat hurtigt og fair.
                      </p>
                      <p style={{ margin: '0 0 20px 0', fontSize: '16px', lineHeight: '1.6', color: '#495057' }}>
                        Vi endte med at bygge et lille værktøj for at hjælpe os selv, og det voksede sig siden større. I dag hedder det Rundeklar, og vi bruger det fast i Herlev/Hjorten.
                      </p>
                      <p style={{ margin: '0 0 24px 0', fontSize: '16px', lineHeight: '1.6', color: '#495057' }}>
                        Rundeklar er lavet for at give jer overblik og ro på de travle aftener, så energien kan bruges på træningen i stedet for administration.
                      </p>
                      <ul style={{ margin: '0 0 24px 0', paddingLeft: '24px', fontSize: '16px', lineHeight: '1.8', color: '#495057' }}>
                        <li style={{ marginBottom: '12px' }}>Spillere tjekker selv ind på få sekunder</li>
                        <li style={{ marginBottom: '12px' }}>Runderne sættes enten automatisk eller med et enkelt klik og et intuitivt drag og drop</li>
                        <li style={{ marginBottom: '12px' }}>Træneren får mere ro og mere tid på gulvet</li>
                      </ul>
                      <div style={{ margin: '32px 0', padding: '20px', backgroundColor: '#f8f9fa', borderLeft: '4px solid #007bff', borderRadius: '4px' }}>
                        <p style={{ margin: '0 0 12px 0', fontSize: '16px', lineHeight: '1.6', color: '#495057', fontStyle: 'italic' }}>
                          Før var det pen og papir og en masse råben på tværs af hallen. Nu ligger indtjekning, runder og overblik stille og roligt på én skærm. Det har gjort alt arbejdet omkring runder langt lettere og frigivet tid og ro til selve træningen.
                        </p>
                        <p style={{ margin: '0', fontSize: '14px', lineHeight: '1.6', color: '#6c757d', fontWeight: '600' }}>
                          — Morten Regaard, cheftræner, Herlev/Hjorten Badmintonklub
                        </p>
                      </div>
                      <p style={{ margin: '32px 0 20px 0', fontSize: '16px', lineHeight: '1.6', color: '#495057' }}>
                        Hvis I er nysgerrige, kan I prøve det direkte på <a href="https://demo.rundeklar.dk" style={{ color: '#007bff', textDecoration: 'none', fontWeight: '600' }}>demo.rundeklar.dk</a>.
                      </p>
                      <p style={{ margin: '0 0 32px 0', fontSize: '16px', lineHeight: '1.6', color: '#495057' }}>
                        Og hvis I vil mærke det i jeres egen klub, kan I oprette en gratis prøveperiode. Det tager få minutter og kræver ingen binding.
                      </p>
                      <div style={{ textAlign: 'center', margin: '32px 0' }}>
                        <a href="https://rundeklar.dk" style={{ display: 'inline-block', padding: '14px 32px', backgroundColor: '#007bff', color: '#ffffff', textDecoration: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '16px' }}>
                          Start her
                        </a>
                      </div>
                      <p style={{ margin: '16px 0 0 0', fontSize: '14px', lineHeight: '1.6', color: '#6c757d', textAlign: 'center' }}>
                        Direkte link: <a href="https://rundeklar.dk" style={{ color: '#007bff', textDecoration: 'none', wordBreak: 'break-all' }}>https://rundeklar.dk</a>
                      </p>
                      <p style={{ margin: '32px 0 20px 0', fontSize: '16px', lineHeight: '1.6', color: '#495057' }}>
                        Jeg viser det også gerne på et hurtigt opkald, hvis det er nemmere. Ti minutter er som regel nok til at gennemgå det vigtigste.
                      </p>
                      <p style={{ margin: '0 0 32px 0', fontSize: '16px', lineHeight: '1.6', color: '#495057' }}>
                        Hvad tænker I? Er det bedst at prøve selv, eller giver en hurtig gennemgang mest mening?
                      </p>
                      <p style={{ margin: '32px 0 0 0', fontSize: '16px', lineHeight: '1.6', color: '#495057' }}>
                        Bedste hilsner<br />
                        <strong style={{ color: '#212529' }}>Marc Halgreen</strong><br />
                        <span style={{ fontSize: '14px', color: '#6c757d' }}>Rundeklar</span>
                      </p>
                      <p style={{ margin: '24px 0 0 0', fontSize: '14px', lineHeight: '1.6', color: '#6c757d' }}>
                        <a href="mailto:marc@rundeklar.dk" style={{ color: '#007bff', textDecoration: 'none' }}>marc@rundeklar.dk</a><br />
                        +45 53 69 69 52
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageCard>

      {/* Email History */}
      <PageCard>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
              Sendte Emails
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchEmailHistory}
              disabled={loadingHistory}
            >
              Opdater
            </Button>
          </div>

          {loadingHistory ? (
            <div className="text-center py-8 text-[hsl(var(--muted))]">
              Indlæser historik...
            </div>
          ) : emailHistory.length === 0 ? (
            <div className="text-center py-8 text-[hsl(var(--muted))]">
              Ingen emails sendt endnu
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[hsl(var(--line)/.12)]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[hsl(var(--foreground))]">
                      Dato
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[hsl(var(--foreground))]">
                      Klub
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[hsl(var(--foreground))]">
                      Formand
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[hsl(var(--foreground))]">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[hsl(var(--foreground))]">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[hsl(var(--foreground))]">
                      Handling
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {emailHistory.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[hsl(var(--line)/.08)] hover:bg-[hsl(var(--surface-2)/.5)] transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-[hsl(var(--foreground))]">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[hsl(var(--muted))]" />
                          {formatDate(item.sentAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-[hsl(var(--foreground))]">
                        {item.clubName}
                      </td>
                      <td className="py-3 px-4 text-sm text-[hsl(var(--foreground))]">
                        {item.presidentName}
                      </td>
                      <td className="py-3 px-4 text-sm text-[hsl(var(--foreground))]">
                        <a
                          href={`mailto:${item.email}`}
                          className="text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                        >
                          <Mail className="w-3 h-3" />
                          {item.email}
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        {item.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[hsl(var(--success)/.1)] text-[hsl(var(--success))]">
                            <CheckCircle2 className="w-3 h-3" />
                            Sendt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]">
                            <XCircle className="w-3 h-3" />
                            Fejlet
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingIds.has(item.id)}
                          className="p-2 rounded-md text-[hsl(var(--muted))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Slet email fra historikken"
                        >
                          {deletingIds.has(item.id) ? (
                            <Clock className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageCard>
    </div>
  )
}

