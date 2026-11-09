// #161 installable app: a case opened online can be read offline; sign-out clears the stored data.
import { expect, signIn, test } from '../fixtures';

test('a recently opened case opens without a connection', async ({ page, context, api }) => {
  const a = await api.newUser('offline');
  const c = await api.createCase(a, 'Дело для офлайна');
  await api.addEvidence(a, c.id, { content: 'Сохранённое сообщение' });
  await signIn(page, a.email, a.password, `/cases/${c.id}`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The worker controls the page after a reload; this visit fills its cache.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Дело для офлайна' })).toBeVisible();
  await page.getByRole('tab', { name: /Доказательства/ }).click();
  await expect(page.getByText('Сохранённое сообщение')).toBeVisible();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Дело для офлайна' })).toBeVisible();
  await expect(page.getByTestId('offline-banner')).toBeVisible();
  await page.getByRole('tab', { name: /Доказательства/ }).click();
  await expect(page.getByText('Сохранённое сообщение')).toBeVisible();

  await context.setOffline(false);
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('retrace-data-v1')).keys()).length)).toBe(0);
});
