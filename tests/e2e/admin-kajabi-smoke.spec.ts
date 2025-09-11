import { test, expect } from '@playwright/test'

// Simple smoke that the admin Kajabi page responds.
// Accepts either the Kajabi UI or an auth screen if unauthenticated.
test('admin kajabi smoke', async ({ page }) => {
  const adminOrigin = process.env.ADMIN_BASE_URL || 'http://localhost:3001'
  const locale = process.env.ADMIN_LOCALE || 'en'
  await page.goto(`${adminOrigin}/${locale}/kajabi`)

  const heading = page.locator('h1:has-text("Kajabi Integration")')
  const unauthorized = page.locator('text=/Unauthorized|Sign in/i')
  await expect(heading.or(unauthorized)).toBeVisible({ timeout: 15000 })
})

