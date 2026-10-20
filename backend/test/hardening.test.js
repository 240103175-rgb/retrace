// v1.1 group A: health, headers, request log, 415, login limit, pagination, config, migrations.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { DataTypes, Sequelize } from 'sequelize';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { nodeDeps } from '../src/crypto.js';
import { createServices, LOGIN_WINDOW_MS } from '../src/domain/services.js';
import { DEMO_PASSWORD } from '../src/domain/seedData.js';
import { createSqlRepository } from '../src/repositories/sql.js';
import { loadContract } from './contract.js';
import { NOW, setup } from './helpers.js';

describe('HTTP hardening (#33 #34 #35 #41 #42 #43)', () => {
  let server, base, ctx, contract, token;
  const lines = [];
  before(async () => {
    ctx = await setup();
    contract = await loadContract();
    const app = createApp({ repo: ctx.repo, now: () => NOW, log: (l) => lines.push(l) });
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://localhost:${server.address().port}`;
    const res = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@retrace.test', password: DEMO_PASSWORD }) });
    token = (await res.json()).token;
  });
  after(() => server.close());
  const get = async (path, auth = true) => {
    const res = await fetch(base + path, { headers: auth ? { authorization: `Bearer ${token}` } : {} });
    const body = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    if (path.startsWith('/api/v1/')) contract.check('GET', path, res.status, body);
    return { res, body };
  };

  it('#33 health is public and names the storage', async () => {
    const { res, body } = await get('/api/v1/health', false);
    assert.equal(res.status, 200);
    assert.deepEqual(body, { status: 'ok', storage: 'memory', version: '1.1.0' });
  });

  it('#34 security headers on API responses', async () => {
    const { res } = await get('/api/v1/health', false);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'.*frame-ancestors 'none'/);
  });

  it('#35 request log has method, path, status and time — no query, token or password', async () => {
    await get('/api/v1/cases?q=secret-query');
    const all = lines.join('\n');
    assert.match(all, /\[req\] POST \/api\/v1\/auth\/login 200 \d+ms/);
    assert.match(all, /\[req\] GET \/api\/v1\/cases 200 \d+ms/);
    assert.equal(all.includes(DEMO_PASSWORD) || all.includes(token) || all.includes('secret-query') || all.includes('?'), false);
  });

  it('#41 non-JSON bodies get 415 and nothing is written', async () => {
    const before = (await get('/api/v1/admin/cases')).body.length;
    const res = await fetch(`${base}/api/v1/cases`, { method: 'POST', headers: { 'content-type': 'text/plain', authorization: `Bearer ${token}` }, body: 'title=x' });
    const body = await res.json();
    contract.check('POST', '/api/v1/cases', res.status, body);
    assert.equal(res.status, 415);
    assert.equal(body.error.code, 'unsupported_media_type');
    assert.equal((await get('/api/v1/admin/cases')).body.length, before);
    const out = await fetch(`${base}/api/v1/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    assert.equal(out.status, 204);
  });
});

describe('pagination (#42 #43)', () => {
  it('pages the audit log and case lists, rejecting bad values', async () => {
    const { svc, users } = await setup();
    await svc.login({ email: 'aigerim@retrace.test', password: DEMO_PASSWORD });
    const all = await svc.adminAudit(users.admin, { limit: 4 });
    const page2 = await svc.adminAudit(users.admin, { limit: 2, offset: 2 });
    assert.deepEqual(page2.map((e) => e.id), all.slice(2, 4).map((e) => e.id));
    await assert.rejects(svc.adminAudit(users.admin, { offset: -1 }), (e) => e.code === 'validation_error');
    const cases = await svc.listCases(users.aigerim, { sort: 'title' });
    assert.deepEqual((await svc.listCases(users.aigerim, { sort: 'title', limit: 1, offset: 1 })).map((c) => c.id), [cases[1].id]);
    assert.equal((await svc.adminCases(users.admin, { limit: 1 })).length, 1);
    for (const limit of [0, 101, 'x']) await assert.rejects(svc.listCases(users.aigerim, { limit }), (e) => e.code === 'validation_error');
  });
});

describe('login attempt limit (#39)', () => {
  it('blocks after 5 failures for 15 minutes, resets on success, counts unknown emails', async () => {
    let now = NOW;
    const { repo } = await setup();
    const svc = createServices(repo, nodeDeps(() => now));
    const bad = () => svc.login({ email: 'aigerim@retrace.test', password: 'nope-nope' });
    for (let i = 0; i < 4; i++) await assert.rejects(bad(), (e) => e.code === 'invalid_credentials');
    assert.ok(await svc.login({ email: 'aigerim@retrace.test', password: DEMO_PASSWORD }));
    for (let i = 0; i < 5; i++) await assert.rejects(bad(), (e) => e.code === 'invalid_credentials');
    await assert.rejects(svc.login({ email: 'aigerim@retrace.test', password: DEMO_PASSWORD }), (e) => e.code === 'too_many_attempts' && e.status === 429);
    now += LOGIN_WINDOW_MS;
    assert.ok(await svc.login({ email: 'aigerim@retrace.test', password: DEMO_PASSWORD }));
    for (let i = 0; i < 5; i++) await assert.rejects(svc.login({ email: 'ghost@retrace.test', password: 'x' }), (e) => e.code === 'invalid_credentials');
    await assert.rejects(svc.login({ email: 'ghost@retrace.test', password: 'x' }), (e) => e.code === 'too_many_attempts');
  });
});

describe('configuration (#37)', () => {
  it('validates PORT and STORAGE with defaults', () => {
    assert.deepEqual(loadConfig({}), { port: 3200, storage: 'sql', databaseUrl: 'sqlite:data/retrace.db', production: false });
    assert.equal(loadConfig({ PORT: '8080', STORAGE: 'memory' }).port, 8080);
    assert.throws(() => loadConfig({ PORT: 'abc' }), /PORT must be an integer 1–65535/);
    assert.throws(() => loadConfig({ PORT: '0' }), /PORT/);
    assert.throws(() => loadConfig({ PORT: '70000' }), /PORT/);
    assert.throws(() => loadConfig({ STORAGE: 'redis' }), /STORAGE must be "sql" or "memory"/);
  });
});

describe('migrations (#38)', () => {
  it('adds the v1.1 columns to a v1.0 database and keeps its rows', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'retrace-mig-')), 'old.db');
    const old = new Sequelize({ dialect: 'sqlite', storage: file, logging: false });
    const ms = () => ({ type: DataTypes.BIGINT, allowNull: false });
    const U = old.define('User', { email: DataTypes.STRING, name: DataTypes.STRING, role: DataTypes.STRING, passwordHash: DataTypes.STRING, createdAt: ms() }, { tableName: 'users', timestamps: false });
    const C = old.define('Case', { ownerId: DataTypes.INTEGER, title: DataTypes.STRING, description: DataTypes.TEXT, status: DataTypes.STRING, createdAt: ms(), updatedAt: ms() }, { tableName: 'cases', timestamps: false });
    await old.sync();
    const u = await U.create({ email: 'old@retrace.test', name: 'Старый', role: 'investigator', passwordHash: 'x', createdAt: 1 });
    await C.create({ ownerId: u.id, title: 'Старое дело', description: '', status: 'open', createdAt: 1, updatedAt: 1 });
    await old.close();

    const repo = await createSqlRepository(`sqlite:${file}`);
    const [c] = await repo.listCases({});
    assert.equal(c.title, 'Старое дело');
    assert.deepEqual(c.tags, []);
    assert.equal(c.notes, null);
    assert.equal((await repo.findUserByEmail('old@retrace.test')).disabled, false);
    await repo.close();
    const again = await createSqlRepository(`sqlite:${file}`);
    assert.equal((await again.listCases({})).length, 1);
    await again.close();
  });
});
