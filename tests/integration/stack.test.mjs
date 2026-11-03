// #109 integration tests against a running stack (Docker Compose in CI): the built frontend is served,
// the backend talks to the database, and data survives a restart (RESTARTED=1 run).
// Usage: BASE_URL=http://localhost:3200 node --test tests/integration/
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3200').replace(/\/$/, '');
const API = `${BASE}/api/v1`;
const EXPECT_STORAGE = process.env.EXPECT_STORAGE ?? 'sql:postgres';

async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : undefined };
}
const login = async (email = 'aigerim@retrace.test', password = 'demo-password') => (await call('POST', '/auth/login', { body: { email, password } })).data.token;

describe('stack', () => {
  it('serves the built frontend with hashed assets', async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    assert.match(html, /<div id="root">/);
    const js = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
    assert.ok(js, 'index.html references a built script');
    const asset = await fetch(BASE + js);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    assert.equal((await fetch(`${BASE}/cases/1`)).status, 200, 'client-side routes fall back to index.html');
    assert.equal((await fetch(`${BASE}/manifest.webmanifest`)).headers.get('content-type')?.split(';')[0], 'application/manifest+json');
  });

  it('reports the expected database and version', async () => {
    const { status, data } = await call('GET', '/health');
    assert.equal(status, 200);
    assert.equal(data.storage, EXPECT_STORAGE);
    assert.match(data.version, /^\d+\.\d+\.\d+$/);
  });

  it('writes through the API into the database and reads it back', { skip: process.env.RESTARTED === '1' }, async () => {
    const t = await login();
    const c = (await call('POST', '/cases', { token: t, body: { title: 'Интеграционный тест', description: 'persist-check' } })).data;
    const ev = await call('POST', `/cases/${c.id}/evidence`, { token: t, body: { type: 'payment', content: 'Перевод 9 900 ₸', amount: 9900 } });
    assert.equal(ev.status, 201);
    const file = await call('POST', `/cases/${c.id}/evidence/${ev.data.id}/attachments`, { token: t, body: { filename: 'note.txt', mimeType: 'text/plain', dataBase64: Buffer.from('интеграция').toString('base64') } });
    assert.equal(file.status, 201);
    const again = (await call('GET', `/cases/${c.id}`, { token: t })).data;
    assert.equal(again.evidenceCount, 1);
    assert.equal((await call('GET', `/cases/${c.id}/evidence`, { token: t })).data[0].attachments[0].sha256, file.data.sha256);
  });

  it('keeps data after the stack restarts', { skip: process.env.RESTARTED !== '1' }, async () => {
    const t = await login();
    const found = (await call('GET', '/cases?q=persist-check', { token: t })).data;
    assert.equal(found.length >= 1, true, 'the case written before the restart is still there');
    const evidence = (await call('GET', `/cases/${found[0].id}/evidence`, { token: t })).data;
    assert.equal(evidence[0].attachments.length, 1);
  });

  it('enforces access across users on the real database', async () => {
    const aigerim = await login();
    const daniyar = await login('daniyar@retrace.test');
    const mine = (await call('GET', '/cases', { token: aigerim })).data[0];
    assert.equal((await call('GET', `/cases/${mine.id}`, { token: daniyar })).status, 404);
  });
});
