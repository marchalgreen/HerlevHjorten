# Application Architecture

## Overview

This application is a multi-tenant badminton training management system built with React, TypeScript, and Supabase. It follows a modular, layered architecture with clear separation of concerns.

## Architecture Layers

### 1. Presentation Layer (`src/routes/`, `src/components/`)

**Purpose**: User interface components and page-level routes.

**Structure**:
- `routes/` - Page-level components (CheckIn, PlayersDB, MatchProgram, Statistics)
- `components/ui/` - Reusable UI primitives (Button, Table, Badge, etc.)
- `components/navigation/` - Navigation-specific components

**Principles**:
- Components should be focused and single-purpose
- Extract complex logic into custom hooks
- Use composition over inheritance
- Keep components under 300 lines when possible

### 2. Business Logic Layer (`src/hooks/`, `src/services/`)

**Purpose**: Custom hooks and service functions that encapsulate business logic.

**Structure**:
- `hooks/` - Custom React hooks for data fetching, state management, and business logic
- `services/` - Pure business logic functions (matchmaking, validation, calculations)

**Principles**:
- Hooks handle component-specific state and side effects
- Services are pure functions (no side effects, easily testable)
- Business rules live here, not in components or API layer

### 3. API Layer (`src/api/`)

**Purpose**: Data access and external service integration.

**Structure**:
- `api/index.ts` - Main API client with domain-specific modules
- `api/supabase.ts` - Supabase client configuration
- `api/stats.ts` - Statistics-specific API functions
- `api/storage.ts` - Storage operations

**Principles**:
- All data access goes through this layer
- Handles data transformation (DB format ↔ Domain format)
- Provides consistent error handling
- No business logic in API layer

### 4. Data Access Layer (`src/lib/supabase.ts`)

**Purpose**: Low-level database operations and Supabase client management.

**Structure**:
- `lib/supabase.ts` - Supabase client creation and tenant management
- `lib/tenant.ts` - Tenant configuration and path utilities

**Principles**:
- Only database operations and client management
- No business logic
- Handles tenant isolation

### 5. Domain Layer (`@herlev-hjorten/common`)

**Purpose**: Shared types and domain models.

**Structure**:
- Type definitions for entities (Player, Match, Session, etc.)
- Shared constants and enums

**Principles**:
- Single source of truth for types
- No implementation details
- Shared across packages

## Data Flow

```
User Action
  ↓
Component (Presentation)
  ↓
Custom Hook (Business Logic)
  ↓
API Service (Data Access)
  ↓
Supabase Client (Database)
  ↓
Response flows back up
```

## Key Patterns

### 1. Custom Hooks Pattern

Extract component logic into reusable hooks:

```typescript
// ❌ Bad: Logic in component
const Component = () => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    // complex logic here
  }, [])
  // ...
}

// ✅ Good: Logic in hook
const usePlayers = () => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  // complex logic here
  return { data, loading, refetch }
}

const Component = () => {
  const { data, loading } = usePlayers()
  // ...
}
```

### 2. Service Layer Pattern

Pure business logic functions:

```typescript
// services/matchmaker.ts
export const createMatchAssignments = (
  players: Player[],
  courts: Court[]
): MatchAssignment[] => {
  // Pure function, easily testable
  // No side effects
}
```

### 3. Error Handling Pattern

**Best Practice: Use centralized error handling for user-facing errors. Use local error state only for UI-specific validation that doesn't need user notification.**

Centralized error handling:

```typescript
// lib/errors.ts
import { normalizeError } from '../lib/errors'
import { useToast } from '../components/ui/Toast'

// ❌ BAD: Local error handling
try {
  await api.players.update(...)
} catch (err) {
  const msg = err instanceof Error ? err.message : 'Error'
  console.error('Error:', err)
  notify({ variant: 'danger', title: 'Error', description: msg })
}

// ✅ GOOD: Centralized error handling (follow this pattern)
try {
  await api.players.update(...)
} catch (err) {
  const normalizedError = normalizeError(err)
  notify({
    variant: 'danger',
    title: 'Kunne ikke opdatere spiller',
    description: normalizedError.message
  })
}
```

