// #159 light and dark themes, remembered without a flash on reload.
import { expect, test } from '../fixtures';

const bg = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('light theme is applied and survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/login');
  expect(await bg(page)).toBe('rgb(11, 18, 32)');
  await page.getByRole('button', { name: 'Тема: Как в системе' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await bg(page)).toBe('rgb(244, 246, 250)');
  await page.reload();
  // theme-init.js runs before the app: the first paint already has the light theme.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await bg(page)).toBe('rgb(244, 246, 250)');
  await page.getByRole('button', { name: 'Тема: Светлая' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('with no choice the system preference decides', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/check');
  expect(await bg(page)).toBe('rgb(244, 246, 250)');
});
