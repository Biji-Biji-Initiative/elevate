import { defineConfig, devices } from '@playwright/test'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-results.json' }],
    ['junit', { outputFile: 'playwright-results.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup'],
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    //   dependencies: ['setup'],
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    //   dependencies: ['setup'],
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'pnpm dev:web',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
        KAJABI_WEBHOOK_SECRET: 'test-secret-123',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'test-clerk-key',
        CLERK_SECRET_KEY: 'test-clerk-secret'
      }
    },
    {
      command: 'pnpm dev:admin',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
        KAJABI_WEBHOOK_SECRET: 'test-secret-123',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'test-clerk-key',
        CLERK_SECRET_KEY: 'test-clerk-secret'
      }
    }
  ],

  /* Global setup and teardown */
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
})