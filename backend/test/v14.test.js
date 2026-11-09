// v1.4: cross-case matches (#136), similar cases (#148), rule settings (#140), comments and tasks (#150),
// victims' reports (#152) and the public check (#154), on every repository.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { REPOSITORIES, setup } from './helpers.js';

const rejects = (promise, code) => assert.rejects(promise, (err) => err.code === code);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7]);

for (const [kind, makeRepo] of Object.entries(REPOSITORIES)) {
  describe(`v1.4 (${kind})`, () => {
    it('#136 matches across investigators show counts, not cases; the risk rule fires', async () => {
      const { svc, users } = await setup(makeRepo);
      const mine = await svc.createCase(users.aigerim, { title: 'Карта мошенника' });
      const theirs = await svc.createCase(users.daniyar, { title: 'Секретное дело Данияра' });
      const own2 = await svc.createCase(users.aigerim, { title: 'Второе дело Айгерим' });
      const card = await svc.createEntity(users.aigerim, mine.id, { type: 'card', label: '4400 4301 2345 6789' });
      await svc.createEntity(users.daniyar, theirs.id, { type: 'card', label: '4400-4301-2345-6789' });
      await svc.createEntity(users.aigerim, own2.id, { type: 'card', label: '4400430123456789' });
      const phone = await svc.createEntity(users.aigerim, mine.id, { type: 'phone', label: '+7 701 555 12 34' });
      await svc.createEntity(users.daniyar, theirs.id, { type: 'phone', label: '8 (701) 555-12-34' });
      await svc.createEntity(users.aigerim, mine.id, { type: 'person', label: 'Пострадавшая (А.)' });
      await svc.createEntity(users.daniyar, theirs.id, { type: 'person', label: 'Пострадавшая (А.)' });

      const m = await svc.matches(users.aigerim, mine.id);
      const byEntity = Object.fromEntries(m.map((x) => [x.entityId, x]));
      assert.deepEqual(byEntity[card.id].visibleCases, [{ id: own2.id, title: 'Второе дело Айгерим' }]);
      assert.equal(byEntity[card.id].otherCases, 1);
      assert.equal(JSON.stringify(m).includes('Секретное'), false, 'no foreign titles');
      assert.equal(byEntity[phone.id].otherCases, 1, '+7 and 8 forms match');
      assert.equal(m.length, 2, 'people are not matched by name');

      const risk = await svc.risk(users.aigerim, mine.id);
      const rule = risk.rules.find((r) => r.id === 'seen_elsewhere');
      assert.ok(rule);
      assert.deepEqual(rule.refs.map((r) => r.detail).sort(), ['cases:1', 'cases:2']);
      await rejects(svc.matches(users.daniyar, mine.id), 'not_found');
    });

    it('#148 similar cases are only readable ones, ranked by shared identifiers', async () => {
      const { svc, users } = await setup(makeRepo);
      const a = await svc.createCase(users.aigerim, { title: 'Дело A' });
      const b = await svc.createCase(users.aigerim, { title: 'Дело B' });
      const c = await svc.createCase(users.aigerim, { title: 'Дело C' });
      const d = await svc.createCase(users.daniyar, { title: 'Чужое дело' });
      for (const [cs, labels] of [[a, ['@one', '@two']], [b, ['@one', '@two']], [c, ['@two']]]) {
        for (const label of labels) await svc.createEntity(users.aigerim, cs.id, { type: 'account', label });
      }
      await svc.createEntity(users.daniyar, d.id, { type: 'account', label: '@one' });
      const sim = await svc.similar(users.aigerim, a.id);
      assert.deepEqual(sim.map((x) => [x.title, x.score]), [['Дело B', 2], ['Дело C', 1]]);
      assert.deepEqual(sim[0].shared.map((x) => x.label).sort(), ['@one', '@two']);
    });

    it('#140 admin settings change scores, keep reports, are audited and admin-only', async () => {
      const { svc, users, job } = await setup(makeRepo);
      const before = (await svc.risk(users.aigerim, job.id)).score;
      const report = await svc.createReport(users.aigerim, job.id);
      const rules = await svc.adminRiskRules(users.admin);
      assert.ok(rules.every((r) => r.enabled && r.weight === r.defaultWeight));
      const link = await svc.adminSetRiskRule(users.admin, 'suspicious_link', { enabled: false });
      assert.equal(link.enabled, false);
      assert.equal((await svc.risk(users.aigerim, job.id)).score, before - 20);
      await svc.adminSetRiskRule(users.admin, 'suspicious_link', { enabled: true, weight: 40 });
      assert.equal((await svc.risk(users.aigerim, job.id)).score, before + 20);
      assert.equal((await svc.getReport(users.aigerim, job.id, report.id)).riskScore, before, 'report unchanged');
      await rejects(svc.adminSetRiskRule(users.aigerim, 'suspicious_link', { weight: 1 }), 'forbidden');
      await rejects(svc.adminSetRiskRule(users.admin, 'suspicious_link', { weight: 99 }), 'validation_error');
      await rejects(svc.adminSetRiskRule(users.admin, 'nope', { weight: 1 }), 'not_found');
      const audit = (await svc.adminAudit(users.admin, { action: 'risk.rule.', limit: 10 })).map((e) => e.action);
      assert.deepEqual(audit.sort(), ['risk.rule.suspicious_link:20>off', 'risk.rule.suspicious_link:off>40']);
    });

    it('#150 comments and tasks follow the case roles', async () => {
      const { svc, users, olx } = await setup(makeRepo);
      await svc.addMember(users.aigerim, olx.id, { email: 'daniyar@retrace.test', role: 'viewer' });
      const c1 = await svc.addComment(users.aigerim, olx.id, { text: 'Проверить карту в банке' });
      assert.equal(c1.authorName, 'Айгерим Нурланова');
      await rejects(svc.addComment(users.daniyar, olx.id, { text: 'Я наблюдатель' }), 'forbidden');
      assert.equal((await svc.listComments(users.daniyar, olx.id)).length, 1);
      await svc.updateMember(users.aigerim, olx.id, users.daniyar.id, { role: 'editor' });
      const c2 = await svc.addComment(users.daniyar, olx.id, { text: 'Беру на себя' });
      await rejects(svc.deleteComment(users.aigerim, olx.id, c2.id), 'forbidden');
      await svc.deleteComment(users.daniyar, olx.id, c2.id);

      const t = await svc.addTask(users.daniyar, olx.id, { title: 'Запрос в банк', assigneeId: users.aigerim.id });
      assert.deepEqual([t.assigneeName, t.done], ['Айгерим Нурланова', false]);
      await rejects(svc.addTask(users.aigerim, olx.id, { title: 'x', assigneeId: users.admin.id }), 'validation_error');
      assert.equal((await svc.getCase(users.aigerim, olx.id)).openTasks, 1);
      assert.equal((await svc.updateTask(users.aigerim, olx.id, t.id, { done: true })).done, true);
      assert.equal((await svc.getCase(users.aigerim, olx.id)).openTasks, 0);
      await svc.updateCase(users.aigerim, olx.id, { status: 'closed' });
      await rejects(svc.addComment(users.aigerim, olx.id, { text: 'Закрыто' }), 'case_locked');
    });

    it('#152 a public report becomes a case for the investigator who takes it, once', async () => {
      const { svc, repo, users } = await setup(makeRepo);
      await rejects(svc.submitPublicReport({ description: 'короткий', consent: true }), 'validation_error');
      await rejects(svc.submitPublicReport({ description: 'Мне позвонили из «банка» и попросили код', consent: false }), 'validation_error');
      const bot = await svc.submitPublicReport({ description: 'spam spam spam spam spam spam', consent: true, website: 'http://spam' });
      assert.match(bot.reference, /^RT-/);
      const { reference } = await svc.submitPublicReport({
        description: 'Позвонили из «службы безопасности банка», попросили код из SMS и перевести 120 000 ₸ на «безопасный счёт».',
        contact: '+7 777 000 00 00',
        consent: true,
        file: { filename: 'screen.png', mimeType: 'image/png', dataBase64: PNG.toString('base64') },
      });
      const list = await svc.listIntake(users.aigerim, {});
      assert.equal(list.length, 1, 'honeypot submission not stored');
      assert.equal(list[0].reference, reference);
      assert.equal(list[0].file.size, PNG.length);
      const created = await svc.takeIntake(users.aigerim, list[0].id);
      assert.equal(created.title, `Обращение ${reference}`);
      assert.equal(created.notes, 'Контакт заявителя: +7 777 000 00 00');
      const [ev] = await svc.listEvidence(users.aigerim, created.id);
      assert.match(ev.content, /службы безопасности/);
      assert.equal(ev.attachments[0].filename, 'screen.png');
      assert.ok((await svc.risk(users.aigerim, created.id)).rules.some((r) => r.id === 'credential_request'));
      await rejects(svc.takeIntake(users.daniyar, list[0].id), 'already_taken');
      assert.equal((await svc.listIntake(users.daniyar, {})).length, 0);
      assert.equal((await svc.listIntake(users.daniyar, { status: 'taken' }))[0].takenByName, 'Айгерим Нурланова');
      assert.equal((await repo.listIntake({})).length, 1);
    });

    it('#154 the public check counts only cases with confirmed evidence and flags look-alikes', async () => {
      const { svc, users } = await setup(makeRepo);
      const confirmed = await svc.createCase(users.aigerim, { title: 'Подтверждённое' });
      await svc.createEvidence(users.aigerim, confirmed.id, { type: 'message', content: 'Перевод на карту', source: 'Скриншот', verification: 'confirmed' });
      await svc.createEntity(users.aigerim, confirmed.id, { type: 'card', label: '5169 4931 0000 0002' });
      const unverified = await svc.createCase(users.daniyar, { title: 'Непроверенное' });
      await svc.createEntity(users.daniyar, unverified.id, { type: 'card', label: '5169493100000002' });
      const card = await svc.publicCheck('5169-4931-0000-0002');
      assert.deepEqual([card.kind, card.investigations], ['card', 1]);
      assert.equal(JSON.stringify(card).includes('Подтверждённое'), false);
      assert.equal((await svc.publicCheck('+7 700 999 99 99')).investigations, 0);
      assert.deepEqual((await svc.publicCheck('https://kaspl.kz/bonus')).signals, ['typosquat']);
      assert.equal((await svc.publicCheck('просто текст')).kind, 'unknown');
      await rejects(svc.publicCheck('  '), 'validation_error');
    });
  });
}
