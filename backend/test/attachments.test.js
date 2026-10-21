// #25 evidence attachments with SHA-256 checksums, on every repository.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { MAX_FILE_BYTES, decodeBase64, sniffType } from '../src/domain/files.js';
import { REPOSITORIES, setup } from './helpers.js';

const rejects = (promise, code) => assert.rejects(promise, (err) => err.code === code);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const b64 = (buf) => Buffer.from(buf).toString('base64');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const png = (extra = {}) => ({ filename: 'screen.png', mimeType: 'image/png', dataBase64: b64(PNG), ...extra });

describe('file checks', () => {
  it('decodes base64 exactly like Node', () => {
    for (const n of [1, 2, 3, 4, 5, 255, 1000]) {
      const buf = Buffer.from(Array.from({ length: n }, (_, i) => (i * 37) % 256));
      assert.deepEqual(Buffer.from(decodeBase64(buf.toString('base64'))), buf);
    }
    assert.throws(() => decodeBase64('not base64!'), (e) => e.code === 'validation_error');
  });

  it('recognises files by their bytes', () => {
    assert.equal(sniffType(PNG), 'image/png');
    assert.equal(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
    assert.equal(sniffType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
    assert.equal(sniffType(Buffer.from('%PDF-1.7\n')), 'application/pdf');
    assert.equal(sniffType(Buffer.from('Переведите 5000 ₸', 'utf8')), 'text/plain');
    assert.equal(sniffType(Buffer.from([0x4d, 0x5a, 0x90, 0x00])), null); // Windows executable
  });
});

for (const [kind, makeRepo] of Object.entries(REPOSITORIES)) {
  describe(`attachments (${kind})`, () => {
    it('stores a file with its SHA-256 and returns the same bytes', async () => {
      const { svc, users, olx } = await setup(makeRepo);
      const [ev] = await svc.listEvidence(users.aigerim, olx.id);
      const a = await svc.uploadAttachment(users.aigerim, olx.id, ev.id, png({ sha256: sha(PNG) }));
      assert.equal(a.sha256, sha(PNG));
      assert.equal(a.size, PNG.length);
      assert.equal(a.filename, 'screen.png');
      const content = await svc.attachmentContent(users.aigerim, olx.id, ev.id, a.id);
      assert.deepEqual(Buffer.from(content.data), PNG);
      assert.equal(sha(Buffer.from(content.data)), a.sha256);
      const listed = (await svc.listEvidence(users.aigerim, olx.id)).find((e) => e.id === ev.id);
      assert.deepEqual(listed.attachments.map((x) => x.id), [a.id]);
      assert.equal('data' in listed.attachments[0], false);
      const report = await svc.createReport(users.aigerim, olx.id);
      assert.equal(report.snapshot.evidence.find((e) => e.id === ev.id).attachments[0].sha256, a.sha256);
      assert.equal((await svc.exportCase(users.aigerim, olx.id)).evidence.find((e) => e.id === ev.id).attachments.length, 1);
    });

    it('refuses wrong types, big files, too many files and bad checksums', async () => {
      const { svc, users, olx } = await setup(makeRepo);
      const [ev] = await svc.listEvidence(users.aigerim, olx.id);
      const up = (body) => svc.uploadAttachment(users.aigerim, olx.id, ev.id, body);
      await rejects(up(png({ dataBase64: b64([0x4d, 0x5a, 0x90, 0x00]) })), 'unsupported_file');
      await rejects(up(png({ mimeType: 'application/x-msdownload' })), 'unsupported_file');
      await rejects(up(png({ mimeType: 'image/jpeg' })), 'unsupported_file');
      await rejects(up(png({ mimeType: 'image/png', dataBase64: b64(Buffer.from('just text')) })), 'unsupported_file');
      const big = Buffer.alloc(MAX_FILE_BYTES + 1, 0x41);
      await rejects(up({ filename: 'big.txt', mimeType: 'text/plain', dataBase64: b64(big) }), 'file_too_large');
      const exact = Buffer.alloc(MAX_FILE_BYTES, 0x41);
      assert.equal((await up({ filename: 'max.txt', mimeType: 'text/plain', dataBase64: b64(exact) })).size, MAX_FILE_BYTES);
      await rejects(up(png({ sha256: '0'.repeat(64) })), 'checksum_mismatch');
      await rejects(up(png({ filename: '../' })), 'validation_error');
      assert.equal((await up(png({ filename: 'C:\\Users\\x\\..\\shot.png' }))).filename, 'shot.png');
      for (let i = 0; i < 8; i++) await up(png());
      await rejects(up(png()), 'too_many_files');
    });

    it('follows the case access rules and is deleted with its evidence', async () => {
      const { svc, repo, users, olx, bank } = await setup(makeRepo);
      const [ev] = await svc.listEvidence(users.aigerim, olx.id);
      const a = await svc.uploadAttachment(users.aigerim, olx.id, ev.id, png());
      await rejects(svc.listAttachments(users.daniyar, olx.id, ev.id), 'not_found');
      await rejects(svc.attachmentContent(users.daniyar, olx.id, ev.id, a.id), 'not_found');
      await rejects(svc.uploadAttachment(users.daniyar, olx.id, ev.id, png()), 'not_found');
      assert.equal((await svc.listAttachments(users.admin, olx.id, ev.id)).length, 1);
      await rejects(svc.uploadAttachment(users.admin, olx.id, ev.id, png()), 'forbidden');
      await rejects(svc.deleteAttachment(users.admin, olx.id, ev.id, a.id), 'forbidden');
      const [bankEv] = await svc.listEvidence(users.daniyar, bank.id);
      await rejects(svc.attachmentContent(users.daniyar, bank.id, bankEv.id, a.id), 'not_found'); // id from another case
      await svc.updateCase(users.aigerim, olx.id, { status: 'closed' });
      await rejects(svc.uploadAttachment(users.aigerim, olx.id, ev.id, png()), 'case_locked');
      await svc.updateCase(users.aigerim, olx.id, { status: 'open' });
      await svc.deleteAttachment(users.aigerim, olx.id, ev.id, a.id);
      assert.equal((await svc.listAttachments(users.aigerim, olx.id, ev.id)).length, 0);
      const b = await svc.uploadAttachment(users.aigerim, olx.id, ev.id, png());
      await svc.deleteEvidence(users.aigerim, olx.id, ev.id);
      await rejects(svc.attachmentContent(users.aigerim, olx.id, ev.id, b.id), 'not_found');
      assert.equal((await repo.listAttachments({ caseId: olx.id })).length, 0);
    });
  });
}
