// #26 report fingerprint: SHA-256 of the stored snapshot, stable across reads and storage engines.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { REPOSITORIES, setup } from './helpers.js';

for (const [kind, makeRepo] of Object.entries(REPOSITORIES)) {
  describe(`report fingerprint (${kind})`, () => {
    it('equals sha256 of the stored snapshot and does not change', async () => {
      const { svc, repo, users, job } = await setup(makeRepo);
      const made = await svc.createReport(users.aigerim, job.id);
      assert.match(made.fingerprint, /^[0-9a-f]{64}$/);
      const stored = (await repo.getReport(made.id)).snapshot;
      assert.equal(made.fingerprint, createHash('sha256').update(stored, 'utf8').digest('hex'));
      await svc.updateCase(users.aigerim, job.id, { title: 'Переименованное дело' });
      assert.equal((await svc.getReport(users.aigerim, job.id, made.id)).fingerprint, made.fingerprint);
      const second = await svc.createReport(users.aigerim, job.id);
      assert.notEqual(second.fingerprint, made.fingerprint); // the case changed, so the snapshot differs
    });
  });
}
