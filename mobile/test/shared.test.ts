// #28 the mobile app uses the web app's API client (no copy) and talks to the real API contract.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

test('imports the API client from the web app instead of copying it', () => {
  const api = readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8');
  assert.match(api, /from '\.\.\/\.\.\/frontend\/src\/services\/httpService'/);
  const own = readdirSync(new URL('../src', import.meta.url));
  assert.equal(own.some((f) => /httpService|types\.ts/.test(f)), false);
});

test('formats money and keeps the risk disclaimer', async () => {
  const { money, DISCLAIMER, errorText } = await import('../src/text.ts');
  assert.equal(money(45000), '45 000 ₸');
  assert.match(DISCLAIMER, /не доказательство/);
  assert.equal(errorText('invalid_credentials'), 'Неверный email или пароль');
  assert.equal(errorText('something_new'), 'Ошибка сервера. Повторите позже.');
});

