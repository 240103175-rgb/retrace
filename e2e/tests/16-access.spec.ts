// #130 another investigator's case is invisible: UI «не найдено», API 404, not in the list.
import { expect, signIn, test } from '../fixtures';

test('an investigator cannot see another investigator’s case', async ({ page, api, request }) => {
  const owner = await api.newUser('private');
  const other = await api.newUser('curious');
  const c = await api.createCase(owner, 'Секретное дело владельца');
  await signIn(page, other.email, other.password);
  await expect(page.getByText('Секретное дело владельца')).toHaveCount(0);
  await page.goto(`/cases/${c.id}`);
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  for (const path of [`/cases/${c.id}`, `/cases/${c.id}/evidence`, `/cases/${c.id}/risk`, `/cases/${c.id}/members`]) {
    const res = await request.get(`/api/v1${path}`, { headers: { authorization: `Bearer ${other.token}` } });
    expect(res.status(), path).toBe(404);
  }
});
