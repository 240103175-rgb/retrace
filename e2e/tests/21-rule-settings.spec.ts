// #141 the admin changes a rule's weight; the case score follows and the change is audited.
import { ADMIN, expect, signIn, test } from '../fixtures';

test('admin reweights the hub rule and resets it', async ({ page, api }) => {
  const a = await api.newUser('rules');
  const c = await api.createCase(a);
  const hub = await api.addEntity(a, c.id, 'account', '@hub_rules');
  for (const label of ['+7 700 000 00 01', '+7 700 000 00 02', '+7 700 000 00 03']) {
    const e = await api.addEntity(a, c.id, 'phone', label);
    await api.link(a, c.id, hub.id, e.id);
  }
  const before = (await api.call('GET', `/cases/${c.id}/risk`, a.token)).rules.find((r: { id: string }) => r.id === 'hub_entity').weight;
  expect(before).toBe(10);

  await signIn(page, ADMIN.email, ADMIN.password, '/admin');
  const weight = page.getByLabel('Вес: Сущность связана с тремя и более другими');
  await weight.fill('30');
  await weight.blur();
  await expect(page.getByTestId('audit')).toContainText('правило «Сущность связана с тремя и более другими»: 10 → 30');
  expect((await api.call('GET', `/cases/${c.id}/risk`, a.token)).rules.find((r: { id: string }) => r.id === 'hub_entity').weight).toBe(30);

  await page.getByTestId('risk-rules').getByRole('row').filter({ hasText: 'тремя и более' }).getByRole('button', { name: 'Сбросить' }).click();
  await expect(page.getByLabel('Вес: Сущность связана с тремя и более другими')).toHaveValue('10');
});
