// #117 edit title, change status, closed cases are locked.
import { expect, signIn, test } from '../fixtures';

test('the owner edits the case and closing it locks the content', async ({ page, api }) => {
  const a = await api.newUser('details');
  const c = await api.createCase(a, 'Старое название');
  await api.addEvidence(a, c.id, { content: 'Первое сообщение' });
  await signIn(page, a.email, a.password, `/cases/${c.id}`);

  await page.getByRole('button', { name: 'Изменить' }).click();
  await page.getByLabel('Название').fill('Новое название дела');
  await page.getByLabel('Описание').fill('Уточнённое описание');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Новое название дела' })).toBeVisible();
  await expect(page.getByText('Уточнённое описание')).toBeVisible();

  await page.getByLabel('Статус').selectOption('closed');
  await expect(page.getByText(/Дело закрыто для изменений/)).toBeVisible();
  await page.getByRole('tab', { name: /Доказательства/ }).click();
  await expect(page.getByTestId('evidence-row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^\+ Добавить$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Изменить' })).toHaveCount(0);

  await page.getByLabel('Статус').selectOption('open');
  await expect(page.getByText(/Дело закрыто для изменений/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^\+ Добавить$/ })).toBeVisible();
});
