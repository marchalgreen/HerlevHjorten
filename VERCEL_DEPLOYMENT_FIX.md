# Vercel Deployment Fix - Dokumentation

## Problembeskrivelse

### Symptom
Vercel deployment fejlede konstant med fejlen:
```
Error: No Output Directory named "dist" found after the Build completed.
```

### Root Cause
Problemet var **ikke** i koden eller `vercel.json`, men i Vercels **Production Override** indstillinger:

- **Production Override** (låst, ikke redigerbar):
  - Root Directory: `packages/webapp`
  - Output Directory: `dist` (relativ til root directory)
  
- **Vores faktiske build output**:
  - Vite bygger til `packages/webapp/dist` (relativ til repo root)
  
- **Konflikt**: Vercel ledte efter `packages/webapp/dist` (root directory + output directory), men buildet skrev til `packages/webapp/dist` relativ til repo root, hvilket faktisk er det samme sted, men Vercel's override system forventede output i `dist` relativ til `packages/webapp`.

**Vigtigt**: Production Overrides kan ikke fjernes eller redigeres i UI'et - de er "stuck" i Vercels backend og vinder altid over `vercel.json` og Project Settings.

## Løsning Implementeret (Hack)

### Hvad vi gjorde

1. **Opdateret root `package.json` build script**:
   ```json
   "build": "pnpm --filter common build && pnpm --filter webapp build && mkdir -p dist && cp -R packages/webapp/dist/* dist/"
   ```
   
   Dette sikrer at efter et succesfuldt build:
   - `common` bygges først
   - `webapp` bygges (output til `packages/webapp/dist` som normalt)
   - En `dist/` mappe oprettes i repo root
   - Alt fra `packages/webapp/dist` kopieres til root `dist/`

2. **Opdateret `vercel.json`**:
   ```json
   {
     "outputDirectory": "dist"
   }
   ```
   
   Dette matcher nu Production Override's forventning.

### Hvorfor det virker

- Build processen er uændret - Vite bygger stadig til `packages/webapp/dist`
- Efter build kopierer vi output til root `dist/` hvor Vercel leder
- Vercel finder nu output directory korrekt
- Lokale builds virker stadig (samme output + ekstra kopi-step)

### Trade-offs

**Pros:**
- ✅ Deployment virker nu
- ✅ Ingen ændringer til Vite config eller build process
- ✅ GitHub workflows og scripts der forventer `packages/webapp/dist` virker stadig
- ✅ Minimal invasiv løsning

**Cons:**
- ⚠️ Ekstra kopi-step i build (minimal overhead)
- ⚠️ Opretter `dist/` mappe i repo root (skal i `.gitignore`)
- ⚠️ Hacky løsning - ikke den "rene" tilgang

## Anbefalinger Fremadrettet

### Option A: Nyt Clean Vercel Projekt (Anbefalet)

**Hvornår**: Når du har tid og en kollega til at hjælpe med oprettelse

**Hvorfor**:
- ✅ Ingen Production Overrides fra start
- ✅ Ren konfiguration der matcher monorepo struktur
- ✅ Bedre langtidsvedligeholdelse
- ✅ Følger Vercel best practices for monorepos

**Hvordan**:
1. Opret nyt Vercel projekt fra samme GitHub repo
2. Under oprettelse, konfigurer:
   - **Root Directory**: `packages/webapp`
   - **Framework**: Vite
   - **Build Command**: `cd ../.. && pnpm build` (eller `pnpm --filter common build && pnpm --filter webapp build`)
   - **Output Directory**: `dist` (relativ til root directory)
3. Fjern hacket fra `package.json` (gå tilbage til original build script)
4. Opdater `vercel.json` til at matche den nye struktur
5. Test deployment
6. Når det virker, slet det gamle Vercel projekt

**Konfiguration for nyt projekt**:
```json
// vercel.json
{
  "buildCommand": "cd ../.. && pnpm build",
  "outputDirectory": "dist",
  "installCommand": "cd ../.. && pnpm install",
  "framework": "vite"
}
```

### Option B: Behold Hacket (Nuværende Løsning)

**Hvornår**: Hvis Option A ikke er mulig lige nu

**Hvorfor**:
- ✅ Virker nu og er stabil
- ✅ Ingen umiddelbar risiko
- ✅ Kan vente til der er tid til Option A

**Hvad skal gøres**:
- ✅ Tilføj `dist/` til `.gitignore` (hvis ikke allerede der)
- ✅ Dokumenter hacket i README eller lignende
- ✅ Planlæg Option A når muligt

## Tekniske Detaljer

### Build Flow

**Før hack**:
```
pnpm build
  → common build → packages/common/dist
  → webapp build → packages/webapp/dist
  → Vercel leder efter dist/ (findes ikke) ❌
```

**Efter hack**:
```
pnpm build
  → common build → packages/common/dist
  → webapp build → packages/webapp/dist
  → kopier packages/webapp/dist/* → dist/
  → Vercel leder efter dist/ (findes nu) ✅
```

### Filer Ændret

1. **`package.json`** (root):
   - Build script udvidet med kopi-step

2. **`vercel.json`**:
   - `outputDirectory` ændret fra `packages/webapp/dist` til `dist`

### `.gitignore` Check

Sørg for at `dist/` er i `.gitignore` i repo root:
```
dist/
```

## Konklusion

Vi har løst det umiddelbare problem med et kontrolleret hack der kopierer build output til hvor Vercel forventer det. Dette er en stabil løsning der kan bruges indtil der er tid til at oprette et nyt clean Vercel projekt uden Production Overrides.

**Status**: ✅ Deployment virker
**Næste skridt**: Planlæg Option A når muligt

