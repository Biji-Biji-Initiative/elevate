import { Page } from '@playwright/test'

export async function loginAs(page: Page, baseUrl: string, email: string, password: string) {
  // Go to sign-in
  await page.goto(`${baseUrl}/en/sign-in`)
  // Identifier/email field
  const emailSelectorCandidates = [
    'input[name="identifier"]',
    'input[type="email"]',
    'input[autocomplete="username"]',
  ]
  for (const sel of emailSelectorCandidates) {
    if (await page.$(sel)) {
      await page.fill(sel, email)
      break
    }
  }
  // Continue/Next button
  const nextButtonCandidates = [
    'button[type="submit"]',
    'button:has-text("Continue")',
    'button:has-text("Sign in")',
  ]
  for (const sel of nextButtonCandidates) {
    const el = await page.$(sel)
    if (el) {
      await el.click()
      break
    }
  }
  // Password field
  const pwdSelectorCandidates = [
    'input[name="password"]',
    'input[type="password"]',
  ]
  await page.waitForTimeout(500)
  for (const sel of pwdSelectorCandidates) {
    const el = await page.$(sel)
    if (el) {
      await page.fill(sel, password)
      break
    }
  }
  // Submit
  for (const sel of nextButtonCandidates) {
    const el = await page.$(sel)
    if (el) {
      await el.click()
      break
    }
  }
  // Wait for redirect to dashboard
  await page.waitForLoadState('networkidle')
}

