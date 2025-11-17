# Fix Admin Menu Not Showing

## Problem
Admin menu vises ikke selvom du har `super_admin` rolle i databasen.

## Løsning

### Step 1: Genstart API Serveren

API serveren skal genstartes for at indlæse de nye ændringer i `/api/auth/me.ts`.

**Hvis du kører `pnpm dev:api` i en separat terminal:**
1. Stop serveren (Ctrl+C)
2. Start den igen: `pnpm dev:api`

**Hvis du kører `pnpm dev` (som starter både frontend og API):**
1. Stop serveren (Ctrl+C)
2. Start den igen: `pnpm dev`

### Step 2: Log Ud og Ind Igen

Efter API serveren er genstartet:

1. **Log ud:**
   - Klik på din email i højre hjørne
   - Klik "Log ud"

2. **Log ind igen:**
   - Log ind med samme credentials
   - Dette opdaterer JWT tokenet med den nye rolle

### Step 3: Tjek Debug Output

Efter login, tjek debug output (gul boks øverst på siden):

```json
{
  "club": {
    "role": "super_admin"  // ← Dette skal være med nu!
  },
  "isAdmin": true,         // ← Skal være true
  "isSuperAdmin": true     // ← Skal være true
}
```

### Step 4: Verificer Admin Menu

Hvis debug output viser korrekt rolle, skulle Admin menu nu vise i navigationen.

## Hvis Det Stadig Ikke Virker

### Tjek Browser Console

1. Åbn browser console (F12)
2. Tjek Network tab
3. Find `/api/auth/me` request
4. Se response - skal indeholde `role: "super_admin"`

### Manuelt Opdater Token

Hvis logout/login ikke virker:

1. Åbn browser console (F12)
2. Kør:
```javascript
localStorage.removeItem('auth_access_token')
localStorage.removeItem('auth_refresh_token')
location.reload()
```

### Tjek Database

Verificer at din rolle er korrekt i databasen:

```sql
SELECT email, role, tenant_id 
FROM clubs 
WHERE email = 'marchalgreen@gmail.com';
```

Skal vise `role = 'super_admin'`.

## Debug Komponent

Jeg har tilføjet en debug komponent der viser role information. Den vises øverst på siden når du er logget ind. Brug den til at verificere at rolle er korrekt indlæst.

## Fjern Debug Komponent (Efter Test)

Når alt virker, kan du fjerne debug komponenten:

1. Fjern import i `App.tsx`:
   ```typescript
   import { RoleDebug } from './components/debug/RoleDebug'
   ```

2. Fjern komponenten:
   ```typescript
   {!isAuthRoute && <RoleDebug />}
   ```

3. Slet filen: `packages/webapp/src/components/debug/RoleDebug.tsx`

