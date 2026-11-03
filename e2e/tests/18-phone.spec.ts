// #132 phone layout (375×812): no horizontal scroll, profile reachable, tabs and graph usable.
import { expect, scamCase, signIn, test } from '../fixtures';

test('the app works at phone width', async ({ page, api }) => {
  const a = await api.newUser('phone');
  const { c } = await scamCase(api, a);
  const e1 = await api.addEntity(a, c.id, 'account', '@phone_test_account');
  const e2 = await api.addEntity(a, c.id, 'card', '4400 4301 2345 6789');
  await api.link(a, c.id, e1.id, e2.id, 'owns');
  await signIn(page, a.email, a.password);
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  expect(await noScroll()).toBe(true);
  await page.getByRole('link', { name: 'Профиль' }).click();
  await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();
  expect(await noScroll()).toBe(true);

  await page.goto(`/cases/${c.id}`);
  expect(await noScroll()).toBe(true);
  await page.getByRole('tab', { name: 'Отчёты' }).click();
  await expect(page.getByRole('tab', { name: 'Отчёты' })).toBeInViewport();
  await page.getByRole('tab', { name: 'Граф' }).click();
  const label = page.getByTestId('graph-node').first().locator('text').first();
  const box = await label.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(9); // readable without zooming (#31)
  expect(await noScroll()).toBe(true);
});
