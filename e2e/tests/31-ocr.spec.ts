// #147 (#146) text from a screenshot is recognised in the browser by the real engine and opens in the
// evidence form for review; no request leaves the site (engine and models are served from /ocr/).
import { expect, signIn, test } from '../fixtures';

test('a screenshot becomes evidence text for review, without third-party requests', async ({ page, api, baseURL }) => {
  test.setTimeout(180_000); // the first run loads the engine and three language models
  const a = await api.newUser('ocr');
  const c = await api.createCase(a);
  await api.addEvidence(a, c.id, { content: 'Переписка с продавцом, скриншот приложен' });

  // A real PNG with Cyrillic text, drawn by the browser itself.
  const painter = await page.context().newPage();
  await painter.setContent('<p id="s" style="font:48px Arial,sans-serif;padding:24px;background:#fff;color:#000;width:900px">Переведите предоплату на карту<br>Доставка завтра</p>');
  const png = await painter.locator('#s').screenshot();
  await painter.close();

  // Every request during recognition, from the page and from the OCR worker.
  const seen: string[] = [];
  const origin = new URL(baseURL!).origin;
  let recording = false;
  page.context().on('request', (r) => recording && seen.push(r.url()));

  await signIn(page, a.email, a.password, `/cases/${c.id}?tab=evidence`);
  const row = page.getByTestId('evidence-row').first();
  await row.getByLabel('Прикрепить файл').setInputFiles({ name: 'chat.png', mimeType: 'image/png', buffer: png });
  await expect(row.getByText('chat.png')).toBeVisible();

  recording = true;
  await row.getByRole('button', { name: 'Распознать текст: chat.png' }).click();
  const content = page.getByLabel('Содержание');
  await expect(content).toBeVisible({ timeout: 150_000 });
  await expect(content).toHaveValue(/Переведите/i);
  await expect(content).toHaveValue(/предоплату/i);
  await expect(page.getByLabel('Источник')).toHaveValue('Скриншот «chat.png» (распознано)');
  recording = false;
  const http = seen.filter((u) => u.startsWith('http'));
  // The interface fonts (Google Fonts, allowed by the CSP) are not part of recognition; nothing else may leave the site.
  expect(http.filter((u) => !u.startsWith(origin) && !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u))).toEqual([]);
  expect(http.some((u) => u.startsWith(`${origin}/ocr/lang/rus.traineddata`))).toBe(true);

  // Nothing was saved: the case still has one piece of evidence until the person presses «Сохранить».
  await expect(page.getByTestId('evidence-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('evidence-row')).toHaveCount(2);
});
