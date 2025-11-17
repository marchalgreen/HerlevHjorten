# Vercel RESEND Setup Guide - PIN Koder

Denne guide hjælper dig med at løse problemer med at sende PIN-koder fra production via RESEND.

## Problem

PIN-koder sendes ikke fra production, fordi RESEND ikke er konfigureret korrekt i Vercel.

## Trin-for-trin Løsning

### Trin 1: Verificer RESEND API Key

1. **Gå til Resend Dashboard:**
   - https://resend.com/api-keys
   - Log ind med din Resend konto

2. **Tjek dine API Keys:**
   - Find din production API key (starter med `re_`)
   - Kopier den - du skal bruge den i næste trin
   - **VIGTIGT:** Hvis du ikke har en API key, opret en ny

### Trin 2: Tjek Vercel Environment Variables

1. **Gå til Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Vælg dit "Rundeklar" projekt

2. **Gå til Environment Variables:**
   - Settings → Environment Variables

3. **Tjek følgende variabler for Production:**
   
   ✅ **RESEND_API_KEY** (KRITISK)
   - Key: `RESEND_API_KEY`
   - Value: Din Resend API key (fra trin 1)
   - Environment: **Production** (vigtigt!)
   - Hvis den mangler eller er forkert, skal du opdatere den

   ✅ **RESEND_FROM_EMAIL**
   - Key: `RESEND_FROM_EMAIL`
   - Value: `onboarding@resend.dev` (eller dit verified domain)
   - Environment: **Production**

   ✅ **RESEND_FROM_NAME**
   - Key: `RESEND_FROM_NAME`
   - Value: `Herlev Hjorten` (eller dit foretrukne navn)
   - Environment: **Production**

   ✅ **APP_URL** (valgfri - bruges kun til at detektere protocol i development)
   - Key: `APP_URL`
   - Value: `https://rundeklar.dk` (bruges til at detektere om vi er i production)
   - Environment: **Production**
   - **Note:** Email links bygger nu automatisk subdomain URLs (fx `https://herlev-hjorten.rundeklar.dk/login`)

   ✅ **BASE_DOMAIN** (valgfri - default er `rundeklar.dk`)
   - Key: `BASE_DOMAIN`
   - Value: `rundeklar.dk` (base domain for subdomains)
   - Environment: **Production**
   - **Note:** Kun nødvendig hvis du bruger et andet base domain end `rundeklar.dk`

### Trin 3: Tilføj/Opdater Environment Variables

Hvis nogen variabler mangler eller er forkerte:

#### Option A: Via Vercel Dashboard (Anbefalet)

1. Klik "Add New" for hver manglende variabel
2. Indtast Key og Value
3. **VIGTIGT:** Vælg "Production" environment
4. Klik "Save"

#### Option B: Via Vercel CLI

```bash
# Installer Vercel CLI hvis ikke allerede installeret
npm i -g vercel

# Login til Vercel
vercel login

# Sæt RESEND_API_KEY
vercel env add RESEND_API_KEY production
# Når du bliver bedt om værdien, indtast din Resend API key

# Sæt RESEND_FROM_EMAIL
vercel env add RESEND_FROM_EMAIL production
# Indtast: onboarding@resend.dev (eller dit verified domain)

# Sæt RESEND_FROM_NAME
vercel env add RESEND_FROM_NAME production
# Indtast: Herlev Hjorten

# Sæt APP_URL (valgfri - bruges kun til at detektere protocol)
vercel env add APP_URL production
# Indtast: https://rundeklar.dk

# Sæt BASE_DOMAIN (valgfri - default er rundeklar.dk)
vercel env add BASE_DOMAIN production
# Indtast: rundeklar.dk
```

#### Option C: Via push-env.sh Script

Hvis du har en `.env` fil med alle variabler:

```bash
# Fra repository root
./push-env.sh production .env
```

**OBS:** Scriptet kræver at du har Vercel CLI installeret:
```bash
npm i -g vercel
```

### Trin 4: Redeploy Application

**KRITISK:** Efter at have tilføjet/opdateret environment variables skal du redeploy:

1. **Via Vercel Dashboard:**
   - Gå til "Deployments" tab
   - Find den seneste deployment
   - Klik på "..." menu → "Redeploy"
   - Vælg "Use existing Build Cache" = OFF (for at sikre nye env vars)
   - Klik "Redeploy"

