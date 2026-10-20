// Drives the real HTTP API; every response is validated against openapi.yml.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { DEMO_PASSWORD } from '../src/domain/seedData.js';
import { loadContract } from './contract.js';
import { NOW, REPOSITORIES, setup } from './helpers.js';

for (const [kind, makeRepo] of Object.entries(REPOSITORIES)) {
  describe(`API (${kind})`, () => {
    let server, base, ctx, contract;
    const tokens = {};

    before(async () => {
      ctx = await setup(makeRepo);
      contract = await loadContract();
      const app = createApp({ repo: ctx.repo, now: () => NOW });
      await new Promise((resolve) => (server = app.listen(0, resolve)));
      base = `http://localhost:${server.address().port}/api/v1`;
      for (const [k, email] of [['aigerim', 'aigerim@retrace.test'], ['daniyar', 'daniyar@retrace.test'], ['admin', 'admin@retrace.test']]) {
        tokens[k] = (await call('POST', '/auth/login', { body: { email, password: DEMO_PASSWORD } })).data.token;
      }
    });
    after(async () => {
      server.close();
      await ctx.repo.close();
    });

    async function call(method, path, { body, token, raw } = {}) {
      const res = await fetch(base + path, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : undefined;
      contract.check(method, `/api/v1${path}`, res.status, data);
      return { status: res.status, data };
    }

    it('auth: register, login, me, logout, errors', async () => {
      const reg = await call('POST', '/auth/register', { body: { email: 'new@retrace.test', password: 'long-enough', name: 'Новый' } });
      assert.equal(reg.status, 201);
      assert.equal('passwordHash' in reg.data.user, false);
      assert.equal((await call('POST', '/auth/register', { body: { email: 'new@retrace.test', password: 'long-enough', name: 'X2' } })).data.error.code, 'email_taken');
      assert.equal((await call('POST', '/auth/register', { body: { email: 'x@retrace.test', password: 'short', name: 'X2' } })).status, 400);
      assert.equal((await call('POST', '/auth/login', { body: { email: 'new@retrace.test', password: 'wrong-pass' } })).data.error.code, 'invalid_credentials');
      assert.equal((await call('GET', '/me', { token: reg.data.token })).data.email, 'new@retrace.test');
      assert.equal((await call('POST', '/auth/logout', { token: reg.data.token })).status, 204);
      assert.equal((await call('GET', '/me', { token: reg.data.token })).status, 401);
      assert.equal((await call('GET', '/cases')).data.error.code, 'unauthorized');
      assert.equal((await call('POST', '/auth/logout')).status, 401);
    });

    it('a full investigation over HTTP', async () => {
      const t = tokens.aigerim;
      assert.equal((await call('GET', '/cases?q=OLX&sort=risk', { token: t })).data.length, 1);
      assert.equal((await call('GET', '/cases?sort=nope', { token: t })).status, 400);
      const c = (await call('POST', '/cases', { token: t, body: { title: 'Лотерея в Instagram', description: 'Выигрыш за «налог»' } })).data;
      assert.equal((await call('POST', '/cases', { token: t, body: { title: 'AB' } })).status, 400);
      const m = (await call('POST', `/cases/${c.id}/evidence`, { token: t, body: { type: 'message', content: 'Срочно оплатите налог на выигрыш, пришлите код из SMS', verification: 'confirmed', observedOn: '2026-10-19' } })).data;
      const l = (await call('POST', `/cases/${c.id}/evidence`, { token: t, body: { type: 'link', content: 'https://bit.ly/prize-kz' } })).data;
      assert.equal((await call('PATCH', `/cases/${c.id}/evidence/${l.id}`, { token: t, body: { verification: 'disputed' } })).data.verification, 'disputed');
      const a = (await call('POST', `/cases/${c.id}/entities`, { token: t, body: { type: 'account', label: '@prize_kz' } })).data;
      const w = (await call('POST', `/cases/${c.id}/entities`, { token: t, body: { type: 'wallet', label: 'USDT TRC20 T9yD…' } })).data;
      assert.equal((await call('PATCH', `/cases/${c.id}/entities/${w.id}`, { token: t, body: { note: 'указан в сообщении' } })).data.note, 'указан в сообщении');
      const r = (await call('POST', `/cases/${c.id}/relationships`, { token: t, body: { sourceId: a.id, targetId: w.id, type: 'owns', evidenceIds: [m.id] } })).data;
      assert.equal((await call('POST', `/cases/${c.id}/relationships`, { token: t, body: { sourceId: a.id, targetId: a.id, type: 'owns' } })).data.error.code, 'invalid_relationship');
      assert.equal((await call('GET', `/cases/${c.id}/relationships`, { token: t })).data.length, 1);
      assert.equal((await call('GET', `/cases/${c.id}/graph`, { token: t })).data.edges.length, 1);
      const risk = (await call('GET', `/cases/${c.id}/risk`, { token: t })).data;
      assert.deepEqual(risk.rules.map((x) => x.id), ['credential_request', 'urgent_payment', 'suspicious_link', 'personal_payment', 'disputed_evidence']);
      assert.equal(risk.score, 90);
      const rep = await call('POST', `/cases/${c.id}/reports`, { token: t });
      assert.equal(rep.status, 201);
      assert.equal((await call('GET', `/cases/${c.id}/reports`, { token: t })).data.length, 1);
      await call('DELETE', `/cases/${c.id}/relationships/${r.id}`, { token: t });
      await call('DELETE', `/cases/${c.id}/entities/${w.id}`, { token: t });
      assert.equal((await call('DELETE', `/cases/${c.id}/evidence/${l.id}`, { token: t })).status, 204);
      assert.equal((await call('GET', `/cases/${c.id}/reports/${rep.data.id}`, { token: t })).data.snapshot.evidence.length, 2);
      assert.equal((await call('PATCH', `/cases/${c.id}`, { token: t, body: { status: 'archived' } })).data.status, 'archived');
      assert.equal((await call('POST', `/cases/${c.id}/entities`, { token: t, body: { type: 'person', label: 'x' } })).data.error.code, 'case_locked');
      assert.equal((await call('PATCH', `/cases/${c.id}`, { token: t, body: { title: 'Новое' } })).status, 409);
      assert.equal((await call('GET', `/cases/${c.id}`, { token: t })).data.title, 'Лотерея в Instagram');
    });

    it('never shows one investigator another investigator’s case', async () => {
      const bank = ctx.bank.id;
      const before = (await call('GET', `/cases/${bank}`, { token: tokens.daniyar })).data;
      const probes = [
        ['GET', `/cases/${bank}`],
        ['PATCH', `/cases/${bank}`, { title: 'Взлом' }],
        ['GET', `/cases/${bank}/evidence`],
        ['POST', `/cases/${bank}/evidence`, { type: 'observation', content: 'x' }],
        ['PATCH', `/cases/${bank}/evidence/1`, { content: 'x' }],
        ['DELETE', `/cases/${bank}/evidence/1`],
        ['GET', `/cases/${bank}/entities`],
        ['POST', `/cases/${bank}/entities`, { type: 'person', label: 'x' }],
        ['GET', `/cases/${bank}/relationships`],
        ['GET', `/cases/${bank}/graph`],
        ['GET', `/cases/${bank}/risk`],
        ['GET', `/cases/${bank}/reports`],
        ['POST', `/cases/${bank}/reports`],
      ];
      for (const [method, path, body] of probes) {
        const res = await call(method, path, { token: tokens.aigerim, body });
        assert.equal(res.status, 404, `${method} ${path}`);
      }
      const afterProbe = (await call('GET', `/cases/${bank}`, { token: tokens.daniyar })).data;
      assert.deepEqual(afterProbe, before);
      assert.equal((await call('GET', '/cases', { token: tokens.aigerim })).data.some((c) => c.id === bank), false);
    });

    it('lets admins read everything but not change other people’s cases', async () => {
      const bank = ctx.bank.id;
      assert.equal((await call('GET', `/cases/${bank}`, { token: tokens.admin })).status, 200);
      assert.equal((await call('GET', `/cases/${bank}/risk`, { token: tokens.admin })).status, 200);
      assert.equal((await call('GET', `/cases/${bank}/graph`, { token: tokens.admin })).status, 200);
      const evidenceBefore = (await call('GET', `/cases/${bank}/evidence`, { token: tokens.admin })).data.length;
      assert.equal((await call('PATCH', `/cases/${bank}`, { token: tokens.admin, body: { status: 'closed' } })).status, 403);
      assert.equal((await call('POST', `/cases/${bank}/evidence`, { token: tokens.admin, body: { type: 'observation', content: 'x' } })).status, 403);
      assert.equal((await call('POST', `/cases/${bank}/reports`, { token: tokens.admin })).status, 403);
      assert.equal((await call('GET', `/cases/${bank}/evidence`, { token: tokens.admin })).data.length, evidenceBefore);
      assert.equal((await call('GET', `/cases/${bank}`, { token: tokens.admin })).data.status, 'open');
    });

    it('admin endpoints', async () => {
      for (const path of ['/admin/stats', '/admin/cases', '/admin/users', '/admin/audit-events']) {
        assert.equal((await call('GET', path, { token: tokens.aigerim })).status, 403, path);
      }
      assert.equal((await call('GET', '/admin/stats', { token: tokens.admin })).data.users >= 3, true);
      assert.ok((await call('GET', '/admin/cases?status=open&sort=risk', { token: tokens.admin })).data.length >= 1);
      const users = (await call('GET', '/admin/users', { token: tokens.admin })).data;
      const admin = users.find((u) => u.role === 'admin');
      assert.equal((await call('PATCH', `/admin/users/${admin.id}`, { token: tokens.admin, body: { role: 'investigator' } })).data.error.code, 'last_admin');
      assert.equal((await call('PATCH', `/admin/users/99999`, { token: tokens.admin, body: { role: 'admin' } })).status, 404);
      assert.equal((await call('PATCH', `/admin/users/${admin.id}`, { token: tokens.admin, body: { role: 'boss' } })).status, 400);
      const log = (await call('GET', `/admin/audit-events?caseId=${ctx.job.id}&limit=5`, { token: tokens.admin })).data;
      assert.ok(log.every((e) => e.caseId === ctx.job.id));
      const full = JSON.stringify((await call('GET', '/admin/audit-events?limit=500', { token: tokens.admin })).data);
      assert.equal(full.includes(DEMO_PASSWORD) || full.includes('scrypt$') || full.includes(tokens.aigerim), false);
    });

    it('rejects bad JSON and unknown endpoints with the Error schema', async () => {
      assert.equal((await call('POST', '/cases', { token: tokens.aigerim, raw: '{' })).data.error.code, 'validation_error');
      const nf = await fetch(`${base}/nope`, { headers: { authorization: `Bearer ${tokens.aigerim}` } });
      assert.equal(nf.status, 404);
    });

    it('covers every operation in the contract', () => {
      const seen = new Set(contract.seen().map((s) => s.split(' ').slice(0, 2).join(' ')));
      assert.deepEqual(contract.operations().filter((op) => !seen.has(op)), []);
    });
  });
}
