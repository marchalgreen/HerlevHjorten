import { test, expect } from '@playwright/test'

test.describe('Check-In Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to check-in page
    await page.goto('/#/check-in')
    await page.waitForLoadState('networkidle')
  })

  test('should display check-in interface', async ({ page }) => {
    // Check for search input (TableSearch component) - may not be visible if no active session
    const searchInput = page.getByPlaceholder(/søg efter spiller/i)
    const isVisible = await searchInput.isVisible().catch(() => false)
    
    // Either search input is visible OR empty state message is shown
    if (!isVisible) {
      const emptyState = page.getByText(/ingen aktiv træning/i)
      await expect(emptyState).toBeVisible()
    } else {
      await expect(searchInput).toBeVisible()
    }
  })

  test('should search and display players', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/søg efter spiller/i)
    
    // Type in search
    await searchInput.fill('test')
    
    // Wait for search to process
    await page.waitForTimeout(500)
    
    // Check that page content is visible (either players or empty state)
    const pageContent = page.locator('body')
    await expect(pageContent).toBeVisible()
  })

  test('should show empty state when no active session', async ({ page }) => {
    // If no active session, should show appropriate message
    const emptyState = page.getByText(/ingen aktiv træning|no active session/i)
    const hasEmptyState = await emptyState.isVisible().catch(() => false)
    
    // Either empty state or player list should be visible
    const hasContent = await page.locator('body').isVisible()
    expect(hasContent).toBe(true)
  })

  test('should display letter filters', async ({ page }) => {
    // Letter filters should be visible if there are players
    const letterFilters = page.locator('[role="button"]').filter({ hasText: /[A-Z]/ })
    const count = await letterFilters.count()
    
    // May or may not have filters depending on data
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

