// Iteration 5: data survives a restart; the database rejects broken references.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { nodeDeps } from '../src/crypto.js';
import { DEMO_PASSWORD, seed } from '../src/domain/seedData.js';
import { createServices } from '../src/domain/services.js';
import { createSqlRepository } from '../src/repositories/sql.js';
import { NOW } from './helpers.js';

const fileUrl = () => `sqlite:${join(mkdtempSync(join(tmpdir(), 'retrace-')), 'test.db')}`;

describe('persistence (SQLite file)', () => {
  it('keeps everything after the database is reopened, and seeds only once', async () => {
    const url = fileUrl();
    const deps = nodeDeps(() => NOW);
    let repo = await createSqlRepository(url);
    assert.equal(await seed(repo, { hashPassword: deps.hashPassword, now: NOW }), true);
    let svc = createServices(repo, deps);
    const me = (await svc.login({ email: 'aigerim@retrace.test', password: DEMO_PASSWORD })).user;
    const user = await repo.findUserById(me.id);
    const c = await svc.createCase(user, { title: 'Перезапуск', description: 'проверка' });
    const e = await svc.createEvidence(user, c.id, { type: 'message', content: 'Пришлите код', verification: 'confirmed', observedOn: '2026-10-19' });
    const a = await svc.createEntity(user, c.id, { type: 'account', label: '@a' });
    const b = await svc.createEntity(user, c.id, { type: 'card', label: '4400 ****' });
    const rel = await svc.createRelationship(user, c.id, { sourceId: a.id, targetId: b.id, type: 'owns', evidenceIds: [e.id] });
    const report = await svc.createReport(user, c.id);
    const auditCount = (await svc.adminAudit(await repo.findUserByEmail('admin@retrace.test'), { limit: 500 })).length;
    await repo.close();

    repo = await createSqlRepository(url);
    svc = createServices(repo, deps);
    assert.equal(await seed(repo, { hashPassword: deps.hashPassword, now: NOW }), false);
    assert.equal((await repo.listUsers()).length, 3);
    const again = await svc.login({ email: 'aigerim@retrace.test', password: DEMO_PASSWORD });
    const u2 = await repo.findUserById(again.user.id);
    assert.equal((await svc.getCase(u2, c.id)).title, 'Перезапуск');
    assert.deepEqual((await svc.listEvidence(u2, c.id)).map((x) => x.content), ['Пришлите код']);
    assert.equal((await svc.listEntities(u2, c.id)).length, 2);
    assert.deepEqual((await svc.listRelationships(u2, c.id)).find((r) => r.id === rel.id).evidenceIds, [e.id]);
    assert.deepEqual((await svc.getReport(u2, c.id, report.id)).snapshot, report.snapshot);
    assert.ok((await svc.adminAudit(await repo.findUserByEmail('admin@retrace.test'), { limit: 500 })).length > auditCount);
    await repo.close();
  });

  it('rejects broken references and duplicate emails in the database', async () => {
    const repo = await createSqlRepository('sqlite::memory:');
    await seed(repo, { hashPassword: async () => 'x', now: NOW });
    const { Case, Evidence, Relationship, User } = repo.models;
    await assert.rejects(Case.create({ ownerId: 9999, title: 'x', status: 'open', createdAt: 0, updatedAt: 0 }), /FOREIGN KEY/i);
    await assert.rejects(Evidence.create({ caseId: 9999, type: 'message', content: 'x', verification: 'unverified', createdAt: 0 }), /FOREIGN KEY/i);
    const [c] = await repo.listCases({});
    await assert.rejects(Relationship.create({ caseId: c.id, sourceId: 9999, targetId: 9998, type: 'paid' }), /FOREIGN KEY/i);
    await assert.rejects(User.create({ email: 'aigerim@retrace.test', name: 'dup', role: 'investigator', passwordHash: 'x', createdAt: 0 }), /unique|UNIQUE|Validation/i);
    await repo.close();
  });
});
