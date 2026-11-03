// #115 sign in, wrong password, register, sign out.
import { expect, PASSWORD, signIn, test, uid } from '../fixtures';

test('a new investigator registers, signs out and signs in again; a wrong password is refused', async ({ page, api }) => {
  const email = `reg-${uid()}@retrace.test`;
  await page.goto('/cases');
  await expect(page).toHaveURL(/\/login\?next=%2Fcases/);
  await page.getByRole('button', { name: /Регистрация/ }).click();
  await page.getByLabel('Имя').fill('Новый Следователь');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('short');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page.getByRole('alert')).toContainText('не короче 8');
  await page.getByLabel('Пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page.getByRole('heading', { name: 'Дела' })).toBeVisible();
  await expect(page.getByText('Дел пока нет')).toBeVisible();

  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile/);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('wrong-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('alert')).toHaveText('Неверный email или пароль');

  await signIn(page, email, PASSWORD);
  await expect(page.getByRole('link', { name: 'Профиль' }).or(page.getByText('Новый Следователь'))).toBeVisible();
  expect(await api.login(email, PASSWORD)).toBeTruthy();
});
