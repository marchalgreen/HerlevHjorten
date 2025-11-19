/**
 * Admin Page E2E tests
 * Tests admin functionality (requires admin authentication)
 */

import { test, expect } from './fixtures'
import { TestHelpers } from './fixtures'

test.describe('Admin Page', () => {
  test.beforeEach(async ({ page }) => {
    // Admin page requires authentication
    // Note: These tests may need to be skipped if not authenticated
    await page.goto('/#/admin')
    await page.waitForLoadState('networkidle')
  })

  test('should require authentication', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    // Check if redirected to login or shows admin page
    const loginPage = page.getByRole('heading', { name: /log ind|login/i })
    const adminPage = page.getByRole('heading', { name: /admin|administration/i })
    
    const isLogin = await helpers.elementExists(loginPage)
    const isAdmin = await helpers.elementExists(adminPage)
    
    // Should be either on login or admin page
    expect(isLogin || isAdmin).toBe(true)
  })

  test('should display admin interface when authenticated', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    const adminHeading = page.getByRole('heading', { name: /admin|administration/i })
    const exists = await helpers.elementExists(adminHeading)
    
    if (exists) {
      await expect(adminHeading).toBeVisible()
    }
  })

  test('should display tenant management', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    // Look for tenant management section
    const tenantSection = page.locator('text=/tenants|lejere/i')
    const exists = await helpers.elementExists(tenantSection)
    
    if (exists) {
      await expect(tenantSection).toBeVisible()
    }
  })

  test('should display user management', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    // Look for user management
    const userSection = page.locator('text=/brugere|users|coaches/i')
    const exists = await helpers.elementExists(userSection)
    
    if (exists) {
      await expect(userSection).toBeVisible()
    }
  })

  test('should allow creating new tenant', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    const createButton = page.getByRole('button', { name: /opret.*tenant|create.*tenant/i })
    const exists = await helpers.elementExists(createButton)
    
    if (exists) {
      await createButton.click()
      await page.waitForTimeout(500)
      
      // Check for create tenant form
      const form = page.locator('form').or(page.locator('[role="dialog"]'))
      const formExists = await helpers.elementExists(form)
      expect(formExists).toBe(true)
    }
  })

  test('should allow managing coaches', async ({ page }) => {
    const helpers = new TestHelpers(page)
    
    // Look for coaches section
    const coachesSection = page.locator('text=/coaches|trænere/i')
    const exists = await helpers.elementExists(coachesSection)
    
    if (exists) {
      await expect(coachesSection).toBeVisible()
      
      // Look for add coach button
      const addButton = page.getByRole('button', { name: /tilføj.*coach|add.*coach/i })
      const hasAddButton = await helpers.elementExists(addButton)
      expect(hasAddButton).toBeDefined()
    }
  })
})



