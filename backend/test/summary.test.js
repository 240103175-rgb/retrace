// #24 draft summary: statements follow the data and cite only items of the case.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { REPOSITORIES, setup } from './helpers.js';

for (const [kind, makeRepo] of Object.entries(REPOSITORIES)) {
  describe(`summary (${kind})`, () => {
    it('describes the seed case and every citation exists in the case', async () => {
      const { svc, users, job } = await setup(makeRepo);
      const { statements } = await svc.summary(users.aigerim, job.id);
      const [evidence, entities, risk] = await Promise.all([svc.listEvidence(users.aigerim, job.id), svc.listEntities(users.aigerim, job.id), svc.risk(users.aigerim, job.id)]);
      const scope = statements.find((s) => s.kind === 'scope');
      assert.equal(scope.params.evidence, evidence.length);
      assert.equal(scope.params.entities, entities.length);
      const r = statements.find((s) => s.kind === 'risk');
      assert.equal(r.params.score, risk.score);
      assert.deepEqual(statements.filter((s) => s.kind === 'rule').map((s) => s.params.rule), risk.rules.map((x) => x.id));
      for (const s of statements) {
        if (!['scope', 'no_rules'].includes(s.kind)) assert.ok(s.evidenceIds.length + s.entityIds.length > 0, `${s.kind} cites something`);
        for (const id of s.evidenceIds) assert.ok(evidence.some((e) => e.id === id), `evidence #${id} in case`);
        for (const id of s.entityIds) assert.ok(entities.some((e) => e.id === id), `entity #${id} in case`);
      }
      const ver = statements.find((s) => s.kind === 'verification');
      assert.equal(ver.params.confirmed + ver.params.unverified + ver.params.disputed, evidence.length);
    });

    it('makes no risk claims for an empty case, totals payments and names the hub', async () => {
      const { svc, users } = await setup(makeRepo);
      const c = await svc.createCase(users.aigerim, { title: 'Пустое дело' });
      assert.deepEqual((await svc.summary(users.aigerim, c.id)).statements.map((s) => s.kind), ['scope']);
      const p1 = await svc.createEvidence(users.aigerim, c.id, { type: 'payment', content: 'Перевод 1', amount: 15000 });
      const p2 = await svc.createEvidence(users.aigerim, c.id, { type: 'payment', content: 'Перевод 2', amount: 30000 });
      const [a, b, d] = [
        await svc.createEntity(users.aigerim, c.id, { type: 'account', label: '@hub' }),
        await svc.createEntity(users.aigerim, c.id, { type: 'card', label: '4400 4301 2345 6789' }),
        await svc.createEntity(users.aigerim, c.id, { type: 'phone', label: '+7 701 000 00 00' }),
      ];
      await svc.createRelationship(users.aigerim, c.id, { sourceId: a.id, targetId: b.id, type: 'owns', evidenceIds: [p1.id] });
      await svc.createRelationship(users.aigerim, c.id, { sourceId: a.id, targetId: d.id, type: 'owns', evidenceIds: [p2.id] });
      const { statements } = await svc.summary(users.aigerim, c.id);
      const pay = statements.find((s) => s.kind === 'payments');
      assert.deepEqual([pay.params.total, pay.evidenceIds], [45000, [p1.id, p2.id]]);
      const hub = statements.find((s) => s.kind === 'hub');
      assert.equal(hub.params.label, '@hub');
      assert.deepEqual(hub.entityIds, [a.id, b.id, d.id]);
      assert.ok(statements.some((s) => s.kind === 'no_rules' || s.kind === 'risk'));
      await assert.rejects(svc.summary(users.daniyar, c.id), (e) => e.code === 'not_found');
      assert.ok((await svc.createReport(users.aigerim, c.id)).snapshot.summary.statements.length >= 3);
    });
  });
}
