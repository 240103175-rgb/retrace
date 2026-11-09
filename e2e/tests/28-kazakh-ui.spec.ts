// #157 the interface switches to Kazakh and stays Kazakh after a reload.
import { expect, signIn, test } from '../fixtures';

test('Қазақша everywhere, remembered', async ({ page, api }) => {
  const a = await api.newUser('kazakh');
  await api.createCase(a, 'Тест ісі');
  await signIn(page, a.email, a.password);
  await page.getByRole('button', { name: 'Қазақша' }).click();
  await expect(page.getByRole('heading', { name: 'Істер' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Істер' })).toBeVisible();
  await page.getByTestId('case-row').first().click();
  for (const tab of ['Шолу', 'Дәлелдер', 'Нысандар', 'Граф', 'Тәуекел', 'Есептер', 'Талқылау']) await expect(page.getByRole('tab', { name: new RegExp(tab) })).toBeVisible();
  await page.getByRole('tab', { name: 'Тәуекел' }).click();
  await expect(page.getByText('Бұл — тәуекел көрсеткіші, алаяқтықтың дәлелі емес.')).toBeVisible();
  await page.getByRole('button', { name: 'Русский' }).click();
  await expect(page.getByText('Это индикатор риска, а не доказательство мошенничества.')).toBeVisible();
});
