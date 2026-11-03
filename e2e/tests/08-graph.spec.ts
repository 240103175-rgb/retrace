// #122 graph with nodes, edges, legend, node focus and a text alternative.
import { expect, signIn, test } from '../fixtures';

test('the graph shows entities and links, focuses a node and lists links as text', async ({ page, api }) => {
  const a = await api.newUser('graph');
  const c = await api.createCase(a);
  const hub = await api.addEntity(a, c.id, 'account', '@hub_account');
  const card = await api.addEntity(a, c.id, 'card', '4400 4301 2345 6789');
  const phone = await api.addEntity(a, c.id, 'phone', '+7 700 111 22 33');
  await api.link(a, c.id, hub.id, card.id, 'owns');
  await api.link(a, c.id, hub.id, phone.id, 'same_as');
  await signIn(page, a.email, a.password, `/cases/${c.id}?tab=graph`);

  await expect(page.getByTestId('graph-node')).toHaveCount(3);
  await expect(page.getByTestId('graph-edge')).toHaveCount(2);
  await expect(page.getByTestId('legend')).toContainText('Аккаунт');
  await expect(page.getByTestId('legend')).toContainText('Карта');
  await page.getByRole('button', { name: 'Аккаунт @hub_account' }).click();
  await expect(page.locator('.graph-panel')).toContainText('Связей с другими: 2');
  await page.getByText('Связи текстом').click();
  await expect(page.locator('.graph-text')).toContainText('@hub_account — владеет → 4400 4301 2345 6789');
});
