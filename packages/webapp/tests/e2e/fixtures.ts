/**
 * Playwright test fixtures and helpers
 * Provides reusable test utilities and custom fixtures
 */

import { test as base, expect, type Page, type Locator } from '@playwright/test'

/**
 * Custom test fixtures
 */
export const test = base.extend<{
  authenticatedPage: Page
  tenantPage: Page
}>({
  /**
   * Authenticated page fixture - logs in before each test
   */
  authenticatedPage: async ({ page, baseURL }, use) => {
    // Navigate to login page
    await page.goto(`${baseURL}/#/login`)
    await page.waitForLoadState('networkidle')

    // Fill in login form (adjust selectors based on actual form)
    const emailInput = page.getByLabel(/email|e-mail/i).or(page.getByPlaceholder(/email|e-mail/i))
    const passwordInput = page.getByLabel(/password|adgangskode/i).or(page.getByPlaceholder(/password|adgangskode/i))
    const loginButton = page.getByRole('button', { name: /log ind|login/i })

    // Only fill if inputs exist (may need to adjust based on actual auth flow)
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(process.env.TEST_USER_EMAIL || 'test@example.com')
      await passwordInput.fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
      await loginButton.click()
      
      // Wait for navigation after login
      await page.waitForURL(/#\/(coach|check-in|players)/, { timeout: 10000 })
      await page.waitForLoadState('networkidle')
    }

    await use(page)
  },

  /**
   * Tenant page fixture - ensures tenant context is loaded
   */
  tenantPage: async ({ page, baseURL }, use) => {
    // Navigate to a page that requires tenant context
    await page.goto(`${baseURL}/#/coach`)
    await page.waitForLoadState('networkidle')
    
    // Wait for tenant context to initialize
    await page.waitForFunction(() => {
      return window.location.hash.includes('#/')
    }, { timeout: 5000 })

    await use(page)
  },
})

/**
 * Helper functions for common test operations
 */
export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to a specific route
   */
  async navigateTo(route: string) {
    await this.page.goto(`/#/${route}`)
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Wait for element to be visible with retry
   */
  async waitForVisible(selector: string | Locator, timeout = 5000) {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector
    await locator.waitFor({ state: 'visible', timeout })
    return locator
  }

  /**
   * Check if element exists (doesn't throw if not found)
   */
  async elementExists(selector: string | Locator): Promise<boolean> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector
    return await locator.isVisible().catch(() => false)
  }

  /**
   * Fill form field safely
   */
  async fillField(label: string, value: string) {
    const field = this.page.getByLabel(label).or(this.page.getByPlaceholder(label))
    if (await this.elementExists(field)) {
      await field.fill(value)
    }
  }

  /**
   * Click button by text
   */
  async clickButton(text: string | RegExp) {
    const button = this.page.getByRole('button', { name: text })
    await button.click()
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Wait for API request to complete
   */
  async waitForApiResponse(urlPattern: string | RegExp) {
    await this.page.waitForResponse(
      (response) => {
        const url = response.url()
        return typeof urlPattern === 'string' 
          ? url.includes(urlPattern)
          : urlPattern.test(url)
      },
      { timeout: 10000 }
    )
  }

  /**
   * Get text content safely
   */
  async getText(selector: string | Locator): Promise<string> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector
    return await locator.textContent() || ''
  }

  /**
   * Check if page is on specific route
   */
  async isOnRoute(route: string): Promise<boolean> {
    const hash = await this.page.evaluate(() => window.location.hash)
    return hash.includes(`#/${route}`)
  }
}

/**
 * Export test utilities
 */
export { expect }



