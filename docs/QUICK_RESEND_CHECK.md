# Quick RESEND Check - Verificer Setup

## Hurtig Checklist

### 1. Tjek Vercel Environment Variables

Gå til: https://vercel.com/dashboard → Dit projekt → Settings → Environment Variables

**Tjek at disse er sat for Production:**
- ✅ `RESEND_API_KEY` - Skal starte med `re_`
- ✅ `RESEND_FROM_EMAIL` - Skal være `onboarding@resend.dev` eller dit verified domain
- ✅ `RESEND_FROM_NAME` - Skal være `Herlev Hjorten` eller dit navn
- ✅ `APP_URL` - Skal være dit production domain

### 2. Verificer Resend API Key

1. Gå til: https://resend.com/api-keys
2. Tjek at din API key er aktiv
3. Kopier den og sammenlign med hvad der er sat i Vercel

### 3. Test Lokalt (Valgfrit)

Opret `packages/webapp/.env.local`:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_FROM_NAME=Herlev Hjorten
APP_URL=http://localhost:5173
```

Kør:
```bash
cd packages/webapp
vercel dev
```

Prøv at sende en PIN reset email lokalt.

### 4. Tjek Vercel Logs

Efter at have redeployed:

1. Gå til Vercel Dashboard → Functions
2. Find `/api/auth/reset-pin` eller `/api/[tenantId]/admin/coaches/[id]`
3. Klik "Logs"
4. Prøv at sende en PIN reset email
5. Tjek logs for fejl

**Forventet succes log:**
```
PIN reset email sent successfully to [email]
```

**Hvis fejl:**
```
RESEND_API_KEY not set - email functionality will be disabled
```
eller
```
Resend API error: [error message]
```

### 5. Tjek Resend Email Logs

1. Gå til: https://resend.com/emails
2. Se om emails bliver sendt
3. Tjek status (delivered, bounced, etc.)

## Hvis Alt Fejler

1. **Redeploy med cache disabled:**
   - Vercel Dashboard → Deployments → Seneste deployment → "..." → Redeploy
   - Vælg "Use existing Build Cache" = OFF

2. **Tjek at alle variabler er sat for Production (ikke Preview):**
   - Vercel Dashboard → Settings → Environment Variables
   - Filtrer efter "Production"

3. **Verificer Resend konto:**
   - Tjek at din Resend konto ikke er suspenderet
   - Tjek at du har credits tilbage

4. **Kontakt support:**
   - Se `docs/VERCEL_RESEND_SETUP.md` for detaljerede instruktioner