2. **Via Git:**
   - Push en ny commit til `main` branch
   - Vercel deployer automatisk

### Trin 5: Verificer Setup

Efter redeploy:

1. **Tjek Vercel Logs:**
   - Gå til Vercel Dashboard → Functions
   - Find `/api/auth/reset-pin` eller `/api/[tenantId]/admin/coaches/[id]`
   - Klik på "Logs" tab
   - Prøv at sende en PIN reset email
   - Tjek om der er fejl i logs

2. **Test PIN Reset:**
   - Gå til din production app
   - Prøv at anmode om PIN reset
   - Tjek om emailen ankommer

3. **Tjek Email Logs i Resend:**
   - Gå til https://resend.com/emails
   - Se om emails bliver sendt
   - Tjek om der er fejl

## Troubleshooting

### "RESEND_API_KEY not set" i logs

- ✅ Tjek at variablen er sat i Vercel Dashboard
- ✅ Tjek at du har valgt "Production" environment
- ✅ Tjek at du har redeployed efter at have tilføjet variablen
- ✅ Tjek at variabelnavnet er præcist `RESEND_API_KEY` (case-sensitive)

### "Resend API error" i logs

- ✅ Tjek at din RESEND_API_KEY er gyldig (gå til Resend dashboard)
- ✅ Tjek at din Resend konto ikke er suspenderet
- ✅ Tjek Resend email logs for fejldetaljer
- ✅ Tjek at `RESEND_FROM_EMAIL` er et verified domain i Resend

### "Email sent successfully" men ingen email modtaget

- ✅ Tjek spam folder
- ✅ Tjek at email adressen er korrekt
- ✅ Tjek Resend email logs (https://resend.com/emails)
- ✅ Tjek at `RESEND_FROM_EMAIL` er verified i Resend

### Environment variable ikke tilgængelig efter redeploy

- ✅ Vær sikker på at du har valgt "Production" environment
- ✅ Vær sikker på at du har redeployed efter at have tilføjet variablen
- ✅ Prøv at redeploy med "Use existing Build Cache" = OFF
- ✅ Tjek at variabelnavnet er præcist korrekt (case-sensitive)

### Hvordan verificerer jeg at environment variables er sat?

1. Gå til Vercel Dashboard → Settings → Environment Variables
2. Filtrer efter "Production"
3. Tjek at følgende er til stede:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `RESEND_FROM_NAME`
   - `APP_URL`

### Hvordan tester jeg lokalt?

Opret `.env.local` i `packages/webapp/`:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_FROM_NAME=Herlev Hjorten
APP_URL=http://localhost:5173
```

Kør derefter:
```bash
cd packages/webapp
vercel dev
```

## Verificer Resend Domain Setup

Hvis du bruger `onboarding@resend.dev`:
- ✅ Dette er Resend's demo domain - det virker out-of-the-box
- ✅ Ingen yderligere setup nødvendig

Hvis du vil bruge dit eget domain:
1. Gå til Resend Dashboard → Domains
2. Tilføj dit domain
3. Følg DNS setup instruktioner
4. Verificer domain
5. Opdater `RESEND_FROM_EMAIL` til dit domain (fx `noreply@rundeklar.dk`)

## Checklist

Før du tester igen, tjek at:

- [ ] RESEND_API_KEY er sat i Vercel Production
- [ ] RESEND_FROM_EMAIL er sat i Vercel Production
- [ ] RESEND_FROM_NAME er sat i Vercel Production
- [ ] APP_URL er sat i Vercel Production
- [ ] Du har redeployed efter at have tilføjet variablerne
- [ ] Du har valgt "Production" environment (ikke Preview eller Development)
- [ ] Din Resend API key er gyldig og aktiv

## Næste Skridt

Efter at have løst problemet:

1. Test PIN reset flow i production
2. Test coach welcome email (når der oprettes en ny coach)
3. Overvej at tilføje Resend domain verification for bedre deliverability
4. Overvej at tilføje email templates i Resend for bedre branding

## Support

Hvis problemet fortsætter:

1. Tjek Vercel Function logs for fejlbeskeder
2. Tjek Resend dashboard for email status
3. Tjek at alle environment variables er korrekt sat
4. Overvej at kontakte Resend support hvis API key fejler

