// #131 notes, tags with filtering, and the unsaved-changes guard on tab switches.
import { expect, signIn, test, uid } from '../fixtures';

test('notes and tags are saved; leaving a half-filled form asks first', async ({ page, api }) => {
  const a = await api.newUser('notes');
  const c = await api.createCase(a, 'Дело с тегами');
  await api.createCase(a, 'Другое дело');
  const tag = `t${uid().slice(-6)}`;
  await signIn(page, a.email, a.password, `/cases/${c.id}`);

  await page.getByLabel('Заметки').fill('Проверить номер карты в банке');
  await page.getByRole('button', { name: 'Сохранить заметки' }).click();
  await expect(page.getByText('Сохранено')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Заметки')).toHaveValue('Проверить номер карты в банке');

  await page.getByLabel('Добавить тег (Enter)').fill(tag.toUpperCase());
  await page.getByLabel('Добавить тег (Enter)').press('Enter');
  await expect(page.getByText(`#${tag}`)).toBeVisible();
  await page.getByRole('link', { name: /Назад/ }).click();
  await page.getByRole('button', { name: `#${tag}` }).click();
  await expect(page.getByTestId('case-row')).toHaveCount(1);
  await page.getByTestId('case-row').click();

  await page.getByRole('tab', { name: /Доказательства/ }).click();
  await page.getByRole('button', { name: /^\+ Добавить$/ }).click();
  await page.locator('form.subpanel').getByLabel('Содержание').fill('черновик');
  await page.getByRole('tab', { name: 'Риск' }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.locator('form.subpanel').getByLabel('Содержание')).toHaveValue('черновик');
  await page.getByRole('tab', { name: 'Риск' }).click();
  await dialog.getByRole('button', { name: 'Отменить изменения' }).click();
  await expect(page.getByTestId('risk-view')).toBeVisible();
});
