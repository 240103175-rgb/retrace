// #125 report snapshot stays unchanged, shows its SHA-256 fingerprint, «Скачать PDF» prints under a file name.
import { expect, scamCase, signIn, test } from '../fixtures';

test('a report is an unchanging snapshot with a fingerprint and a PDF button', async ({ page, api }) => {
  const a = await api.newUser('report');
  const { c } = await scamCase(api, a);
  await signIn(page, a.email, a.password, `/cases/${c.id}?tab=reports`);
  await page.getByRole('button', { name: 'Сформировать отчёт' }).click();
  await expect(page.getByTestId('report-row')).toHaveCount(1);

  // Change the case after the report.
  await page.getByRole('button', { name: 'Изменить' }).click();
  await page.getByLabel('Название').fill('Переименовано после отчёта');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Переименовано после отчёта' })).toBeVisible();

  await page.getByTestId('report-row').getByRole('link').click();
  const report = page.getByTestId('report');
  await expect(report.getByRole('heading', { level: 1 })).toHaveText(c.title);
  await expect(report).toContainText('Re:Trace');
  await expect(report).toContainText('Сводка');
  const fingerprint = await page.getByTestId('fingerprint').innerText();
  expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  const id = Number(new URL(page.url()).pathname.split('/').pop());
  const api2 = await api.call('GET', `/cases/${c.id}/reports/${id}`, a.token);
  expect(api2.fingerprint).toBe(fingerprint);

  await page.evaluate(() => {
    (window as unknown as { printedAs: string[] }).printedAs = [];
    window.print = () => (window as unknown as { printedAs: string[] }).printedAs.push(document.title);
  });
  await page.getByRole('button', { name: 'Скачать PDF' }).click();
  expect(await page.evaluate(() => (window as unknown as { printedAs: string[] }).printedAs)).toEqual([`retrace-case-${c.id}-report-${id}`]);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Скачать PDF' })).toBeHidden();
});
