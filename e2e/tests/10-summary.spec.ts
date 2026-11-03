// #124 draft summary with citations that open the cited evidence.
import { expect, scamCase, signIn, test } from '../fixtures';

test('the overview drafts a summary whose citations open the evidence', async ({ page, api }) => {
  const a = await api.newUser('summary');
  const { c, pay } = await scamCase(api, a);
  await signIn(page, a.email, a.password, `/cases/${c.id}`);
  const s = page.getByTestId('summary');
  await expect(s).toContainText('В деле 3 доказательства');
  await expect(s).toContainText(/Индикатор риска — \d+ из 100/);
  await expect(s).toContainText('В доказательствах 1 перевод на сумму 45 000 ₸');
  await expect(s).toContainText('Это индикатор риска, а не доказательство мошенничества.');
  await s.getByRole('button', { name: `Открыть доказательство #${pay.id}` }).first().click();
  await expect(page.getByRole('tab', { name: /Доказательства/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(`#evidence-${pay.id}`)).toBeInViewport();
});
