// #123 explainable risk: score, rules with their evidence, rules not triggered, disclaimer; changes with data.
import { expect, scamCase, signIn, test } from '../fixtures';

test('risk explains every triggered rule and reacts to new evidence', async ({ page, api }) => {
  const a = await api.newUser('risk');
  const { c } = await scamCase(api, a);
  await signIn(page, a.email, a.password, `/cases/${c.id}?tab=risk`);
  const risk = page.getByTestId('risk-view');
  await expect(risk.getByText('Просят код, пароль, PIN или CVV')).toBeVisible();
  await expect(risk.getByText('Подозрительная ссылка')).toBeVisible();
  await expect(risk.getByText('Срочно пришлите код из SMS', { exact: false }).first()).toBeVisible();
  await expect(risk.getByTestId('rules-off')).toContainText('Выигрыш');
  await expect(risk.getByText('Это индикатор риска, а не доказательство мошенничества.')).toBeVisible();
  const before = Number(await risk.locator('.risk-number').innerText());

  await api.addEvidence(a, c.id, { content: 'Просили установить AnyDesk, чтобы «помочь с переводом»' });
  await page.reload();
  await expect(risk.locator('.risk-number')).not.toHaveText(String(before));
  expect(Number(await risk.locator('.risk-number').innerText())).toBeGreaterThan(before);
  await expect(risk.getByText(/удалённого доступа/).first()).toBeVisible();
});
