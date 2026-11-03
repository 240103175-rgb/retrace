// #118 add, edit, delete, filters, «confirmed needs a source».
import { expect, signIn, test } from '../fixtures';

test('evidence can be added, edited, filtered and deleted', async ({ page, api }) => {
  const a = await api.newUser('evidence');
  const c = await api.createCase(a);
  await signIn(page, a.email, a.password, `/cases/${c.id}?tab=evidence`);
  await expect(page.getByText(/Доказательств пока нет/)).toBeVisible();
  const form = page.locator('form.subpanel');

  await page.getByRole('button', { name: /^\+ Добавить$/ }).click();
  await form.getByLabel('Содержание').fill('Просят код из SMS для «возврата»');
  await form.getByLabel('Проверка').selectOption('confirmed');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Для статуса «Подтверждено» укажите источник')).toBeVisible();
  await form.getByLabel('Источник').fill('Telegram');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('evidence-row')).toHaveCount(1);

  await page.getByRole('button', { name: /^\+ Добавить$/ }).click();
  await form.getByLabel('Тип').selectOption('payment');
  await form.getByLabel('Содержание').fill('Перевод «за доставку»');
  await form.getByLabel('Сумма, ₸').fill('12500');
  await form.getByLabel('Дата наблюдения').fill('2026-10-21');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('evidence-row')).toHaveCount(2);
  await expect(page.getByText('12 500 ₸')).toBeVisible();

  const row = page.getByTestId('evidence-row').filter({ hasText: 'Перевод' });
  await row.getByRole('button', { name: 'Изменить' }).click();
  await form.getByLabel('Содержание').fill('Перевод «за доставку» на личную карту');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Перевод «за доставку» на личную карту')).toBeVisible();

  await page.getByLabel('Поиск в доказательствах').fill('SMS');
  await expect(page.getByTestId('evidence-row')).toHaveCount(1);
  await page.getByLabel('Поиск в доказательствах').fill('');
  await page.getByRole('search').getByLabel('Тип').selectOption('payment');
  await expect(page.getByTestId('evidence-row')).toHaveCount(1);
  await page.getByRole('search').getByLabel('Тип').selectOption('');

  await page.getByTestId('evidence-row').filter({ hasText: 'SMS' }).getByRole('button', { name: 'Удалить' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Отмена' }).click();
  await expect(page.getByTestId('evidence-row')).toHaveCount(2);
  await page.getByTestId('evidence-row').filter({ hasText: 'SMS' }).getByRole('button', { name: 'Удалить' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
  await expect(page.getByTestId('evidence-row')).toHaveCount(1);
});
