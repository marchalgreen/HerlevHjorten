# Vercel Environment Variables Setup

## Problem
Login fejler i production med fejl: `AUTH_JWT_SECRET environment variable is required`

## Løsning: Sæt Environment Variables i Vercel

### Option 1: Via Vercel Dashboard (Anbefalet)

1. **Gå til Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Vælg dit "Rundeklar" projekt

2. **Gå til Environment Variables:**
   - Settings → Environment Variables

3. **Tilføj følgende variabler for Production:**

   **AUTH_JWT_SECRET** (KRITISK - kræves for login):
   ```bash
   # Generer først en secret lokalt:
   openssl rand -base64 32
   ```
   - Kopier outputtet
   - Klik "Add New"
   - Key: `AUTH_JWT_SECRET`
   - Value: (indsæt den genererede secret)
   - Vælg "Production" environment
   - Klik "Save"

   **DATABASE_URL** (hvis ikke allerede sat):
   - Key: `DATABASE_URL`
   - Value: Din Neon database connection string
   - Vælg "Production" environment

   **RESEND_API_KEY** (hvis ikke allerede sat):
   - Key: `RESEND_API_KEY`
   - Value: Din Resend API key (fra https://resend.com/api-keys)

   **RESEND_FROM_EMAIL** (hvis ikke allerede sat):
   - Key: `RESEND_FROM_EMAIL`
   - Value: `onboarding@resend.dev` (eller dit verified domain)

   **RESEND_FROM_NAME** (hvis ikke allerede sat):
   - Key: `RESEND_FROM_NAME`
   - Value: `Herlev Hjorten` (eller dit foretrukne navn)

   **APP_URL** (hvis ikke allerede sat):
   - Key: `APP_URL`
   - Value: `https://herlev-hjorten.rundeklar.dk` (eller dit production domain)

4. **Redeploy:**
   - Gå til "Deployments" tab
   - Find den seneste deployment
   - Klik på "..." menu → "Redeploy"
   - Eller push en ny commit til `main` branch

### Option 2: Via push-env.sh Script

Hvis du har en `.env` fil med alle variabler:

```bash
# Fra repository root
./push-env.sh production .env
```

**OBS:** Scriptet kræver at du har Vercel CLI installeret:
```bash
npm i -g vercel
```

### Option 3: Via Vercel CLI

```bash
# Installer Vercel CLI hvis ikke allerede installeret
npm i -g vercel

# Login til Vercel
vercel login

# Sæt environment variable
vercel env add AUTH_JWT_SECRET production

# Når du bliver bedt om værdien, indtast den genererede secret:
# (Generer først: openssl rand -base64 32)
```

## Verificer Setup

Efter at have sat environment variables:

1. **Redeploy application:**
   - Vercel Dashboard → Deployments → Redeploy seneste deployment
   - Eller push en ny commit

2. **Test login:**
   - Gå til https://herlev-hjorten.rundeklar.dk
   - Prøv at logge ind som admin eller coach
   - Tjek Vercel logs hvis der stadig er fejl

3. **Tjek logs:**
   - Vercel Dashboard → Functions → `/api/auth/login` → Logs
   - Der skulle ikke længere være "AUTH_JWT_SECRET environment variable is required"

## Troubleshooting

### "Environment variable not found after redeploy"
- Vær sikker på at du har valgt "Production" environment
- Vær sikker på at du har redeployed efter at have tilføjet variablen
- Tjek at variabelnavnet er præcist `AUTH_JWT_SECRET` (case-sensitive)

### "Still getting error after setting variable"
- Tjek at du har redeployed
- Tjek Vercel logs for at se om variablen er tilgængelig
- Prøv at tilføje variablen også til "Preview" og "Development" environments

### "How do I generate a new JWT secret?"
```bash
openssl rand -base64 32
```
**VIGTIGT:** Hvis du genererer en ny secret, skal alle eksisterende sessions invalideres. Brugere skal logge ind igen.



