// #139 a misspelled Kazakh brand domain is explained in the risk tab.
import { expect, signIn, test } from '../fixtures';

test('kaspl.kz is reported as a typo of a known domain', async ({ page, api }) => {
  const a = await api.newUser('lookalike');
  const c = await api.createCase(a);
  await api.addEvidence(a, c.id, { type: 'link', content: 'https://kaspl.kz/bonus' });
  await api.addEvidence(a, c.id, { type: 'link', content: 'https://pay.kaspi.kz/invoice' });
  await signIn(page, a.email, a.password, `/cases/${c.id}?tab=risk`);
  const rule = page.getByTestId('risk-view').locator('.rules > li').filter({ hasText: 'Подозрительная ссылка' });
  await expect(rule).toContainText('https://kaspl.kz/bonus — опечатка в известном домене');
  await expect(rule).not.toContainText('pay.kaspi.kz');
});
