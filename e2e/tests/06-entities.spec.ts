// #120 entities, duplicates, relationships with supporting evidence, self-link refused.
import { expect, signIn, test } from '../fixtures';

test('entities are added and linked with evidence; duplicates and self-links are refused', async ({ page, api }) => {
  const a = await api.newUser('entities');
  const c = await api.createCase(a);
  await api.addEvidence(a, c.id, { content: 'Аккаунт @fake_seller прислал номер карты' });
  await signIn(page, a.email, a.password, `/cases/${c.id}?tab=entities`);
  const form = page.locator('form.subpanel');

  await page.getByRole('button', { name: /^\+ Добавить$/ }).first().click();
  await form.getByLabel('Тип').selectOption('account');
  await form.getByLabel('Обозначение').fill('@fake_seller');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('entity')).toHaveCount(1);

  await page.getByRole('button', { name: /^\+ Добавить$/ }).first().click();
  await form.getByLabel('Тип').selectOption('account');
  await form.getByLabel('Обозначение').fill('  @FAKE_seller ');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Такая сущность уже есть в деле')).toBeVisible();
  await form.getByLabel('Тип').selectOption('card');
  await form.getByLabel('Обозначение').fill('4400 4301 2345 6789');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('entity')).toHaveCount(2);

  // Relationship form: «+ Добавить» of the Связи section.
  await page.getByRole('button', { name: /^\+ Добавить$/ }).last().click();
  await form.getByRole('combobox', { name: /^Откуда/ }).selectOption({ index: 0 }); // @fake_seller, the first entity
  await form.getByRole('combobox', { name: /^Куда/ }).selectOption({ index: 0 });
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText(/Неверная связь/)).toBeVisible();
  await form.getByLabel('Тип связи').selectOption('owns');
  await form.getByRole('combobox', { name: /^Куда/ }).selectOption({ index: 1 });
  await form.getByText(/прислал номер карты/).click();
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('relationship')).toHaveCount(1);
  await expect(page.getByTestId('relationship')).toContainText('владеет');

  await page.getByRole('button', { name: 'Удалить 4400 4301 2345 6789' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
  await expect(page.getByTestId('entity')).toHaveCount(1);
  await expect(page.getByTestId('relationship')).toHaveCount(0);
});
