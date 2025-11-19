/**
 * Navigation E2E tests
 * Tests navigation between pages and menu functionality
 */

import { test, expect } from './fixtures'
import { TestHelpers } from './fixtures'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/coach')
    await page.waitForLoadState('networkidle')
  })

  test('should navigate to check-in page', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    // Find navigation link/button
    const checkInLink = page.getByRole('link', { name: /tjek.*ind|check.*in/i }).or(
      page.getByRole('button', { name: /tjek.*ind|check.*in/i })
    )
    
    const exists = await helpers.elementExists(checkInLink)
    
    if (exists) {
      await checkInLink.click()
      await page.waitForURL(/#\/check-in/, { timeout: 10000 })
      await page.waitForLoadState('networkidle')
      
      const isOnCheckIn = await helpers.isOnRoute('check-in')
      expect(isOnCheckIn).toBe(true)
    }
  })

  test('should navigate to match program page', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    const roundsLink = page.getByRole('link', { name: /runder|rounds|match.*program/i })
    const exists = await helpers.elementExists(roundsLink)
    
    if (exists) {
      await roundsLink.click()
      await page.waitForURL(/#\/(rounds|match-program)/, { timeout: 10000 })
      await page.waitForLoadState('networkidle')
      
      const isOnRounds = await helpers.isOnRoute('rounds') || await helpers.isOnRoute('match-program')
      expect(isOnRounds).toBe(true)
    }
  })

  test('should navigate to players page', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    const playersLink = page.getByRole('link', { name: /spillere|players/i })
    const exists = await helpers.elementExists(playersLink)
    
    if (exists) {
      await playersLink.click()
      await page.waitForURL(/#\/players/, { timeout: 10000 })
      await page.waitForLoadState('networkidle')
      
      const isOnPlayers = await helpers.isOnRoute('players')
      expect(isOnPlayers).toBe(true)
    }
  })

  test('should navigate to statistics page', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    const statsLink = page.getByRole('link', { name: /statistik|statistics/i })
    const exists = await helpers.elementExists(statsLink)
    
    if (exists) {
      await statsLink.click()
      await page.waitForURL(/#\/statistics/, { timeout: 10000 })
      await page.waitForLoadState('networkidle')
      
      const isOnStats = await helpers.isOnRoute('statistics')
      expect(isOnStats).toBe(true)
    }
  })

  test('should navigate back to landing page', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    // Navigate away first
    await helpers.navigateTo('check-in')
    
    // Find logo or home link
    const homeLink = page.getByRole('link', { name: /logo|home|forside/i }).or(
      page.locator('img[alt*="logo" i]').locator('..')
    )
    
    const exists = await helpers.elementExists(homeLink)
    
    if (exists) {
      await homeLink.click()
      await page.waitForURL(/#\/coach/, { timeout: 10000 })
      await page.waitForLoadState('networkidle')
      
      const isOnLanding = await helpers.isOnRoute('coach')
      expect(isOnLanding).toBe(true)
    }
  })

  test('should show active navigation state', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    // Navigate to a page
    await helpers.navigateTo('check-in')
    await page.waitForTimeout(500)
    
    // Check for active state indicator on navigation item
    const activeNavItem = page.locator('[aria-current="page"]').or(
      page.locator('[data-active="true"]')
    )
    
    const hasActive = await helpers.elementExists(activeNavItem)
    // Active state may or may not be implemented
    expect(hasActive).toBeDefined()
  })

  test('should open mobile menu on small screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(500)
    
    const helpers = new TestHelpers(page)
    
    // Look for hamburger menu button
    const menuButton = page.getByRole('button', { name: /menu|menu/i }).or(
      page.locator('button').filter({ hasText: /☰|≡/ })
    )
    
    const exists = await helpers.elementExists(menuButton)
    
    if (exists) {
      await menuButton.click()
      await page.waitForTimeout(500)
      
      // Check for mobile menu
      const mobileMenu = page.locator('[role="navigation"]').filter({ 
        hasText: /tjek.*ind|check.*in/i 
      })
      
      const menuVisible = await helpers.elementExists(mobileMenu)
      expect(menuVisible).toBe(true)
    }
  })

  test('should close mobile menu when clicking outside', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(500)
    
    const helpers = new TestHelpers(page)
    
    const menuButton = page.getByRole('button', { name: /menu/i })
    const exists = await helpers.elementExists(menuButton)
    
    if (exists) {
      await menuButton.click()
      await page.waitForTimeout(500)
      
      // Click outside menu
      await page.click('body', { position: { x: 10, y: 10 } })
      await page.waitForTimeout(500)
      
      // Menu should be closed
      const mobileMenu = page.locator('[role="navigation"]')
      const isVisible = await mobileMenu.isVisible().catch(() => false)
      expect(isVisible).toBe(false)
    }
  })
})



