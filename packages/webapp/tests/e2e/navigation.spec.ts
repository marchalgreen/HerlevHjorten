import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should navigate between all main pages', async ({ page }) => {
    await page.goto('/#/coach')
    await page.waitForLoadState('networkidle')
    
    // On mobile, navigation might be in hamburger menu - try both
    const checkInLink = page.getByRole('link', { name: /indtjekning/i })
    const isVisible = await checkInLink.isVisible().catch(() => false)
    
    if (!isVisible) {
      // Try opening mobile menu
      const menuButton = page.getByRole('button', { name: /åbn menu|menu/i })
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click()
        await page.waitForTimeout(300) // Wait for menu animation
      }
    }
    
    await checkInLink.click()
    await expect(page).toHaveURL(/#\/check-in/i)
    await page.waitForLoadState('networkidle')
    
    // Navigate to Match Program
    await page.getByRole('link', { name: /kampprogram/i }).click()
    await expect(page).toHaveURL(/#\/match-program/i)
    await page.waitForLoadState('networkidle')
    
    // Navigate to Players
    await page.getByRole('link', { name: /spillere/i }).click()
    await expect(page).toHaveURL(/#\/players/i)
    await page.waitForLoadState('networkidle')
    
    // Navigate to Statistics
    await page.getByRole('link', { name: /statistik/i }).click()
    await expect(page).toHaveURL(/#\/statistics/i)
    await page.waitForLoadState('networkidle')
    
    // Navigate back to Coach
    await page.getByRole('link', { name: /træner/i }).click()
    await expect(page).toHaveURL(/#\/coach/i)
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
        await page.waitForTimeout(300) // Wait for menu animation
      }
    }
    
    // Check that coach link is active
    const isActive = await coachLink.getAttribute('data-active')
    expect(isActive).toBe('true')
  })
})

