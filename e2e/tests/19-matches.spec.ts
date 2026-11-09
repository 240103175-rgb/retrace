// #137 the same card in another investigator's case shows as a count, never as that case.
import { expect, signIn, test, uid } from '../fixtures';

test('a card recorded by another investigator is flagged without revealing their case', async ({ page, api }) => {
  const me = await api.newUser('match-a');
  const other = await api.newUser('match-b');
  const card = `4400 4301 ${String(Date.now()).slice(-4)} 0000`.slice(0, 19);
  // Any 16 digits; matching does not need a valid Luhn number.
  const mine = await api.createCase(me, `Моё дело ${uid()}`);
  await api.addEntity(me, mine.id, 'card', card);
  const theirs = await api.createCase(other, `Чужое секретное дело ${uid()}`);
  await api.addEntity(other, theirs.id, 'card', card.replace(/ /g, '-'));

  await signIn(page, me.email, me.password, `/cases/${mine.id}?tab=entities`);
  const m = page.getByTestId('matches');
  await expect(m).toContainText(card);
  await expect(m).toContainText('ещё в 1 делах других следователей');
  await expect(m).not.toContainText('Чужое секретное дело');
  await page.getByRole('tab', { name: 'Риск' }).click();
  await expect(page.getByTestId('risk-view').getByText('Встречается в других расследованиях')).toBeVisible();
});
