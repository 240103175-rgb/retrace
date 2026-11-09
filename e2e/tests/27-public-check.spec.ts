// #155 the public check counts only cases with confirmed evidence and never shows them.
import { expect, test } from '../fixtures';

test('a known phone is counted; a look-alike link is flagged', async ({ page, api }) => {
  const a = await api.newUser('check');
  const phone = `+7 701 ${String(Date.now()).slice(-7, -4)} ${String(Date.now()).slice(-4, -2)} ${String(Date.now()).slice(-2)}`;
  const c = await api.createCase(a, 'Дело для проверки номера');
  await api.addEvidence(a, c.id, { content: `Звонили с ${phone}`, source: 'Звонок', verification: 'confirmed' });
  await api.addEntity(a, c.id, 'phone', phone);

  await page.goto('/check');
  await page.getByLabel('Телефон, карта, ссылка или @аккаунт').fill(phone.replace('+7 ', '8 '));
  await page.getByRole('button', { name: 'Проверить' }).click();
  const res = page.getByTestId('check-result');
  await expect(res).toContainText('Встречается в расследованиях: 1');
  await expect(res).not.toContainText('Дело для проверки номера');
  await expect(res).toContainText('не доказательство');

  await page.getByLabel('Телефон, карта, ссылка или @аккаунт').fill('https://0lx.kz/deal');
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(res).toContainText('опечатка в известном домене');
});
