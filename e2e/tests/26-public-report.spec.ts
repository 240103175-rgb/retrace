// #153 a victim reports without an account; an investigator takes it and gets a case with the file.
import { expect, signIn, test, uid } from '../fixtures';

test('public report → intake → case', async ({ page, browser, api }) => {
  const marker = uid();
  const victim = await (await browser.newContext()).newPage();
  await victim.goto('/check');
  await victim.getByRole('link', { name: 'Сообщить о мошенничестве' }).first().click();
  await victim.getByLabel('Что произошло').fill(`Звонок из «банка» ${marker}: попросили код из SMS и перевести 50 000 ₸`);
  await victim.getByLabel('Как с вами связаться (необязательно)').fill('+7 777 123 45 67');
  await victim.getByLabel('Скриншот или файл (необязательно)').setInputFiles({ name: 'call.txt', mimeType: 'text/plain', buffer: Buffer.from(`Журнал звонков ${marker}`) });
  await victim.getByRole('checkbox').check();
  await victim.getByRole('button', { name: 'Отправить' }).click();
  const sent = victim.getByTestId('report-sent');
  await expect(sent).toContainText('Сообщение получено');
  const reference = /RT-[0-9A-F]{8}/.exec((await sent.innerText()) ?? '')![0];

  const a = await api.newUser('intake');
  await signIn(page, a.email, a.password, '/intake');
  const row = page.getByTestId('intake-row').filter({ hasText: reference });
  await expect(row).toContainText(marker);
  await row.getByRole('button', { name: 'Взять в работу' }).click();
  await expect(page.getByRole('heading', { name: `Обращение ${reference}` })).toBeVisible();
  await page.getByRole('tab', { name: /Доказательства/ }).click();
  await expect(page.getByTestId('evidence-row')).toContainText('call.txt');
  await page.goto('/intake');
  await expect(page.getByTestId('intake-row').filter({ hasText: reference })).toHaveCount(0);
});
