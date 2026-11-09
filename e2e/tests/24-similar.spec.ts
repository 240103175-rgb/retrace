// #149 the overview links to the investigator's other cases with the same identifiers.
import { expect, signIn, test, uid } from '../fixtures';

test('similar cases are listed and open', async ({ page, api }) => {
  const a = await api.newUser('similar');
  const one = await api.createCase(a, `Первое ${uid()}`);
  const two = await api.createCase(a, `Второе ${uid()}`);
  for (const c of [one, two]) await api.addEntity(a, c.id, 'account', '@same_scammer_kz');
  await signIn(page, a.email, a.password, `/cases/${one.id}`);
  const list = page.getByTestId('similar');
  await expect(list).toContainText('@same_scammer_kz');
  await list.getByRole('link', { name: two.title }).click();
  await expect(page.getByRole('heading', { name: two.title })).toBeVisible();
});
