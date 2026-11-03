// #107 copy a full database (SQLite file → SQLite file locally; → PostgreSQL in CI) and read it back.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { nodeDeps } from '../src/crypto.js';
import { createServices } from '../src/domain/services.js';
import { DEMO_PASSWORD, seed } from '../src/domain/seedData.js';
import { migrateDatabase } from '../src/repositories/migrate.js';
import { createSqlRepository } from '../src/repositories/sql.js';

const NOW = Date.parse('2026-11-01T08:00:00Z');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

async function sourceDb() {
  const url = `sqlite:${join(mkdtempSync(join(tmpdir(), 'retrace-src-')), 'src.db')}`;
  const repo = await createSqlRepository(url);
  const deps = nodeDeps(() => NOW);
  await seed(repo, { hashPassword: deps.hashPassword, now: NOW });
  const svc = createServices(repo, deps);
  const aigerim = await repo.findUserByEmail('aigerim@retrace.test');
  const [olx] = (await svc.listCases(aigerim, { q: 'OLX' }));
  await svc.updateCase(aigerim, olx.id, { tags: ['olx', 'доставка'], notes: 'Заметка' });
  const [ev] = await svc.listEvidence(aigerim, olx.id);
  const file = await svc.uploadAttachment(aigerim, olx.id, ev.id, { filename: 'чек.png', mimeType: 'image/png', dataBase64: PNG.toString('base64') });
  await svc.addMember(aigerim, olx.id, { email: 'daniyar@retrace.test', role: 'viewer' });
  const report = await svc.createReport(aigerim, olx.id);
  await repo.close();
  return { url, olxId: olx.id, evidenceId: ev.id, fileId: file.id, reportId: report.id, fingerprint: report.fingerprint };
}

const targets = {
  sqlite: () => `sqlite:${join(mkdtempSync(join(tmpdir(), 'retrace-dst-')), 'dst.db')}`,
  ...(process.env.TEST_DATABASE_URL ? { postgres: () => process.env.TEST_DATABASE_URL } : {}),
};

for (const [kind, target] of Object.entries(targets)) {
  describe(`migrate SQLite → ${kind}`, () => {
    it('copies every row, keeps ids, bytes and reports, and new rows get fresh ids', async () => {
      const src = await sourceDb();
      const to = target();
      const counts = await migrateDatabase(src.url, to, { force: kind === 'postgres' });
      assert.ok(counts.every((c) => c.source === c.target));
      assert.ok(counts.find((c) => c.table === 'attachments').target === 1);

      const repo = await createSqlRepository(to);
      const svc = createServices(repo, nodeDeps(() => NOW));
      const aigerim = (await svc.login({ email: 'aigerim@retrace.test', password: DEMO_PASSWORD })).user;
      const daniyar = (await svc.login({ email: 'daniyar@retrace.test', password: DEMO_PASSWORD })).user;
      const olx = await svc.getCase(aigerim, src.olxId);
      assert.deepEqual(olx.tags, ['olx', 'доставка']);
      assert.equal(olx.notes, 'Заметка');
      assert.equal((await svc.getCase(daniyar, src.olxId)).access, 'viewer');
      const file = await svc.attachmentContent(aigerim, src.olxId, src.evidenceId, src.fileId);
      assert.equal(createHash('sha256').update(Buffer.from(file.data)).digest('hex'), file.sha256);
      assert.deepEqual(Buffer.from(file.data), PNG);
      assert.equal((await svc.getReport(aigerim, src.olxId, src.reportId)).fingerprint, src.fingerprint);
      // Sequences continue after the copied ids.
      const c = await svc.createCase(aigerim, { title: 'После миграции' });
      assert.ok(c.id > src.olxId);
      await svc.createEvidence(aigerim, c.id, { type: 'observation', content: 'новая запись' });
      await repo.close();

      await assert.rejects(migrateDatabase(src.url, to), /not empty/);
    });
  });
}
