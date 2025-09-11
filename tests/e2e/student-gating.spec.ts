import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/clerk-login'

// This E2E is a placeholder requiring a real Student account to validate redirects.
// Provide E2E_BASE_URL and Clerk test credentials to enable.
const BASE = process.env.E2E_BASE_URL || ''

test.describe('Student gating (educator-only routes)', () => {
  test.skip(!BASE, 'E2E_BASE_URL not provided')

  test('unauthenticated users are redirected to sign-in on educator-only routes', async ({ page }) => {
    await page.goto(`${BASE}/en/dashboard/explore`)
    await expect(page).toHaveURL(/\/en\/sign-in/)
  })

  test('signed-in Student is redirected to educators-only', async ({ page }) => {
    const email = process.env.CLERK_E2E_STUDENT_EMAIL
    const password = process.env.CLERK_E2E_STUDENT_PASSWORD
    test.skip(!email || !password, 'CLERK_E2E_STUDENT_EMAIL/PASSWORD not provided')
    await loginAs(page, BASE, email!, password!)
    await page.goto(`${BASE}/en/dashboard/present`)
    await expect(page).toHaveURL(/\/en\/educators-only/)
  })
})
