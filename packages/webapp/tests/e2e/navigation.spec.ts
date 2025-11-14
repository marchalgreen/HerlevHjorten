import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should navigate between all main pages', async ({ page }) => {
    await page.goto('/#/coach')
    await page.waitForLoadState('networkidle')
    
    // Helper to open mobile menu if needed
    const ensureMenuOpen = async () => {
      const menuButton = page.getByRole('button', { name: /åbn menu|menu/i })
      const menuVisible = await menuButton.isVisible().catch(() => false)
      if (menuVisible) {
        await menuButton.click()
        // Wait for navigation menu to be visible instead of fixed timeout
        await page.locator('nav').waitFor({ state: 'visible', timeout: 2000 }).catch(() => {})
      }
    }
    
    // Navigate to Check-In
    let checkInLink = page.getByRole('link', { name: /indtjekning/i })
    if (!(await checkInLink.isVisible().catch(() => false))) {
      await ensureMenuOpen()
      checkInLink = page.getByRole('link', { name: /indtjekning/i })
    }
    await checkInLink.waitFor({ state: 'visible', timeout: 2000 })
    await checkInLink.click()
    await expect(page).toHaveURL(/#\/check-in/i, { timeout: 5000 })
    await page.waitForLoadState('networkidle')
    
    // Navigate to Match Program
    let matchProgramLink = page.getByRole('link', { name: /kampprogram/i })
    if (!(await matchProgramLink.isVisible().catch(() => false))) {
      await ensureMenuOpen()
      matchProgramLink = page.getByRole('link', { name: /kampprogram/i })
    }
    await matchProgramLink.waitFor({ state: 'visible', timeout: 2000 })
    await matchProgramLink.click()
    await expect(page).toHaveURL(/#\/match-program/i, { timeout: 5000 })
    await page.waitForLoadState('networkidle')
    
    // Navigate to Players
    let playersLink = page.getByRole('link', { name: /spillere/i })
    if (!(await playersLink.isVisible().catch(() => false))) {
      await ensureMenuOpen()
      playersLink = page.getByRole('link', { name: /spillere/i })
    }
    await playersLink.waitFor({ state: 'visible', timeout: 2000 })
    await playersLink.click()
    await expect(page).toHaveURL(/#\/players/i, { timeout: 5000 })
    await page.waitForLoadState('networkidle')
    
    // Navigate to Statistics
    let statisticsLink = page.getByRole('link', { name: /statistik/i })
    if (!(await statisticsLink.isVisible().catch(() => false))) {
      await ensureMenuOpen()
      statisticsLink = page.getByRole('link', { name: /statistik/i })
    }
    await statisticsLink.waitFor({ state: 'visible', timeout: 2000 })
    await statisticsLink.click()
    await expect(page).toHaveURL(/#\/statistics/i, { timeout: 5000 })
    await page.waitForLoadState('networkidle')
    
    // Navigate back to Coach
    let coachLink = page.getByRole('link', { name: /træner/i })
    if (!(await coachLink.isVisible().catch(() => false))) {
      await ensureMenuOpen()
      coachLink = page.getByRole('link', { name: /træner/i })
    }
    await coachLink.waitFor({ state: 'visible', timeout: 2000 })
    await coachLink.click()
    await expect(page).toHaveURL(/#\/coach/i, { timeout: 5000 })
  })

  test('should have logo link to landing page', async ({ page }) => {
    await page.goto('/#/check-in')
    await page.waitForLoadState('networkidle')
    
    // Click logo link (should navigate to coach/landing page)
    const logoLink = page.locator('a[href*="/coach"]').first()
    if (await logoLink.isVisible()) {
      await logoLink.click()
      await expect(page).toHaveURL(/#\/coach/i)
    }
  })

  test('should show active navigation state', async ({ page }) => {
    await page.goto('/#/coach')
    await page.waitForLoadState('networkidle')
    
    // On mobile, navigation might be in hamburger menu
    const coachLink = page.getByRole('link', { name: /træner/i })
    const isVisible = await coachLink.isVisible().catch(() => false)
    
    if (!isVisible) {
      // Try opening mobile menu
      const menuButton = page.getByRole('button', { name: /åbn menu|menu/i })
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click()
        // Wait for menu to be visible instead of fixed timeout
        await coachLink.waitFor({ state: 'visible', timeout: 2000 })
      }
    }
    
    // Ensure link is visible before checking attribute
    await coachLink.waitFor({ state: 'visible', timeout: 2000 })
    
    // Check that coach link is active
    const isActive = await coachLink.getAttribute('data-active')
    expect(isActive).toBe('true')
  })
})

