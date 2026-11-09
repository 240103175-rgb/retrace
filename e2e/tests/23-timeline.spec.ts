// #145 the overview shows a day-by-day timeline with payment totals.
import { expect, signIn, test } from '../fixtures';

test('timeline groups evidence by day and sums payments', async ({ page, api }) => {
  const a = await api.newUser('timeline');
  const c = await api.createCase(a);
  await api.addEvidence(a, c.id, { content: 'Первое сообщение', observedOn: '2026-10-01' });
  await api.addEvidence(a, c.id, { type: 'payment', content: 'Первый перевод', amount: 10000, observedOn: '2026-10-05' });
  await api.addEvidence(a, c.id, { type: 'payment', content: 'Второй перевод', amount: 25000, observedOn: '2026-10-05' });
  await api.addEvidence(a, c.id, { type: 'observation', content: 'Без даты' });
  await signIn(page, a.email, a.password, `/cases/${c.id}`);
  const tl = page.getByTestId('timeline');
  await expect(tl.locator('.tl-day-title')).toHaveText(['01.10.2026', '05.10.2026', 'Без даты']);
  await expect(tl).toContainText('+4 дн.');
  await expect(tl).toContainText('всего переведено: 35 000 ₸');
});
