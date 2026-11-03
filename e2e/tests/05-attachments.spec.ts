// #119 attach a file, see its SHA-256, download the same bytes, wrong type refused, delete.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, signIn, test } from '../fixtures';

test('a file is attached with its checksum and downloads unchanged', async ({ page, api }) => {
  const a = await api.newUser('files');
  const c = await api.createCase(a);
  await api.addEvidence(a, c.id, { content: 'Скриншот переписки приложен' });
  await signIn(page, a.email, a.password, `/cases/${c.id}?tab=evidence`);
  const row = page.getByTestId('evidence-row').first();
  const bytes = Buffer.from('Чек: перевод 45 000 ₸ на карту 4400 **** 1207\n', 'utf8');
  const sha = createHash('sha256').update(bytes).digest('hex');

  await row.getByLabel('Прикрепить файл').setInputFiles({ name: 'чек.txt', mimeType: 'text/plain', buffer: bytes });
  await expect(row.getByText('чек.txt')).toBeVisible();
  await expect(row.getByLabel(`SHA-256 ${sha}`)).toBeVisible();

  const download = page.waitForEvent('download');
  await row.getByRole('button', { name: 'чек.txt', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('чек.txt');
  expect(createHash('sha256').update(readFileSync(await file.path())).digest('hex')).toBe(sha);

  await row.getByLabel('Прикрепить файл').setInputFiles({ name: 'tool.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ\x90\x00') });
  await expect(page.getByText(/Этот тип файла нельзя прикрепить/)).toBeVisible();

  await row.getByRole('button', { name: 'Удалить чек.txt' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
  await expect(row.getByText('чек.txt')).toHaveCount(0);
});
