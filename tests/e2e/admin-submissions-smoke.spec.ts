import { test, expect } from '@playwright/test'

// Simple smoke that the admin submissions page responds and renders a shell.
// This does not assert authentication; in CI/dev it may redirect to sign-in.
test('admin submissions smoke', async ({ page }) => {
  const adminOrigin = process.env.ADMIN_BASE_URL || 'http://localhost:3001'
  const locale = process.env.ADMIN_LOCALE || 'en'
  await page.goto(`${adminOrigin}/${locale}/submissions`)

  // Accept either a queue shell, or a guard page if not authenticated
  const headingQueue = page.locator('h1:has-text("Submissions")')
  const unauthorized = page.locator('text=/Unauthorized|Sign in/i')
  await expect(headingQueue.or(unauthorized)).toBeVisible({ timeout: 15000 })
})

