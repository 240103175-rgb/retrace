// v1.1 group B: domain features, on every repository; HTTP for new endpoints.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { nodeDeps } from '../src/crypto.js';
import { createServices, toCsv } from '../src/domain/services.js';
import { DEMO_PASSWORD } from '../src/domain/seedData.js';
import { loadContract } from './contract.js';
import { NOW, REPOSITORIES, setup } from './helpers.js';

const rejects = (p, code) => assert.rejects(p, (e) => e.code === code);
const DAY = 24 * 3600 * 1000;

for (const [kind, makeRepo] of Object.entries(REPOSITORIES)) {
  describe(`v1.1 features (${kind})`, () => {
    it('#44 filters evidence by text, type and verification', async () => {
      const { svc, users, olx, job } = await setup(makeRepo);
      assert.equal((await svc.listEvidence(users.aigerim, olx.id, { q: 'КОД' })).length, 1);
      assert.equal((await svc.listEvidence(users.aigerim, job.id, { type: 'link', verification: 'confirmed' })).length, 1);
      assert.equal((await svc.listEvidence(users.aigerim, job.id, { q: 'telegram' })).length, 1);
      await rejects(svc.listEvidence(users.aigerim, job.id, { type: 'video' }), 'validation_error');
    });

    it('#45 #46 refuses duplicate entities and relationships', async () => {
      const { svc, users, job } = await setup(makeRepo);
      await rejects(svc.createEntity(users.aigerim, job.id, { type: 'account', label: '  @HR_manager_astana ' }), 'duplicate_entity');
      assert.ok(await svc.createEntity(users.aigerim, job.id, { type: 'person', label: '@hr_manager_astana' }));
      const [a, b] = await svc.listEntities(users.aigerim, job.id);
      await rejects(svc.updateEntity(users.aigerim, job.id, b.id, { type: a.type, label: a.label }), 'duplicate_entity');
      const rels = await svc.listRelationships(users.aigerim, job.id);
      const r = rels[0];
      await rejects(svc.createRelationship(users.aigerim, job.id, { sourceId: r.sourceId, targetId: r.targetId, type: r.type }), 'duplicate_relationship');
      assert.ok(await svc.createRelationship(users.aigerim, job.id, { sourceId: r.targetId, targetId: r.sourceId, type: r.type }));
    });

    it('#47 #48 tags and notes, filtered, locked with the case, in reports', async () => {
      const { svc, users, job, olx } = await setup(makeRepo);
      const c = await svc.updateCase(users.aigerim, job.id, { tags: [' Telegram ', 'telegram', 'Вакансия'], notes: 'Проверить номер' });
      assert.deepEqual(c.tags, ['telegram', 'вакансия']);
      assert.equal(c.notes, 'Проверить номер');
      assert.deepEqual((await svc.getCase(users.aigerim, job.id)).tags, ['telegram', 'вакансия']);
      assert.deepEqual((await svc.listCases(users.aigerim, { tag: 'TELEGRAM' })).map((x) => x.id), [job.id]);
      assert.equal((await svc.adminCases(users.admin, { tag: 'вакансия' })).length, 1);
      assert.deepEqual((await svc.getCase(users.aigerim, olx.id)).tags, []);
      for (const tags of [Array.from({ length: 11 }, (_, i) => `t${i}`), ['x'.repeat(31)], ['<b>'], 'telegram']) {
        await rejects(svc.updateCase(users.aigerim, job.id, { tags }), 'validation_error');
      }
      await rejects(svc.updateCase(users.aigerim, job.id, { notes: 'x'.repeat(5001) }), 'validation_error');
      const rep = await svc.createReport(users.aigerim, job.id);
      assert.equal(rep.snapshot.case.notes, 'Проверить номер');
      await svc.updateCase(users.aigerim, job.id, { status: 'closed' });
      await rejects(svc.updateCase(users.aigerim, job.id, { tags: ['x'] }), 'case_locked');
      await rejects(svc.updateCase(users.aigerim, job.id, { notes: 'y' }), 'case_locked');
    });

    it('#49 confirmed evidence needs a source', async () => {
      const { svc, users, job } = await setup(makeRepo);
      await rejects(svc.createEvidence(users.aigerim, job.id, { type: 'observation', content: 'x', verification: 'confirmed' }), 'validation_error');
      const e = await svc.createEvidence(users.aigerim, job.id, { type: 'observation', content: 'x' });
      await rejects(svc.updateEvidence(users.aigerim, job.id, e.id, { verification: 'confirmed' }), 'validation_error');
      assert.equal((await svc.updateEvidence(users.aigerim, job.id, e.id, { verification: 'confirmed', source: 'Звонок' })).verification, 'confirmed');
      await rejects(svc.updateEvidence(users.aigerim, job.id, e.id, { source: '' }), 'validation_error');
    });

    it('#52 report list shows each snapshot score', async () => {
      const { svc, users, olx } = await setup(makeRepo);
      await svc.createReport(users.aigerim, olx.id);
      await svc.createEvidence(users.aigerim, olx.id, { type: 'message', content: 'Установите AnyDesk для возврата' });
      await svc.createReport(users.aigerim, olx.id);
      const [newest, oldest] = await svc.listReports(users.aigerim, olx.id);
      assert.equal(oldest.riskScore, 45);
      assert.equal(newest.riskScore, 65);
      assert.equal(newest.riskLevel, 'high');
    });

    it('#55 #56 #57 profile, password change and sign-out everywhere', async () => {
      const { svc, repo } = await setup(makeRepo);
      const s1 = await svc.login({ email: 'aigerim@retrace.test', password: DEMO_PASSWORD });
      const s2 = await svc.login({ email: 'aigerim@retrace.test', password: DEMO_PASSWORD });
      const me = await repo.findUserById(s1.user.id);
      assert.equal((await svc.updateMe(me, { name: 'Айгерим Н.' })).name, 'Айгерим Н.');
      await rejects(svc.updateMe(me, { name: 'A' }), 'validation_error');
      await rejects(svc.changePassword(me, s1.token, { currentPassword: 'wrong', newPassword: 'new-password-1' }), 'wrong_password');
      await rejects(svc.changePassword(me, s1.token, { currentPassword: DEMO_PASSWORD, newPassword: 'short' }), 'validation_error');
      await svc.changePassword(me, s1.token, { currentPassword: DEMO_PASSWORD, newPassword: 'new-password-1' });
      assert.ok(await svc.userFromToken(s1.token));
      assert.equal(await svc.userFromToken(s2.token), null);
      await rejects(svc.login({ email: 'aigerim@retrace.test', password: DEMO_PASSWORD }), 'invalid_credentials');
      const s3 = await svc.login({ email: 'aigerim@retrace.test', password: 'new-password-1' });
      await svc.logoutAll(await repo.findUserById(me.id));
      assert.equal(await svc.userFromToken(s1.token), null);
      assert.equal(await svc.userFromToken(s3.token), null);
      const log = JSON.stringify(await svc.adminAudit(await repo.findUserByEmail('admin@retrace.test'), { action: 'user.password' }));
      assert.ok(log.includes('user.password'));
      assert.equal(log.includes('new-password-1') || log.includes(DEMO_PASSWORD), false);
    });

    it('#58 disables and enables accounts with guards', async () => {
      const { svc, users, repo } = await setup(makeRepo);
      const s = await svc.login({ email: 'daniyar@retrace.test', password: DEMO_PASSWORD });
      const d = await svc.adminSetRole(users.admin, users.daniyar.id, { disabled: true });
      assert.equal(d.disabled, true);
      assert.equal(await svc.userFromToken(s.token), null);
      await rejects(svc.login({ email: 'daniyar@retrace.test', password: DEMO_PASSWORD }), 'account_disabled');
      await svc.adminSetRole(users.admin, users.daniyar.id, { disabled: false });
      assert.ok(await svc.login({ email: 'daniyar@retrace.test', password: DEMO_PASSWORD }));
      await rejects(svc.adminSetRole(users.admin, users.admin.id, { disabled: true }), 'self_action');
      await svc.adminSetRole(users.admin, users.daniyar.id, { role: 'admin' });
      const daniyar = await repo.findUserById(users.daniyar.id);
      await svc.adminSetRole(daniyar, users.admin.id, { disabled: true });
      await rejects(svc.adminSetRole(daniyar, users.daniyar.id, { role: 'investigator' }), 'last_admin');
      await rejects(svc.adminSetRole(daniyar, users.daniyar.id, {}), 'validation_error');
    });

    it('#59 #60 audit filters and 7-day statistics', async () => {
      let now = 1_800_000_000_000;
      const { repo, users } = await setup(makeRepo);
      const svc = createServices(repo, nodeDeps(() => now));
      const created = await svc.createCase(users.aigerim, { title: 'Новое дело' });
      await svc.createEvidence(users.aigerim, created.id, { type: 'observation', content: 'x' });
      const ev = await svc.adminAudit(users.admin, { action: 'evidence.' });
      assert.ok(ev.length >= 1 && ev.every((e) => e.action.startsWith('evidence.')));
      assert.ok((await svc.adminAudit(users.admin, { actorId: users.aigerim.id })).every((e) => e.actorId === users.aigerim.id));
      const stats = await svc.adminStats(users.admin);
      assert.equal(stats.casesLast7Days, 1); // demo cases are seeded relative to the test NOW, far in the past here
      now = NOW + 2 * DAY;
      assert.equal((await createServices(repo, nodeDeps(() => now)).adminStats(users.admin)).casesLast7Days, 3);
    });
  });
}

