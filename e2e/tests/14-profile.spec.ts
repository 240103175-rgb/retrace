// #128 change name, change password, sign out everywhere.
import { expect, signIn, test } from '../fixtures';

test('profile changes the name and password and signs out other sessions', async ({ page, browser, api }) => {
  const a = await api.newUser('profile');
  const other = await (await browser.newContext()).newPage();
  await signIn(other, a.email, a.password);
  await signIn(page, a.email, a.password, '/profile');

  await page.getByLabel('Имя').fill('Переименованный Следователь');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Сохранено')).toBeVisible();
  await expect(page.locator('header')).toContainText('Переименованный Следователь');

  await page.getByLabel('Текущий пароль').fill('wrong-current');
  await page.getByLabel('Новый пароль', { exact: true }).fill('new-e2e-password');
  await page.getByLabel('Повторите новый пароль').fill('new-e2e-password');
  await page.getByRole('button', { name: 'Сменить пароль' }).click();
  await expect(page.getByText('Неверный текущий пароль')).toBeVisible();
  await page.getByLabel('Текущий пароль').fill(a.password);
  await page.getByRole('button', { name: 'Сменить пароль' }).click();
  await expect(page.getByText('Пароль изменён. Другие сеансы завершены.')).toBeVisible();
  await expect(api.login(a.email, a.password)).rejects.toThrow(/401/);
  expect(await api.login(a.email, 'new-e2e-password')).toBeTruthy();

  // The other session was ended by the password change.
  await other.reload();
  await expect(other).toHaveURL(/\/login/);

  await page.getByRole('button', { name: 'Выйти на всех устройствах' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Выйти на всех устройствах' }).click();
  await expect(page).toHaveURL(/\/login/);
});
