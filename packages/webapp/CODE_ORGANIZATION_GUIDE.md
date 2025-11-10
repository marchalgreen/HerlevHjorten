# Code Organization & Best Practices Guide

> **See also:** [Responsive Design Guide](./RESPONSIVE_DESIGN_GUIDE.md) for mobile-first UI patterns

## Core Principles

### 1. Architectural Thinking First

**Before writing any code, ask yourself:**

1. **Where should this code live?**
   - Component? (`src/components/`)
   - Hook? (`src/hooks/`)
   - Service/Utility? (`src/lib/` or `src/services/`)
   - API layer? (`src/api/`)
   - Constants? (`src/constants/`)

2. **Is this logic reusable?**
   - If yes → Extract to hook/service/utility
   - If no → Keep in component if it's UI-specific

3. **What's the separation of concerns?**
   - **UI/Presentation** → Components
   - **Business Logic** → Hooks/Services
   - **Data Access** → API layer
   - **Pure Functions** → Services/Utilities

4. **Should this be a new file?**
   - New feature/concern → New file
   - Extension of existing → Add to existing file
   - Related functionality → Consider grouping

## Code Organization Patterns

### Component Structure

```typescript
// ✅ GOOD: Component focuses on UI, delegates logic to hooks
import { usePlayers } from '../hooks'

const PlayersPage = () => {
  const { players, loading, error, createPlayer, updatePlayer } = usePlayers()
  
  // UI rendering only
  return <div>...</div>
}

// ❌ BAD: Component contains business logic
const PlayersPage = () => {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    // Complex data fetching logic here
    // This should be in a hook!
  }, [])
  
  return <div>...</div>
}
```

### Hook Pattern

```typescript
// ✅ GOOD: Hook encapsulates data fetching and business logic
export const usePlayers = (filters?: PlayerListFilters) => {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { notify } = useToast()

  const loadPlayers = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await api.players.list(filters)
      setPlayers(result)
    } catch (err) {
      const normalizedError = normalizeError(err)
      setError(normalizedError.message)
      notify({
        variant: 'danger',
        title: 'Kunne ikke hente spillere',
        description: normalizedError.message
      })
    } finally {
      setLoading(false)
    }
  }, [filters?.q, filters?.active, notify])

  // ... more methods

  return { players, loading, error, createPlayer, updatePlayer, refetch: loadPlayers }
}
```

### Service/Utility Pattern

```typescript
// ✅ GOOD: Pure function, easily testable, reusable
// src/lib/matchmaker.ts
export const createMatchAssignments = (
  players: Player[],
  courts: Court[]
): MatchAssignment[] => {
  // Pure business logic
  // No side effects
  // Easy to test
}

// ❌ BAD: Business logic in component
const Component = () => {
  const createMatches = () => {
    // Complex business logic here
    // This should be in a service!
  }
}
```

## When to Extract Code

### Extract to Hook When:
- ✅ Data fetching logic
- ✅ State management that's reusable
- ✅ Complex component logic that could be reused
- ✅ Side effects (API calls, subscriptions)

### Extract to Service/Utility When:
- ✅ Pure functions (no side effects)
- ✅ Business logic calculations
- ✅ Data transformations
- ✅ Validation logic
- ✅ Formatting functions

### Extract to Component When:
- ✅ Reusable UI pieces
- ✅ Complex UI that's used in multiple places
- ✅ UI with its own state (but keep business logic in hooks)

### Keep in Component When:
- ✅ UI-specific state (e.g., `isOpen`, `isEditing`)
- ✅ Event handlers that are purely UI-related
- ✅ Rendering logic

## Error Handling Best Practices

### When to Use Centralized Error Handling

**Always use for user-facing errors:**

```typescript
import { normalizeError } from '../lib/errors'
import { useToast } from '../components/ui/Toast'

const MyComponent = () => {
  const { notify } = useToast()

  const handleAction = async () => {
    try {
      await api.someAction()
      notify({ variant: 'success', title: 'Success' })
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

### When Local Error Handling is Appropriate

**Only for component-specific state that doesn't need user notification:**

```typescript
// ✅ OK: Local error state for UI-specific handling
const [validationError, setValidationError] = useState<string | null>(null)

