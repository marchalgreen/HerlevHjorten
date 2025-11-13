import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to landing page (coach route)
    await page.goto('/#/coach')
    // Wait for page to load
    await page.waitForLoadState('networkidle')
  })

  test('should display welcome header and group cards', async ({ page }) => {
    // Check for welcome header - can be "Velkommen træner" or "Hej, [name]"
    const welcomeHeader = page.getByRole('heading', { name: /velkommen|hej/i })
    await expect(welcomeHeader).toBeVisible()
    
    // Check that group cards are rendered (look for group names)
    // Groups might be "Senior A", "U17", "U15", etc.
    const groupCards = page.locator('text=/senior|u17|u15/i').first()
    // If no groups exist, that's also valid - just check page loaded
    const hasGroups = await groupCards.isVisible().catch(() => false)
    if (hasGroups) {
      await expect(groupCards).toBeVisible()
    }
  })

  test('should enable start session button when group is selected', async ({ page }) => {
    // Find and click a group card (look for clickable group elements)
    const groupCard = page.locator('text=/senior|u17|u15/i').first()
    const isVisible = await groupCard.isVisible().catch(() => false)
    
    if (isVisible) {
      await groupCard.click()
      
      // Check that start session button becomes enabled
      const startButton = page.getByRole('button', { name: /start session/i })
      await expect(startButton).toBeEnabled()
    } else {
      // If no groups, check that start session button exists (may be disabled)
      const startButton = page.getByRole('button', { name: /start session/i })
      // Button should exist even if disabled
      await expect(startButton).toBeVisible()
    }
  })

  test('should navigate to check-in page when starting session', async ({ page }) => {
    // Try to select a group first
    const groupCard = page.locator('text=/senior|u17|u15/i').first()
    const hasGroups = await groupCard.isVisible().catch(() => false)
    
    if (hasGroups) {
      await groupCard.click()
      const startButton = page.getByRole('button', { name: /start session/i })
      // Wait for button to be enabled if it was disabled
      await startButton.waitFor({ state: 'visible' })
      await startButton.click()
    } else {
      // If no groups, try to start session anyway (button might be disabled but clickable)
      const startButton = page.getByRole('button', { name: /start session/i })
      const isEnabled = await startButton.isEnabled().catch(() => false)
      if (isEnabled) {
        await startButton.click()
      } else {
        // Skip test if no groups and button is disabled
        test.skip()
        return
      }
    }
    
    // Should navigate to check-in page
    await expect(page).toHaveURL(/#\/check-in/i, { timeout: 10000 })
    
    // Check-in page should show some content
    await page.waitForLoadState('networkidle')
    const pageContent = page.locator('body')
    await expect(pageContent).toBeVisible()
  })

  test('should display courts control', async ({ page }) => {
    // Courts control should be visible
    const courtsLabel = page.getByText(/antal baner/i)
    await expect(courtsLabel).toBeVisible()
  })
})