describe('#54 CSV quoting', () => {
  it('quotes commas, quotes and newlines and adds a BOM', () => {
    const csv = toCsv([['a', 'b'], ['x, y', 'say "hi"\nnext']]);
    assert.equal(csv, '﻿a,b\r\n"x, y","say ""hi""\nnext"\r\n');
  });
});

describe('v1.1 endpoints over HTTP (#53 #54 #55 #56 #57)', () => {
  let server, base, ctx, contract, token, other;
  before(async () => {
    ctx = await setup();
    contract = await loadContract();
    const app = createApp({ repo: ctx.repo, now: () => NOW, log: false });
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://localhost:${server.address().port}/api/v1`;
    const login = async (email) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: DEMO_PASSWORD }) })).json()).token;
    token = await login('aigerim@retrace.test');
    other = await login('daniyar@retrace.test');
  });
  after(() => server.close());
  async function call(method, path, { body, auth = token } = {}) {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${auth}` }, body: body && JSON.stringify(body) });
    const isJson = res.headers.get('content-type')?.includes('json');
    const data = res.status === 204 ? undefined : isJson ? await res.json() : await res.text();
    contract.check(method, `/api/v1${path}`, res.status, data);
    return { res, data };
  }

  it('exports a case as JSON and evidence as CSV, with access rules', async () => {
    const { res, data } = await call('GET', `/cases/${ctx.job.id}/export`);
    assert.match(res.headers.get('content-disposition'), new RegExp(`attachment; filename="retrace-case-${ctx.job.id}\\.json"`));
    assert.equal(data.format, 'retrace-case/1');
    assert.equal(data.evidence.length, 4);
    assert.equal(data.risk.score, 65);
    const csv = await call('GET', `/cases/${ctx.job.id}/evidence.csv`);
    assert.match(csv.res.headers.get('content-type'), /^text\/csv; charset=utf-8/);
    assert.match(csv.res.headers.get('content-disposition'), /retrace-case-\d+-evidence\.csv/);
    const raw = new Uint8Array(await (await fetch(`${base}/cases/${ctx.job.id}/evidence.csv`, { headers: { authorization: `Bearer ${token}` } })).arrayBuffer());
    assert.deepEqual([...raw.slice(0, 3)], [0xef, 0xbb, 0xbf]); // UTF-8 BOM (fetch().text() strips it)
    assert.ok(csv.data.startsWith('id,observed_on,type,verification,source,amount,content\r\n'));
    assert.equal(csv.data.trim().split('\r\n').length, 5);
    assert.equal((await call('GET', `/cases/${ctx.job.id}/export`, { auth: other })).res.status, 404);
    assert.equal((await call('GET', `/cases/${ctx.job.id}/evidence.csv`, { auth: other })).res.status, 404);
  });

  it('profile name, password and sign-out everywhere', async () => {
    assert.equal((await call('PATCH', '/me', { body: { name: 'Айгерим' } })).data.name, 'Айгерим');
    assert.equal((await call('PATCH', '/me', { body: { name: 'A' } })).res.status, 400);
    assert.equal((await call('POST', '/me/password', { body: { currentPassword: 'nope', newPassword: 'another-pass' } })).data.error.code, 'wrong_password');
    assert.equal((await call('POST', '/me/password', { body: { currentPassword: DEMO_PASSWORD, newPassword: 'another-pass' } })).res.status, 204);
    assert.equal((await call('POST', '/auth/logout-all')).res.status, 204);
    assert.equal((await call('GET', '/me')).res.status, 401);
  });

  it('filters evidence over HTTP', async () => {
    const { data } = await call('GET', `/cases/${ctx.job.id}/evidence?type=payment`, { auth: other === token ? token : (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@retrace.test', password: DEMO_PASSWORD }) })).json()).token });
    assert.equal(data.length, 1);
  });
});
