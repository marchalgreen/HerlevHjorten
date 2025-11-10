# Error Handling Guide

## ⚠️ CRITICAL: Always Use Centralized Error Handling

**Never create local error handling solutions. Always use the centralized error handling system.**

## Quick Reference

### ✅ Correct Pattern

```typescript
import { normalizeError } from '../lib/errors'
import { useToast } from '../components/ui/Toast'

const MyComponent = () => {
  const { notify } = useToast()

  const handleAction = async () => {
    try {
      await api.someAction()
      notify({
        variant: 'success',
        title: 'Success',
        description: 'Action completed successfully'
      })
    } catch (err) {
      const normalizedError = normalizeError(err)
      notify({
        variant: 'danger',
        title: 'Kunne ikke udføre handling',
        description: normalizedError.message
      })
    }
  }
}
```

### ❌ Wrong Patterns (DO NOT USE)

```typescript
// ❌ BAD: Manual error extraction
catch (err) {
  const msg = err instanceof Error ? err.message : 'Error'
  notify({ variant: 'danger', title: 'Error', description: msg })
}

// ❌ BAD: Console logging
catch (err) {
  console.error('Error:', err)
  notify({ variant: 'danger', title: 'Error' })
}

// ❌ BAD: Local error handling
catch (err) {
  if (err instanceof SomeError) {
    // custom handling
  } else {
    // other handling
  }
}
```

## Reference Implementations

Always check these files before writing error handling:

1. **`src/hooks/usePlayers.ts`** - Player operations
2. **`src/hooks/useSession.ts`** - Session operations
3. **`src/hooks/useCheckIns.ts`** - Check-in operations
4. **`src/api/index.ts`** - API layer error handling

## Steps Before Writing Error Handling

1. ✅ Check if `normalizeError` is imported from `src/lib/errors.ts`
2. ✅ Use `normalizeError(err)` in catch blocks
3. ✅ Use `normalizedError.message` for user messages
4. ✅ Never use `console.log` or `console.error`
5. ✅ Follow the pattern from existing hooks/components

## Centralized Error System

The error handling system provides:

- **`normalizeError(err)`** - Converts any error to `AppError`
- **`AppError`** - Base error class with user-friendly messages
- **Error types** - `PlayerError`, `SessionError`, `ValidationError`, `DatabaseError`, `NetworkError`
- **Error codes** - Consistent error codes for programmatic handling

All errors are normalized and provide consistent, user-friendly messages.

## Examples from Codebase

### Hook Pattern (usePlayers.ts)

```typescript
const createPlayer = useCallback(async (input: PlayerCreateInput): Promise<Player | null> => {
  setError(null)
  
  try {
    const created = await api.players.create(input)
    await loadPlayers()
    notify({
      variant: 'success',
      title: 'Spiller oprettet',
      description: `${created.name} er nu tilføjet`
    })
    return created
  } catch (err) {
    const normalizedError = normalizeError(err)
    setError(normalizedError.message)
    notify({
      variant: 'danger',
      title: 'Kunne ikke oprette spiller',
      description: normalizedError.message
    })
    return null
  }
}, [loadPlayers, notify])
```

### Component Pattern (EditablePartnerCell.tsx)

```typescript
const performPartnerUpdate = useCallback(
  async (selectedId: string | null) => {
    try {
      // ... operation
      notify({
        variant: 'success',
        title: 'Makker opdateret'
      })
    } catch (err: unknown) {
      const normalizedError = normalizeError(err)
      notify({
        variant: 'danger',
        title: 'Kunne ikke opdatere makker',
        description: normalizedError.message
      })
    }
  },
  [player.id, partnerType, onUpdate, notify]
)
```

## Checklist

Before committing code with error handling:

- [ ] Imported `normalizeError` from `src/lib/errors.ts`
- [ ] Used `normalizeError(err)` in all catch blocks
- [ ] Used `normalizedError.message` for user messages
- [ ] No `console.log` or `console.error` statements
- [ ] Followed the pattern from existing hooks/components
- [ ] Checked for existing utilities before creating new ones

