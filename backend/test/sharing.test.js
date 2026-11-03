// #27 collaborative investigations: roles, access and edit conflicts, on every repository.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { REPOSITORIES, setup } from './helpers.js';

const rejects = (promise, code) => assert.rejects(promise, (err) => err.code === code);

for (const [kind, makeRepo] of Object.entries(REPOSITORIES)) {
  describe(`sharing (${kind})`, () => {
    it('owner shares with an editor and a viewer; each gets exactly their rights', async () => {
      const { svc, repo, users, olx } = await setup(makeRepo);
      const viewer = (await svc.register({ email: 'viewer@retrace.test', password: 'long-enough', name: 'Наблюдатель' })).user;
      const v = await repo.findUserById(viewer.id);
      await rejects(svc.getCase(users.daniyar, olx.id), 'not_found');
      const ed = await svc.addMember(users.aigerim, olx.id, { email: 'DANIYAR@retrace.test', role: 'editor' });
      assert.deepEqual([ed.userId, ed.role, ed.name], [users.daniyar.id, 'editor', 'Данияр Сеитов']);
      await svc.addMember(users.aigerim, olx.id, { email: 'viewer@retrace.test', role: 'viewer' });
      await rejects(svc.addMember(users.aigerim, olx.id, { email: 'viewer@retrace.test', role: 'editor' }), 'already_member');
      await rejects(svc.addMember(users.aigerim, olx.id, { email: 'nobody@retrace.test', role: 'viewer' }), 'user_not_found');
      await rejects(svc.addMember(users.aigerim, olx.id, { email: 'aigerim@retrace.test', role: 'viewer' }), 'validation_error');
      await rejects(svc.addMember(users.aigerim, olx.id, { email: 'viewer@retrace.test', role: 'boss' }), 'validation_error');

      // Editor: content, notes, tags, reports — not title, status or members.
      assert.equal((await svc.getCase(users.daniyar, olx.id)).access, 'editor');
      const listed = (await svc.listCases(users.daniyar, {})).find((c) => c.id === olx.id);
      assert.equal(listed.access, 'editor');
      await svc.createEvidence(users.daniyar, olx.id, { type: 'observation', content: 'Проверил номер — зарегистрирован неделю назад' });
      await svc.updateCase(users.daniyar, olx.id, { notes: 'Заметка редактора', tags: ['olx'] });
      assert.ok((await svc.createReport(users.daniyar, olx.id)).id);
      await rejects(svc.updateCase(users.daniyar, olx.id, { status: 'closed' }), 'forbidden');
      await rejects(svc.updateCase(users.daniyar, olx.id, { title: 'Чужое название' }), 'forbidden');
      await rejects(svc.addMember(users.daniyar, olx.id, { email: 'admin@retrace.test', role: 'viewer' }), 'forbidden');

      // Viewer: read only.
      assert.equal((await svc.getCase(v, olx.id)).access, 'viewer');
      assert.ok((await svc.listEvidence(v, olx.id)).length > 0);
      await rejects(svc.createEvidence(v, olx.id, { type: 'observation', content: 'x' }), 'forbidden');
      await rejects(svc.updateCase(v, olx.id, { notes: 'x' }), 'forbidden');
      await rejects(svc.createReport(v, olx.id), 'forbidden');

      // Role change, leaving, removal.
      assert.equal((await svc.updateMember(users.aigerim, olx.id, viewer.id, { role: 'editor' })).role, 'editor');
      await svc.removeMember(v, olx.id, viewer.id); // leaves
      await rejects(svc.getCase(v, olx.id), 'not_found');
      await rejects(svc.removeMember(users.daniyar, olx.id, users.aigerim.id), 'forbidden');
      await svc.removeMember(users.aigerim, olx.id, users.daniyar.id);
      await rejects(svc.getCase(users.daniyar, olx.id), 'not_found');
      assert.deepEqual(await svc.listMembers(users.aigerim, olx.id), []);

      // Admins stay read-only; the audit names member changes.
      assert.equal((await svc.getCase(users.admin, olx.id)).access, 'admin');
      await rejects(svc.createEvidence(users.admin, olx.id, { type: 'observation', content: 'x' }), 'forbidden');
      const actions = (await svc.adminAudit(users.admin, { caseId: olx.id, limit: 500 })).map((e) => e.action);
      for (const a of ['case.member.add', 'case.member.update', 'case.member.leave', 'case.member.remove']) assert.ok(actions.includes(a), a);
    });

    it('detects concurrent edits through versions', async () => {
      const { svc, users, olx } = await setup(makeRepo);
      await svc.addMember(users.aigerim, olx.id, { email: 'daniyar@retrace.test', role: 'editor' });
      const [ev] = await svc.listEvidence(users.aigerim, olx.id);
      assert.equal(ev.version, 1);
      // Both open version 1; the editor saves first.
      const saved = await svc.updateEvidence(users.daniyar, olx.id, ev.id, { content: 'Правка редактора', version: 1 });
      assert.equal(saved.version, 2);
      await rejects(svc.updateEvidence(users.aigerim, olx.id, ev.id, { content: 'Правка владельца', version: 1 }), 'edit_conflict');
      assert.equal((await svc.updateEvidence(users.aigerim, olx.id, ev.id, { content: 'Правка владельца', version: 2 })).version, 3);
      assert.equal((await svc.updateEvidence(users.aigerim, olx.id, ev.id, { content: 'Без версии' })).version, 4); // old clients still work

      const [en] = await svc.listEntities(users.aigerim, olx.id);
      await svc.updateEntity(users.daniyar, olx.id, en.id, { note: 'a', version: en.version });
      await rejects(svc.updateEntity(users.aigerim, olx.id, en.id, { note: 'b', version: en.version }), 'edit_conflict');

      const c = await svc.getCase(users.aigerim, olx.id);
      await svc.updateCase(users.daniyar, olx.id, { notes: 'редактор', version: c.version });
      await rejects(svc.updateCase(users.aigerim, olx.id, { notes: 'владелец', version: c.version }), 'edit_conflict');
      await rejects(svc.updateCase(users.aigerim, olx.id, { notes: 'x', version: 0 }), 'validation_error');
    });
  });
}