const handleSubmit = () => {
  if (!formData.name) {
    setValidationError('Navn er påkrævet')
    return
  }
  // ... submit logic
}
```

**But still use centralized for API errors:**

```typescript
// ✅ GOOD: Mix of local validation + centralized API errors
const [validationError, setValidationError] = useState<string | null>(null)
const { notify } = useToast()

const handleSubmit = async () => {
  // Local validation
  if (!formData.name) {
    setValidationError('Navn er påkrævet')
    return
  }

  try {
    await api.players.create(formData)
    notify({ variant: 'success', title: 'Spiller oprettet' })
  } catch (err) {
    const normalizedError = normalizeError(err)
    notify({
      variant: 'danger',
      title: 'Kunne ikke oprette spiller',
      description: normalizedError.message
    })
  }
}
```

## Decision Tree: Where Should This Code Live?

```
Is it UI rendering?
├─ Yes → Component (src/components/)
└─ No
   ├─ Is it data fetching or state management?
   │  ├─ Yes → Hook (src/hooks/)
   │  └─ No
   │     ├─ Is it a pure function (no side effects)?
   │     │  ├─ Yes → Service/Utility (src/lib/ or src/services/)
   │     │  └─ No
   │     │     ├─ Is it API/data access?
   │     │     │  ├─ Yes → API layer (src/api/)
   │     │     │  └─ No → Review: might need refactoring
   │     │     └─ Is it a constant?
   │     │        ├─ Yes → Constants (src/constants/)
   │     │        └─ No → Review architecture
```

## Examples from Codebase

### ✅ Good Examples

**Component with hook:**
- `src/routes/PlayersDB.tsx` → Uses `usePlayers` hook
- `src/routes/CheckIn.tsx` → Uses `useCheckIns` hook

**Hook with API:**
- `src/hooks/usePlayers.ts` → Uses `api.players`
- `src/hooks/useSession.ts` → Uses `api.session`

**Service/Utility:**
- `src/lib/matchmaker.ts` → Pure business logic
- `src/lib/formatting.ts` → Pure formatting functions

### ❌ Anti-Patterns to Avoid

**Monolithic component:**
```typescript
// ❌ BAD: Everything in one component
const Component = () => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    // Complex data fetching
    // Business logic
    // Error handling
    // All mixed together
  }, [])
  
  const complexBusinessLogic = () => {
    // Should be in a service
  }
  
  return <div>...</div>
}
```

**Business logic in component:**
```typescript
// ❌ BAD: Business logic in component
const Component = () => {
  const calculateMatches = (players, courts) => {
    // Complex algorithm here
    // Should be in src/lib/matchmaker.ts
  }
}
```

## Checklist Before Writing Code

- [ ] **Where should this code live?** (component, hook, service, API?)
- [ ] **Is similar code already implemented?** (check existing files)
- [ ] **Is this reusable?** (extract if yes)
- [ ] **What's the separation of concerns?** (UI vs logic vs data)
- [ ] **Should this be a new file?** (if new concern/feature)
- [ ] **What pattern do similar features use?** (review existing code)
- [ ] **Is error handling using centralized system?** (for user-facing errors)
- [ ] **Are constants centralized?** (check `src/constants/`)
- [ ] **Are utilities being reused?** (check `src/lib/`)

## When User Suggests Changes

**Think architecturally:**

1. **Analyze the suggestion**: What functionality is being requested?
2. **Find similar patterns**: How is similar functionality implemented?
3. **Propose structure**: Where should the code live?
4. **Consider extraction**: Should this be extracted to a hook/service?
5. **Ask if unclear**: If architecture is unclear, propose options

**Example:**

User: "Add validation to the player form"

**Good response:**
- Check if validation utilities exist (`src/lib/validation.ts`)
- Check if form validation pattern exists in other forms
- Propose: Use existing validation utilities or create new ones if needed
- Suggest: Add validation logic to the form component or extract to a hook if complex

**Bad response:**
- Just add validation inline without checking existing patterns
- Don't consider if validation logic should be reusable

