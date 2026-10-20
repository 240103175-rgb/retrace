// Business rules (_docs/plan.md §4), run against every repository implementation.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEMO_PASSWORD } from '../src/domain/seedData.js';
import { REPOSITORIES, setup } from './helpers.js';

const rejects = (promise, code) => assert.rejects(promise, (err) => err.code === code);

for (const [kind, makeRepo] of Object.entries(REPOSITORIES)) {
  describe(`services (${kind})`, () => {
    it('signs in, registers and refuses bad credentials the same way', async () => {
      const { svc } = await setup(makeRepo);
      const s = await svc.login({ email: 'AIGERIM@retrace.test', password: DEMO_PASSWORD });
      assert.equal(s.user.role, 'investigator');
      assert.equal('passwordHash' in s.user, false);
      assert.equal((await svc.userFromToken(s.token)).email, 'aigerim@retrace.test');
      await rejects(svc.login({ email: 'aigerim@retrace.test', password: 'wrong-password' }), 'invalid_credentials');
      await rejects(svc.login({ email: 'nobody@retrace.test', password: DEMO_PASSWORD }), 'invalid_credentials');
      await rejects(svc.register({ email: 'new@retrace.test', password: 'short', name: 'Новый' }), 'validation_error');
      await rejects(svc.register({ email: 'aigerim@retrace.test', password: 'long-enough', name: 'Дубль' }), 'email_taken');
      const r = await svc.register({ email: 'new@retrace.test', password: 'long-enough', name: 'Новый' });
      assert.equal(r.user.role, 'investigator');
      await svc.logout(r.token);
      assert.equal(await svc.userFromToken(r.token), null);
    });

    it('shows an investigator only their own cases, filtered and sorted', async () => {
      const { svc, users } = await setup(makeRepo);
      const mine = await svc.listCases(users.aigerim, {});
      assert.equal(mine.length, 2);
      assert.equal((await svc.listCases(users.aigerim, { q: 'ВАКАНСИЯ' })).length, 1);
      assert.equal((await svc.listCases(users.aigerim, { status: 'closed' })).length, 0);
      const byRisk = await svc.listCases(users.aigerim, { sort: 'risk' });
      assert.ok(byRisk[0].riskScore >= byRisk[1].riskScore);
      await rejects(svc.listCases(users.aigerim, { sort: 'nope' }), 'validation_error');
    });

    it('hides other investigators’ cases and lets admins read but not edit', async () => {
      const { svc, users, bank } = await setup(makeRepo);
      await rejects(svc.getCase(users.aigerim, bank.id), 'not_found');
      await rejects(svc.listEvidence(users.aigerim, bank.id), 'not_found');
      await rejects(svc.createEvidence(users.aigerim, bank.id, { type: 'observation', content: 'x' }), 'not_found');
      assert.equal((await svc.getCase(users.admin, bank.id)).title, bank.title);
      await rejects(svc.updateCase(users.admin, bank.id, { title: 'Взлом' }), 'forbidden');
      await rejects(svc.createReport(users.admin, bank.id), 'forbidden');
    });

    it('validates and locks case content when closed or archived', async () => {
      const { svc, users, olx } = await setup(makeRepo);
      await rejects(svc.createCase(users.aigerim, { title: 'AB' }), 'validation_error');
      const c = await svc.createCase(users.aigerim, { title: 'Новое дело', description: '' });
      assert.equal(c.status, 'open');
      await svc.updateCase(users.aigerim, olx.id, { status: 'closed' });
      await rejects(svc.createEvidence(users.aigerim, olx.id, { type: 'observation', content: 'x' }), 'case_locked');
      await rejects(svc.updateCase(users.aigerim, olx.id, { title: 'Новое имя' }), 'case_locked');
      await svc.updateCase(users.aigerim, olx.id, { status: 'open' });
      assert.ok(await svc.createEvidence(users.aigerim, olx.id, { type: 'observation', content: 'x' }));
      await rejects(svc.updateCase(users.aigerim, olx.id, { status: 'deleted' }), 'validation_error');
    });

    it('validates evidence and keeps relationships consistent on delete', async () => {
      const { svc, users, job } = await setup(makeRepo);
      await rejects(svc.createEvidence(users.aigerim, job.id, { type: 'message', content: '  ' }), 'validation_error');
      await rejects(svc.createEvidence(users.aigerim, job.id, { type: 'video', content: 'x' }), 'validation_error');
      await rejects(svc.createEvidence(users.aigerim, job.id, { type: 'payment', content: 'x', amount: -5 }), 'validation_error');
      const e = await svc.createEvidence(users.aigerim, job.id, { type: 'payment', content: 'Второй перевод', amount: 5000, observedOn: '2026-10-17' });
      assert.equal(e.amount, 5000);
      assert.equal(e.verification, 'unverified');
      const [a, b] = await svc.listEntities(users.aigerim, job.id);
      const rel = await svc.createRelationship(users.aigerim, job.id, { sourceId: a.id, targetId: b.id, type: 'paid', evidenceIds: [e.id] });
      assert.deepEqual(rel.evidenceIds, [e.id]);
      await svc.deleteEvidence(users.aigerim, job.id, e.id);
      const after = (await svc.listRelationships(users.aigerim, job.id)).find((r) => r.id === rel.id);
      assert.deepEqual(after.evidenceIds, []);
    });

    it('refuses invalid relationships and deletes links with their entity', async () => {
      const { svc, users, job, olx } = await setup(makeRepo);
      const [a] = await svc.listEntities(users.aigerim, job.id);
      const [foreign] = await svc.listEntities(users.aigerim, olx.id);
      const [foreignEvidence] = await svc.listEvidence(users.aigerim, olx.id);
      await rejects(svc.createRelationship(users.aigerim, job.id, { sourceId: a.id, targetId: a.id, type: 'paid' }), 'invalid_relationship');
      await rejects(svc.createRelationship(users.aigerim, job.id, { sourceId: a.id, targetId: foreign.id, type: 'paid' }), 'invalid_relationship');
      const [, b] = await svc.listEntities(users.aigerim, job.id);
      await rejects(svc.createRelationship(users.aigerim, job.id, { sourceId: a.id, targetId: b.id, type: 'paid', evidenceIds: [foreignEvidence.id] }), 'invalid_relationship');
      await rejects(svc.createRelationship(users.aigerim, job.id, { sourceId: a.id, targetId: b.id, type: 'loves' }), 'validation_error');
      const before = (await svc.listRelationships(users.aigerim, job.id)).filter((r) => r.sourceId === a.id || r.targetId === a.id).length;
      assert.ok(before > 0);
      await svc.deleteEntity(users.aigerim, job.id, a.id);
      const left = await svc.listRelationships(users.aigerim, job.id);
      assert.equal(left.filter((r) => r.sourceId === a.id || r.targetId === a.id).length, 0);
    });

    it('builds the graph and an explained risk for the demo case', async () => {
      const { svc, users, job } = await setup(makeRepo);
      const g = await svc.graph(users.aigerim, job.id);
      assert.equal(g.nodes.length, 5);
      assert.equal(g.edges.length, 5);
      assert.equal(g.nodes.find((n) => n.label === '@hr_manager_astana').degree, 3);
      const risk = await svc.risk(users.aigerim, job.id);
      assert.deepEqual(risk.rules.map((r) => r.id), ['urgent_payment', 'suspicious_link', 'personal_payment', 'hub_entity']);
      assert.equal(risk.score, 65);
      assert.equal(risk.level, 'high');
      assert.equal(risk.basedOnlyOnUnverified, false);
    });

    it('keeps reports as immutable snapshots', async () => {
      const { svc, users, job } = await setup(makeRepo);
      const r = await svc.createReport(users.aigerim, job.id);
      await svc.updateCase(users.aigerim, job.id, { title: 'Переименованное дело' });
      await svc.createEvidence(users.aigerim, job.id, { type: 'observation', content: 'после отчёта' });
      const again = await svc.getReport(users.aigerim, job.id, r.id);
      assert.equal(again.snapshot.case.title, 'Фейковая вакансия оператора колл-центра');
      assert.equal(again.snapshot.evidence.length, 4);
      assert.equal(again.snapshot.risk.score, 65);
      assert.equal((await svc.listReports(users.aigerim, job.id)).length, 1);
    });

    it('gives admins stats, users, roles and an audit log without secrets', async () => {
      const { svc, repo, users, job } = await setup(makeRepo);
      await rejects(svc.adminStats(users.aigerim), 'forbidden');
      const stats = await svc.adminStats(users.admin);
      assert.deepEqual([stats.users, stats.cases, stats.casesByStatus.open, stats.casesByStatus.in_review], [3, 3, 2, 1]);
      assert.equal((await svc.adminCases(users.admin, {})).length, 3);
      await rejects(svc.adminSetRole(users.admin, users.admin.id, { role: 'investigator' }), 'last_admin');
      await svc.adminSetRole(users.admin, users.daniyar.id, { role: 'admin' });
      const daniyar = await repo.findUserById(users.daniyar.id);
      assert.equal((await svc.adminSetRole(users.admin, users.admin.id, { role: 'investigator' })).role, 'investigator');
      await svc.createEvidence(users.aigerim, job.id, { type: 'observation', content: 'x' });
      const log = await svc.adminAudit(daniyar, { limit: 5 });
      assert.equal(log[0].action, 'evidence.create');
      assert.equal(log[0].actorName, 'Айгерим Нурланова');
      assert.equal(JSON.stringify(log).includes('scrypt$'), false);
      assert.equal((await svc.adminAudit(daniyar, { caseId: job.id })).every((e) => e.caseId === job.id), true);
    });
  });
}
