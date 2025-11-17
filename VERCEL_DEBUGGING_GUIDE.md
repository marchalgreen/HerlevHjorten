# Vercel Production Debugging Guide

## Problem
Login fejler i production med 500 fejl og "Unexpected token 'A'" (HTML error page), men virker i dev.

## Root Cause Analysis - Vi skal først identificere den faktiske fejl

### Step 1: Tjek Vercel Runtime Logs (KRITISK)

1. Gå til Vercel Dashboard → Dit projekt
2. Klik på "Functions" tab
3. Find `/api/auth/login` function
4. Klik på den og se "Logs" tab
5. Prøv at logge ind igen og se fejlbeskederne

**Hvad vi leder efter:**
- "Cannot find module '@node-rs/argon2'"
- "Module not found"
- "Dynamic import failed"
- "Error loading module"
- Eller en specifik stack trace

### Step 2: Test API direkte

```bash
# Test med curl for at se den faktiske response
curl -X POST https://herlev-hjorten.rundeklar.dk/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "herlev-hjorten",
    "username": "coach1",
    "pin": "123456"
  }' -v
```

**Hvad vi leder efter:**
- HTTP status code
- Content-Type header (JSON eller HTML?)
- Faktisk response body

### Step 3: Identificer Root Cause

Baseret på logs, kan det være:

#### Scenario A: @node-rs/argon2 kan ikke loades
**Symptom:** "Cannot find module" eller "Module not found" for @node-rs/argon2
**Løsning:** 
- Overvej at erstatte med pure JS argon2 (argon2-browser eller lignende)
- Eller sikre at native dependencies er korrekt installeret i Vercel

#### Scenario B: Import path fejler
**Symptom:** "Cannot find module '../../src/lib/auth/pin'"
**Løsning:**
- Tjek at filer er inkluderet i build
- Tjek at paths er korrekte i production

#### Scenario C: Database connection fejler
**Symptom:** Database connection errors
**Løsning:**
- Tjek DATABASE_URL environment variable i Vercel
- Tjek at database er tilgængelig

#### Scenario D: Anden runtime fejl
**Symptom:** Specifik fejl i logs
**Løsning:**
- Fix den specifikke fejl

## Nuværende Løsning (Dynamic Imports)

**Hvad vi har gjort:**
- Refaktoreret til dynamic imports
- Sat JSON headers først
- Tilføjet error handling

**Hvorfor det MÅSKE virker:**
- Dynamic imports køres runtime, så fejl kan fanges
- Headers sættes først, så vi returnerer JSON

**Hvorfor det MÅSKE IKKE virker:**
- Hvis modulet ikke kan loades, vil dynamic import stadig fejle
- Vi returnerer bare en bedre fejlbesked, men login virker stadig ikke
- Vi har stadig ikke løst root cause

## Anbefalet Approach

### Option 1: Se logs først (ANBEFALET)
1. Tjek Vercel runtime logs
2. Identificer den faktiske fejl
3. Fix den specifikke fejl
4. Test igen

### Option 2: Erstat @node-rs/argon2 med pure JS
Hvis logs viser at @node-rs/argon2 er problemet:
1. Installer `argon2-browser` eller lignende pure JS implementation
2. Opdater `pin.ts` og `password.ts` til at bruge den nye library
3. Test i dev og prod

### Option 3: Fallback til password-only login
Hvis PIN login ikke kan virke:
1. Tillad coaches at bruge email/password i stedet
2. Eller implementer en workaround

## Næste Skridt

1. **FØRST:** Tjek Vercel runtime logs og del fejlbeskederne
2. **DEREFTER:** Fix den specifikke fejl baseret på logs
3. **TEST:** Verificer at login virker i production

## Hvis Dynamic Imports Ikke Virker

Vi kan overveje:
- Erstatte @node-rs/argon2 med pure JS argon2
- Eller bruge bcrypt i stedet (mere kompatibel med serverless)
- Eller implementere en fallback authentication metode

