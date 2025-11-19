# E2E Test Suite - Complete Reboot

## Overview

Complete rebuild of Playwright E2E tests with modern best practices, fixtures, and comprehensive coverage of all UI functionality.

## Test Files

### 1. **fixtures.ts** - Test Infrastructure
- Custom fixtures (`authenticatedPage`, `tenantPage`)
- `TestHelpers` utility class for common operations
- Reusable test utilities

### 2. **auth.spec.ts** - Authentication Flows
- Login page display and validation
- Registration with password strength
- Password reset flow
- PIN reset flow
- Invalid credentials handling

### 3. **landing.spec.ts** - Coach Landing Page
- Welcome header display
- Group cards rendering
- Group selection
- Start session button enabling
- Courts control adjustment
- Navigation to check-in after session start
- Cross-group search functionality

### 4. **checkin.spec.ts** - Check-In Page
- Check-in interface display
- Empty state when no active session
- Player search functionality
- Letter filtering
- Check-in/check-out actions
- Checked-in players count display

### 5. **match-program.spec.ts** - Match Program / Rounds
- Match program interface
- Bench section with players
- Courts display
- Auto-match functionality
- Manual player assignment
- Round information display
- Empty state handling

### 6. **players.spec.ts** - Players Database
- Players page display
- Players list/table rendering
- Search functionality
- Status filtering
- Player details display
- Create/edit player functionality
- Statistics display
- Pagination

### 7. **navigation.spec.ts** - Navigation
- Navigation between all pages
- Active navigation state
- Mobile menu functionality
- Logo/home link
- Menu close on outside click

### 8. **statistics.spec.ts** - Statistics Page
- Statistics page display
- Charts/tables rendering
- Date range filtering
- Player statistics
- Match statistics
- Export functionality

### 9. **admin.spec.ts** - Admin Page
- Authentication requirement
- Admin interface display
- Tenant management
- User/coach management
- Create tenant functionality

### 10. **tenant.spec.ts** - Tenant Routing
- Default tenant loading
- Tenant-specific branding
- Tenant context maintenance
- Tenant-specific routes

## Test Statistics

- **Total Test Files**: 10
- **Total Tests**: ~60+ tests across all browsers/devices
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile**: Mobile Chrome, Mobile Safari
- **Coverage**: All major UI flows and functionality

## Modern Features

### Custom Fixtures
- `authenticatedPage` - Pre-authenticated page for testing protected routes
- `tenantPage` - Page with tenant context loaded

### Test Helpers
- `navigateTo()` - Navigate to routes
- `waitForVisible()` - Wait for elements with retry
- `elementExists()` - Safe element existence check
- `fillField()` - Fill form fields safely
- `clickButton()` - Click buttons with navigation wait
- `waitForApiResponse()` - Wait for API calls
- `getText()` - Get text content safely
- `isOnRoute()` - Check current route

### Best Practices
- ✅ Semantic selectors (`getByRole`, `getByText`, `getByLabel`)
- ✅ Graceful handling of optional elements
- ✅ Proper waiting for network idle
- ✅ Mobile-responsive testing
- ✅ Cross-browser testing
- ✅ Error state testing
- ✅ Empty state testing

## Configuration

### Playwright Config (`playwright.config.ts`)
- Modern configuration with all browsers enabled
- Mobile device testing
- Proper timeouts and retries
- HTML and JSON reporting
- Automatic dev server management

### Test Structure
- Organized by feature/page
- Descriptive test names
- Proper setup/teardown
- Independent tests

## Running Tests

```bash
# Run all tests
pnpm test:e2e

# Run in UI mode (interactive)
pnpm test:e2e:ui

# Run in headed mode (see browser)
pnpm test:e2e:headed

# Debug tests
pnpm test:e2e:debug

# Run specific test file
pnpm exec playwright test tests/e2e/auth.spec.ts

# Run specific browser
pnpm exec playwright test --project=chromium
```

## Next Steps

1. **Add data-testid attributes** - Add stable test IDs to components for more reliable selectors
2. **Test data setup** - Create test data fixtures for consistent testing
3. **Visual regression** - Add screenshot comparison tests
4. **Performance testing** - Add performance benchmarks
5. **Accessibility testing** - Add a11y checks

## Migration Notes

All old E2E tests have been replaced. The new suite:
- Uses modern Playwright patterns
- Has better error handling
- Includes comprehensive fixtures
- Tests all major user flows
- Works across all browsers and devices



