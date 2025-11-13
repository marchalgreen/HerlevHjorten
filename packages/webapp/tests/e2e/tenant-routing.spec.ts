import { test, expect } from '@playwright/test'

test.describe('Tenant Routing', () => {
  test('should load default tenant correctly', async ({ page }) => {
    await page.goto('/#/coach')
    await page.waitForLoadState('networkidle')
    
    // Check that default tenant branding is shown (use first header - app header)
    const appHeader = page.locator('header').first()
    await expect(appHeader).toBeVisible()
    
    // Check page title
    await expect(page).toHaveTitle(/herlev|hjorten/i)
  })

  test('should load rundemanager tenant correctly', async ({ page }) => {
    await page.goto('/#/rundemanager/coach')
    await page.waitForLoadState('networkidle')
    
    // Check that rundemanager tenant branding is shown (use first header - app header)
    const appHeader = page.locator('header').first()
    await expect(appHeader).toBeVisible()
    
    // Check for RundeManager branding
    const brandName = page.getByText(/rundemanager/i)
    await expect(brandName).toBeVisible()
  })

  test('should maintain tenant context when navigating', async ({ page }) => {
    // Start with rundemanager tenant
    await page.goto('/#/rundemanager/coach')
    await page.waitForLoadState('networkidle')
    
    // Navigate to check-in - handle mobile menu if needed
    const checkInLink = page.getByRole('link', { name: /indtjekning|check-in/i })
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
    
    // URL should maintain tenant prefix
    await expect(page).toHaveURL(/#\/rundemanager\/check-in/i)
  })
})

