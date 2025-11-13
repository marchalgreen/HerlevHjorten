# E2E Tests with Playwright

This directory contains end-to-end tests for the HerlevHjorten webapp using Playwright.

## Running Tests

### Run all tests
```bash
pnpm test:e2e
```

### Run tests in UI mode (interactive)
```bash
pnpm test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
pnpm test:e2e:headed
```

### Debug tests
```bash
pnpm test:e2e:debug
```

### Run specific test file
```bash
pnpm exec playwright test tests/e2e/landing-page.spec.ts
```

## Test Structure

- `landing-page.spec.ts` - Tests for the coach landing page (group selection, session start)
- `check-in.spec.ts` - Tests for player check-in functionality
- `match-program.spec.ts` - Tests for match program page and auto-matching
- `navigation.spec.ts` - Tests for navigation between pages
- `tenant-routing.spec.ts` - Tests for multi-tenant routing and branding

## Writing New Tests

1. Create a new `.spec.ts` file in `tests/e2e/`
2. Use Playwright's test API:
   ```typescript
   import { test, expect } from '@playwright/test'
   
   test('my test', async ({ page }) => {
     await page.goto('/#/coach')
     await expect(page.getByRole('heading')).toBeVisible()
   })
   ```

## Best Practices

- Use semantic selectors (`getByRole`, `getByText`, `getByLabel`) when possible
- Add `data-testid` attributes to components for stable selectors
- Use `page.waitForTimeout()` sparingly - prefer `waitFor` or `toBeVisible()`
- Group related tests in `test.describe()` blocks
- Use `test.beforeEach()` for common setup

## CI Integration

Tests run automatically on:
- Push to `main` branch
- Pull requests

The CI workflow will:
1. Install dependencies
2. Install Playwright browsers
3. Start the dev server
4. Run all E2E tests

