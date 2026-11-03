// #116 create, search, status filter, sort by risk.
import { expect, scamCase, signIn, test } from '../fixtures';

test('creates cases, searches, filters by status and sorts by risk', async ({ page, api }) => {
  const a = await api.newUser('cases');
  const risky = await scamCase(api, a);
  await api.createCase(a, 'Тихое дело без доказательств', 'Ничего подозрительного');
  await signIn(page, a.email, a.password);

  await page.getByRole('button', { name: /Новое дело/ }).click();
  await page.getByLabel('Название').fill('AB');
  await page.getByRole('button', { name: 'Создать' }).click();
  await expect(page.getByRole('alert')).toContainText('от 3 до 120');
  await page.getByLabel('Название').fill('Фишинговый сайт банка');
  await page.getByRole('button', { name: 'Создать' }).click();
  await expect(page.getByRole('heading', { name: 'Фишинговый сайт банка' })).toBeVisible();
  await expect(page.getByText('Дело создано')).toBeVisible();

  await page.getByRole('link', { name: /Назад/ }).click();
  const rows = page.getByTestId('case-row');
  await expect(rows).toHaveCount(3);
  await page.getByLabel('Поиск по названию и описанию').fill('фишинг');
  await expect(rows).toHaveCount(1);
  await page.getByLabel('Поиск по названию и описанию').fill('');
  await page.getByLabel('Статус').selectOption('closed');
  await expect(page.getByText(/Ничего не найдено/)).toBeVisible();
  await page.getByLabel('Статус').selectOption('');
  await page.getByLabel('Сортировка').selectOption('risk');
  await expect(rows.first()).toContainText(risky.c.title);
  await rows.first().click();
  await expect(page.getByRole('heading', { name: risky.c.title })).toBeVisible();
});
