// #121 entities found in evidence text are offered as hints and added only on click.
import { expect, signIn, test } from '../fixtures';

test('a phone in new evidence is suggested and becomes an entity on click', async ({ page, api }) => {
  const a = await api.newUser('suggest');
  const c = await api.createCase(a);
  await api.addEvidence(a, c.id, { content: 'Звоните 8 (701) 555-12-34 или пишите @refund_desk_kz' });
  await signIn(page, a.email, a.password, `/cases/${c.id}?tab=entities`);

  const hints = page.getByTestId('suggestions');
  await expect(hints).toContainText('Подсказка — проверьте перед добавлением');
  await expect(hints).toContainText('+7 701 555 12 34');
  await expect(hints).toContainText('@refund_desk_kz');
  await expect(page.getByTestId('entity')).toHaveCount(0);

  await hints.getByRole('button', { name: 'Добавить +7 701 555 12 34' }).click();
  await expect(page.getByTestId('entity')).toHaveCount(1);
  await expect(page.getByTestId('entity')).toContainText('+7 701 555 12 34');
  await expect(hints).not.toContainText('+7 701 555 12 34');
  await expect(hints).toContainText('@refund_desk_kz');
});
