# Domain og Tenant Setup Guide

## Oversigt

Denne guide beskriver hvordan domænerne `rundeklar.dk` og `demo.rundeklar.dk` er konfigureret til at bruge henholdsvis `default` og `demo` tenants.

## Tenant Mapping

| Domæne | Tenant ID | Database | Formål |
|--------|-----------|----------|--------|
| `rundeklar.dk` | `default` | Production DB | Produktions applikation (Herlev/Hjorten) |
| `demo.rundeklar.dk` | `demo` | Demo DB | Demo applikation med dummy data |

## Tenant Detection Logik

Tenant detection sker automatisk baseret på hostname i `packages/webapp/src/lib/tenant.ts`:

- **`rundeklar.dk`** → `default` tenant
- **`www.rundeklar.dk`** → `default` tenant  
- **`demo.rundeklar.dk`** → `demo` tenant
- Andre domæner med `demo.` prefix → `demo` tenant

## Konfiguration

### 1. Tenant Config Filer

Tenant konfigurationer findes i `packages/webapp/src/config/tenants/`:

- **`default.json`** - Production tenant konfiguration
- **`demo.json`** - Demo tenant konfiguration

Hver config fil skal indeholde:
```json
{
  "id": "tenant-id",
  "name": "TENANT NAME",
  "logo": "logo-fil.png",
  "maxCourts": 8,
  "postgresUrl": "postgresql://...", // eller sæt DATABASE_URL env var
  "features": {}
}
```

### 2. Database Setup

**Vigtigt:** Hver tenant skal have sin egen database!

#### Production Tenant (`default`)
- Database: Production Neon/Supabase database
- Data: Live produktionsdata (spillere, sessioner, etc.)

#### Demo Tenant (`demo`)
- Database: Separat demo Neon/Supabase database
- Data: Dummy data til demonstration

## Seeding Demo Data

For at sikre at `demo.rundeklar.dk` har realistisk dummy data, skal du køre følgende scripts:

### 0. Ryd eksisterende data (valgfrit)

Hvis du vil starte forfra med ren data:

```bash
cd packages/webapp
pnpm exec tsx scripts/clear-all-data.ts demo
```

Dette vil slette ALT data for demo tenant (spillere, sessioner, matches, check-ins, statistik, baner).

### 1. Seed Demo Spillere og Sessioner

**Vigtigt:** Sørg for at `DATABASE_URL` er sat i `.env.local` før du kører scriptet.

```bash
# Fra packages/webapp directory (anbefalet)
cd packages/webapp
pnpm exec tsx scripts/seed-demo-data.ts demo
```

Scriptet vil automatisk:
- Lade environment variables fra `.env.local` (søger i `packages/webapp/.env.local` eller root `.env.local`)
- Bruge `DATABASE_URL` eller `VITE_DATABASE_URL` fra environment
- Oprette dummy data for demo tenant

Dette script opretter realistisk demo data:
- 5 baner (baseret på `maxCourts` i `demo.json`)
- 88 spillere fordelt på 3 træningsgrupper:
  - **Senior A**: 40 spillere
  - **U17**: 22 spillere
  - **U15**: 26 spillere
- Realistiske danske navne
- Køn bestemt ud fra fornavn (dansk standard)
- **Ingen rangliste point** - alle levels er null
- Tilfældig primary category (Single/Double/Begge)
- 14 træningssessioner (sidste 14 dage, én aktiv session i dag)
- Realistiske check-ins: 60-75% af aktive spillere checker ind

### 2. Seed Demo Statistik

```bash
# Fra root directory - Generer historisk statistik data
pnpm exec tsx packages/webapp/scripts/generate-dummy-statistics.ts demo
```

**Bemærk:** Dette script kræver mindst 8 aktive spillere i demo databasen (så kør først seed-demo-data.ts).

Dette script genererer:
- ~144 historiske sessioner (sidste 18 måneder)
- Realistiske matches og check-ins
- Statistics snapshots for hver session

## Verificering

### Tjek Tenant Detection

