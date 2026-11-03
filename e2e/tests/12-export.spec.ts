// #126 JSON and CSV export from the case header.
import { readFileSync } from 'node:fs';
import { expect, scamCase, signIn, test } from '../fixtures';

test('exports the case as JSON and the evidence as CSV with a BOM', async ({ page, api }) => {
  const a = await api.newUser('export');
  const { c } = await scamCase(api, a);
  await signIn(page, a.email, a.password, `/cases/${c.id}`);

  const json = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт JSON' }).click();
  const jf = await json;
  expect(jf.suggestedFilename()).toBe(`retrace-case-${c.id}.json`);
  const data = JSON.parse(readFileSync(await jf.path(), 'utf8'));
  expect(data.format).toBe('retrace-case/1');
  expect(data.case.title).toBe(c.title);
  expect(data.evidence).toHaveLength(3);

  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт CSV' }).click();
  const cf = await csv;
  expect(cf.suggestedFilename()).toBe(`retrace-case-${c.id}-evidence.csv`);
  const bytes = readFileSync(await cf.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const lines = bytes.toString('utf8').slice(1).trim().split(/\r\n/);
  expect(lines[0]).toBe('id,observed_on,type,verification,source,amount,content');
  expect(lines).toHaveLength(4);
});
