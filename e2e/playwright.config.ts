// Playwright end-to-end tests (#110): one spec per feature (issues labelled e2e-test), run against a
// running stack — `npm start` locally, Docker Compose with PostgreSQL in CI. BASE_URL picks the target.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]] : [['list']],
  outputDir: '../test-results',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3200',
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /phone/ },
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } }, testMatch: /phone/ },
  ],
});
