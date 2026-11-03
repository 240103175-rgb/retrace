// #129 admin statistics, read-only case list, disabling a user, audit filter; investigators are kept out.
import { ADMIN, expect, signIn, test, uid } from '../fixtures';

test('admin manages users and reads the audit log; investigators cannot open /admin', async ({ page, browser, api }) => {
  const target = await api.newUser('disable');
  const title = `Дело для проверки админом ${uid()}`;
  await api.createCase(target, title);

  const investigator = await (await browser.newContext()).newPage();
  await signIn(investigator, target.email, target.password);
  await investigator.goto('/admin');
  await expect(investigator.getByText('Нет доступа')).toBeVisible();

  await signIn(page, ADMIN.email, ADMIN.password, '/admin');
  await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible();
  await page.getByLabel('Поиск по названию и описанию').fill(title);
  await expect(page.getByTestId('case-row')).toHaveCount(1);

  const row = page.getByRole('row').filter({ hasText: target.email });
  await row.getByRole('button', { name: 'Отключить' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Отключить' }).click();
  await expect(row).toContainText('Отключён');
  await expect(api.login(target.email, target.password)).rejects.toThrow(/403/);
  await row.getByRole('button', { name: 'Включить' }).click();
  await expect(row).toContainText('Активен');
  expect(await api.login(target.email, target.password)).toBeTruthy();

  await page.getByLabel('Действие').selectOption('user.');
  const audit = page.getByTestId('audit');
  await expect(audit).toContainText('отключил пользователя');
  await expect(audit).toContainText('включил пользователя');
});
