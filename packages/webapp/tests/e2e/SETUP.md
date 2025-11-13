# Playwright E2E Testing Setup

## Overview

Automated end-to-end testing has been set up using Playwright to ensure stability before production deployments.

## Test Coverage

### Current Test Suites

1. **Landing Page** (`landing-page.spec.ts`)
   - Welcome header display
   - Group card rendering
   - Start session button enabling
   - Navigation to check-in page
   - Courts control display

2. **Check-In Page** (`check-in.spec.ts`)
   - Check-in interface display
   - Player search functionality
   - Empty state handling
   - Letter filters display

3. **Match Program** (`match-program.spec.ts`)
   - Match program interface
   - Bench section display
   - Auto-match button
   - Courts display
   - No active session message

4. **Navigation** (`navigation.spec.ts`)
   - Navigation between all main pages
   - Logo link to landing page
   - Active navigation state

5. **Tenant Routing** (`tenant-routing.spec.ts`)
   - Default tenant loading
   - RundeManager tenant loading
   - Tenant context maintenance

## Running Tests

### Local Development

```bash
# Run all tests
cd packages/webapp
pnpm test:e2e

# Run tests in UI mode (interactive)
pnpm test:e2e:ui

# Run tests in headed mode (see browser)
pnpm test:e2e:headed

# Debug tests
pnpm test:e2e:debug

# Run specific test file
pnpm exec playwright test tests/e2e/landing-page.spec.ts

# Run tests for specific browser
pnpm exec playwright test --project=chromium
```

### CI/CD

Tests run automatically on:
- Push to `main` branch
- Pull requests

The CI workflow:
1. Installs dependencies
2. Installs Playwright browsers
3. Starts the dev server
4. Runs all E2E tests

## Test Configuration

- **Base URL**: `http://127.0.0.1:5173`
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Retries**: 2 retries on CI, 0 locally
- **Screenshots**: On failure only
- **Videos**: Retained on failure
- **Traces**: On first retry

## Adding New Tests

1. Create a new `.spec.ts` file in `tests/e2e/`
2. Use Playwright's semantic selectors (`getByRole`, `getByText`, etc.)
3. Add `data-testid` attributes to components for stable selectors
4. Group related tests in `test.describe()` blocks
5. Use `test.beforeEach()` for common setup

Example:
```typescript
import { test, expect } from '@playwright/test'

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/my-route')
    await page.waitForLoadState('networkidle')
  })

  test('should do something', async ({ page }) => {
    await expect(page.getByRole('heading')).toBeVisible()
  })
})
```

## Best Practices

- Use semantic selectors when possible
- Wait for `networkidle` state after navigation
- Use `toBeVisible()` instead of `waitForTimeout()` when possible
- Handle optional elements gracefully (use `.isVisible().catch(() => false)`)
- Test both success and error states
- Keep tests independent and isolated

## Troubleshooting

### Tests fail locally
- Ensure dev server is running: `pnpm dev`
- Check that Supabase credentials are configured
- Verify test data exists in database

### Tests fail in CI
- Check CI logs for specific error messages
- Verify environment variables are set
- Ensure Playwright browsers are installed

### Flaky tests
- Add explicit waits for async operations
- Use `waitForLoadState('networkidle')` after navigation
- Avoid hardcoded timeouts when possible