**Pattern to follow:**
1. Import `normalizeError` from `src/lib/errors.ts`
2. Use `normalizeError(err)` in all catch blocks
3. Use `normalizedError.message` for user-facing messages
4. Never use `console.log` or `console.error` in production code
5. Follow the exact pattern used in `usePlayers`, `useSession`, `useCheckIns` hooks

**Reference implementations:**
- `src/hooks/usePlayers.ts` - See `createPlayer`, `updatePlayer` methods
- `src/hooks/useSession.ts` - See `startSession`, `endSession` methods
- `src/hooks/useCheckIns.ts` - See `checkIn`, `checkOut` methods

### 4. Type Safety Pattern

Strict typing throughout:

```typescript
// ❌ Bad
const handleSubmit = (data: any) => { }

// ✅ Good
interface PlayerFormData {
  name: string
  alias?: string
  levelSingle?: number
}

const handleSubmit = (data: PlayerFormData) => { }
```

## File Organization

### Component Structure

```
ComponentName/
  ├── ComponentName.tsx       # Main component
  ├── ComponentName.test.tsx  # Tests
  ├── useComponentName.ts     # Custom hook (if needed)
  ├── types.ts                # Component-specific types
  └── constants.ts            # Component-specific constants
```

### Service Structure

```
services/
  ├── players/
  │   ├── playerService.ts    # Player business logic
  │   ├── playerValidation.ts # Validation rules
  │   └── types.ts            # Service-specific types
  └── matches/
      ├── matchService.ts
      └── matchmaker.ts
```

## Testing Strategy

### Unit Tests
- Services: Pure functions, easy to test
- Hooks: Use `@testing-library/react-hooks`
- Utilities: Direct function calls

### Integration Tests
- API layer: Mock Supabase client
- Custom hooks: Test with real API mocks

### E2E Tests
- Critical user flows
- Use Playwright for browser automation

## Performance Considerations

1. **Memoization**: Use `useMemo` and `useCallback` for expensive computations
2. **Code Splitting**: Lazy load routes with `React.lazy`
3. **Virtualization**: Use `react-window` for long lists
4. **Debouncing**: Debounce search inputs and API calls

## Security Considerations

1. **Tenant Isolation**: All queries scoped to tenant
2. **Input Validation**: Validate all user inputs with Zod
3. **Error Messages**: Don't expose sensitive information in errors
4. **Type Safety**: Use TypeScript to prevent type-related vulnerabilities

## Documentation Standards

### JSDoc Comments

All exported functions, classes, and components should have JSDoc:

```typescript
/**
 * Creates a new player in the system.
 * 
 * @param input - Player creation data
 * @returns Created player with generated ID
 * @throws {AppError} If validation fails or player already exists
 * 
 * @example
 * ```typescript
 * const player = await createPlayer({
 *   name: 'John Doe',
 *   levelSingle: 5
 * })
 * ```
 */
export const createPlayer = async (input: PlayerCreateInput): Promise<Player> => {
  // implementation
}
```

### README Files

Each major module should have a README explaining:
- Purpose and responsibility
- Usage examples
- API reference
- Common patterns

## Migration Guide

When refactoring existing code:

1. **Identify boundaries**: Separate presentation, business logic, and data access
2. **Extract incrementally**: Move logic piece by piece, test after each change
3. **Maintain compatibility**: Keep existing APIs working during transition
4. **Update tests**: Add tests for new structure
5. **Document changes**: Update architecture docs and READMEs

## Future Improvements

1. **State Management**: Consider Zustand for complex global state
2. **Form Handling**: Standardize on react-hook-form + Zod
3. **API Client**: Consider tRPC for type-safe APIs
4. **Component Library**: Build a design system component library
5. **Storybook**: Add Storybook for component documentation

