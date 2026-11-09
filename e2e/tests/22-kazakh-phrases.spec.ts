// #143 a message written in Kazakh triggers the same rules as a Russian one.
import { expect, signIn, test } from '../fixtures';

test('Kazakh scam phrases are recognised', async ({ page, api }) => {
  const a = await api.newUser('kzphrases');
  const c = await api.createCase(a);
  await api.addEvidence(a, c.id, { content: 'Шұғыл түрде бүгін ғана 20 000 теңге төлеңіз, SMS-кодты жіберіңіз' });
  await api.addEvidence(a, c.id, { content: 'Құттықтаймыз! Сіз сыйлық ұттыңыз, салықты төлеңіз' });
  await signIn(page, a.email, a.password, `/cases/${c.id}?tab=risk`);
  const risk = page.getByTestId('risk-view');
  for (const title of ['Просят код, пароль, PIN или CVV', 'Срочность вместе с требованием оплаты', 'Выигрыш, за который нужно заплатить']) {
    await expect(risk.locator('.rules').getByText(title)).toBeVisible();
  }
});
