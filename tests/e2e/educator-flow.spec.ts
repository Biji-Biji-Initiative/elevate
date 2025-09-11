import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/clerk-login'

const BASE = process.env.E2E_BASE_URL || ''

test.describe('Educator flow basic smoke', () => {
  test.skip(!BASE, 'E2E_BASE_URL not provided')

  test('educator can access dashboard and Explore page', async ({ page }) => {
    const email = process.env.CLERK_E2E_EDU_EMAIL
    const password = process.env.CLERK_E2E_EDU_PASSWORD
    test.skip(!email || !password, 'CLERK_E2E_EDU_EMAIL/PASSWORD not provided')
    await loginAs(page, BASE, email!, password!)
    await page.goto(`${BASE}/en/dashboard`)
    await expect(page).toHaveURL(/\/en\/dashboard/)

    // Navigate to Explore and verify form content renders
    await page.goto(`${BASE}/en/dashboard/explore`)
    await expect(page.getByText('Explore — AI in the Classroom')).toBeVisible()
    await expect(page.getByText('AI Tool Used')).toBeVisible()
  })
})

