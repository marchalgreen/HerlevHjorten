# E2E Tests with Playwright

Modern end-to-end test suite for Rundeklar using Playwright.

## Quick Start

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests in UI mode (interactive)
pnpm test:e2e:ui

# Run tests in headed mode (see browser)
pnpm test:e2e:headed

# Debug tests
pnpm test:e2e:debug

# Run specific test file
pnpm exec playwright test tests/e2e/auth.spec.ts
```

## Test Structure

### Test Files

- **auth.spec.ts** - Authentication flows (login, register, password/PIN reset)
- **landing.spec.ts** - Coach landing page (group selection, session start)
- **checkin.spec.ts** - Player check-in/out functionality
- **match-program.spec.ts** - Match program and auto-match functionality
- **players.spec.ts** - Player database and management
- **navigation.spec.ts** - Navigation and menu functionality
- **tenant.spec.ts** - Multi-tenant routing and branding

### Fixtures

- **fixtures.ts** - Custom fixtures and test helpers
  - `authenticatedPage` - Pre-authenticated page fixture
  - `tenantPage` - Page with tenant context loaded
  - `TestHelpers` - Utility class for common test operations

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from './fixtures'
import { TestHelpers } from './fixtures'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/route')
    await page.waitForLoadState('networkidle')
  })

  test('should do something', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    // Use semantic selectors
    const button = page.getByRole('button', { name: /text/i })
    await button.click()
    
    // Wait for changes
    await page.waitForLoadState('networkidle')
    
    // Assert
    await expect(page.getByText('expected text')).toBeVisible()
  })
})
```

### Using Test Helpers

```typescript
const helpers = new TestHelpers(page)

// Navigate
await helpers.navigateTo('check-in')

// Check if element exists (doesn't throw)
const exists = await helpers.elementExists(selector)

// Fill form field
await helpers.fillField(/email/i, 'test@example.com')

// Click button
await helpers.clickButton(/submit/i)

// Wait for API response
await helpers.waitForApiResponse(/api\/players/)
```

### Best Practices

1. **Use semantic selectors** - Prefer `getByRole`, `getByText`, `getByLabel`
2. **Wait for network idle** - Always wait after navigation
3. **Handle optional elements** - Use `elementExists()` for elements that may not be present
4. **Test user flows** - Test complete workflows, not just individual actions
5. **Keep tests independent** - Each test should work in isolation
6. **Use fixtures** - Leverage custom fixtures for common setup

## Test Data

Tests should work with existing database data. For tests that require specific data:

1. Use existing test data when possible
2. Create test data in `beforeEach` if needed
3. Clean up test data in `afterEach` if created

## CI/CD

Tests run automatically on:
- Push to `main` branch
- Pull requests

The CI workflow:
1. Installs dependencies
2. Installs Playwright browsers
3. Starts the dev server
4. Runs all E2E tests

## Debugging

### Run tests in debug mode
```bash
pnpm test:e2e:debug
```

### View test report
```bash
# After running tests
npx playwright show-report
```

### Screenshots and videos
Screenshots and videos are saved on failure in `test-results/` directory.

## Troubleshooting

### Tests fail locally
- Ensure dev server is running: `pnpm dev`
- Check that database credentials are configured
- Verify test data exists in database
- Check browser console for errors

### Tests fail in CI
- Check CI logs for specific error messages
- Verify environment variables are set
- Ensure Playwright browsers are installed
- Check that dev server starts successfully

### Flaky tests
- Add explicit waits for async operations
- Use `waitForLoadState('networkidle')` after navigation
- Avoid hardcoded timeouts when possible
- Use `waitFor` for elements that appear dynamically