1. Åbn `rundeklar.dk` i browseren
2. Åbn Developer Console (F12)
3. Kør: `window.location.hostname` - skal vise `rundeklar.dk`
4. Tjek at applikationen viser "HERLEV/HJORTEN" i header

5. Åbn `demo.rundeklar.dk` i browseren
6. Tjek at applikationen viser "DEMO" i header
7. Verificer at der er dummy data (spillere, sessioner, statistik)

### Tjek Database Isolation

1. Log ind på `rundeklar.dk` og tjek antal spillere
2. Log ind på `demo.rundeklar.dk` og tjek antal spillere
3. De skal være forskellige (demo skal have 25 spillere hvis seedet korrekt)

## Troubleshooting

### Demo tenant loader ikke korrekt

1. **Tjek hostname detection:**
   - Åbn browser console på `demo.rundeklar.dk`
   - Kør: `window.location.hostname.toLowerCase()`
   - Skal være `demo.rundeklar.dk`

2. **Tjek tenant config:**
   - Verificer at `packages/webapp/src/config/tenants/demo.json` eksisterer
   - Tjek at `id` feltet er `"demo"`

3. **Tjek build:**
   - Efter build skal config filer være i `packages/webapp/dist/config/tenants/`
   - Verificer at demo.json er kopieret korrekt

### Forkert database forbindelse

1. **Tjek environment variables:**
   - I Vercel: Settings → Environment Variables
   - `DATABASE_URL` skal pege på den korrekte database for hver deployment

2. **Tjek tenant config:**
   - Hvis `postgresUrl` ikke er sat i config, bruges `DATABASE_URL` env var
   - Verificer at den rigtige database URL er sat

### Demo data mangler eller skal opdateres

1. **Ryd eksisterende data (hvis nødvendigt):**
   ```bash
   cd packages/webapp
   pnpm exec tsx scripts/clear-all-data.ts demo
   ```

2. **Tjek at DATABASE_URL er sat:**
   ```bash
   # Verificer at .env.local eksisterer og indeholder DATABASE_URL
   cat packages/webapp/.env.local | grep DATABASE_URL
   ```

3. **Seed spillere og sessioner:**
   ```bash
   cd packages/webapp
   pnpm exec tsx scripts/seed-demo-data.ts demo
   ```

4. **Seed statistik (valgfrit, men anbefalet):**
   ```bash
   # Fra packages/webapp directory
   pnpm exec tsx scripts/generate-dummy-statistics.ts demo
   ```

5. **Verificer i database:**
   - Tjek at `players` tabellen har 88 rækker med `tenant_id = 'demo'`
   - Tjek at `players` har 40 spillere i Senior A, 22 i U17, og 26 i U15
   - Tjek at alle spillere har `level_single`, `level_double`, og `level_mix` sat til NULL
   - Tjek at `training_sessions` har 14 sessioner med `tenant_id = 'demo'`
   - Tjek at `check_ins` har check-ins for den aktive session
   - Tjek at `statistics_snapshots` har snapshots med `tenant_id = 'demo'` (hvis statistik er seedet)

## Vercel Deployment

### Production Deployment (`rundeklar.dk`)

- **Project:** Rundeklar production
- **Domain:** `rundeklar.dk`
- **Environment Variables:**
  - `DATABASE_URL` → Production database URL
- **Tenant:** `default`

### Demo Deployment (`demo.rundeklar.dk`)

- **Project:** Rundeklar demo (eller samme project med andet domain)
- **Domain:** `demo.rundeklar.dk`
- **Environment Variables:**
  - `DATABASE_URL` → Demo database URL
- **Tenant:** `demo`

**Bemærk:** Hvis du bruger samme Vercel project for begge domæner, skal `DATABASE_URL` være sat til demo databasen, og tenant detection vil automatisk vælge den rigtige tenant baseret på hostname.

## Opdateringer

Hvis du ændrer tenant detection logikken, husk at:
1. Opdatere `packages/webapp/src/lib/tenant.ts`
2. Teste lokalt med forskellige hostnames
3. Rebuild og redeploy til Vercel
4. Verificere at begge domæner fungerer korrekt

