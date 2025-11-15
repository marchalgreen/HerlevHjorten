import { test, expect } from '@playwright/test'

/**
 * Helper to ensure a navigation link is visible, opening mobile menu if needed.
 * @param page - Playwright page object
 * @param linkText - Text or regex pattern to match the link
 * @returns The located link element
 */
async function ensureLinkVisible(
  page: ReturnType<typeof test>['extend']['page'],
  linkText: string | RegExp
) {
  const link = page.getByRole('link', { name: linkText })
  
  // Check if link is already visible
  const isVisible = await link.isVisible().catch(() => false)
  if (isVisible) {
    return link
  }
  
  // Try opening mobile menu
  const menuButton = page.getByRole('button', { name: /åbn menu|menu/i })
  const menuVisible = await menuButton.isVisible().catch(() => false)
  
  if (menuVisible) {
    await menuButton.click()
    // Wait for navigation menu to be visible
    await page.locator('nav').waitFor({ state: 'visible', timeout: 2000 })
  }
  
  // Return the link (should now be visible)
  return link
}

/**
 * Helper to navigate to a page via a link, handling mobile menu if needed.
 * @param page - Playwright page object
 * @param linkText - Text or regex pattern to match the link
 * @param expectedUrl - Expected URL pattern after navigation
 */
async function navigateToPage(
  page: ReturnType<typeof test>['extend']['page'],
  linkText: string | RegExp,
  expectedUrl: RegExp
) {
  const link = await ensureLinkVisible(page, linkText)
  await link.waitFor({ state: 'visible', timeout: 2000 })
  await link.click()
  await expect(page).toHaveURL(expectedUrl, { timeout: 5000 })
  await page.waitForLoadState('networkidle')
}

test.describe('Navigation', () => {
  test('should navigate between all main pages', async ({ page }) => {
    await page.goto('/#/coach')
    await page.waitForLoadState('networkidle')
    
    // Navigate through all main pages
    await navigateToPage(page, /indtjekning/i, /#\/check-in/i)
    await navigateToPage(page, /runder/i, /#\/rounds/i)
    await navigateToPage(page, /spillere/i, /#\/players/i)
    await navigateToPage(page, /statistik/i, /#\/statistics/i)
    await navigateToPage(page, /træner/i, /#\/coach/i)
  })

  test('should have logo link to landing page', async ({ page }) => {
    await page.goto('/#/check-in')
    await page.waitForLoadState('networkidle')
    
    // Click logo link (should navigate to coach/landing page)
    const logoLink = page.locator('a[href*="/coach"]').first()
    const isVisible = await logoLink.isVisible().catch(() => false)
    
    if (isVisible) {
      await logoLink.click()
      await expect(page).toHaveURL(/#\/coach/i)
    }
  })

  test('should show active navigation state', async ({ page }) => {
    await page.goto('/#/coach')
    await page.waitForLoadState('networkidle')
    
    // Ensure coach link is visible (may need to open mobile menu)
    const coachLink = await ensureLinkVisible(page, /træner/i)
    await coachLink.waitFor({ state: 'visible', timeout: 2000 })
    
    // Check that coach link is active
    const isActive = await coachLink.getAttribute('data-active')
    expect(isActive).toBe('true')
  })
})
