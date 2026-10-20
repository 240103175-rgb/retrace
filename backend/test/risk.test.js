// Risk rules (#10). Same module is used by the frontend mock.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessRisk, levelFor, linkProblem } from '../src/domain/risk.js';

const ev = (id, type, content, verification = 'unverified') => ({ id, type, content, verification });
const ids = (r) => r.rules.map((x) => x.id);

describe('risk rules', () => {
  it('flags a request for a code or password', () => {
    const r = assessRisk({ evidence: [ev(1, 'message', 'Пришлите код из смс, чтобы подтвердить доставку')] });
    assert.deepEqual(ids(r), ['credential_request']);
    assert.equal(r.score, 25);
    assert.deepEqual(r.rules[0].refs.map((x) => [x.kind, x.id]), [['evidence', 1]]);
  });

  it('flags urgency only together with payment', () => {
    assert.deepEqual(ids(assessRisk({ evidence: [ev(1, 'message', 'Срочно внесите предоплату 15 000 ₸')] })), ['urgent_payment']);
    assert.deepEqual(ids(assessRisk({ evidence: [ev(1, 'message', 'Срочно перезвоните')] })), []);
  });

  it('detects suspicious links and leaves official HTTPS links alone', () => {
    assert.equal(linkProblem('http://example.kz/form'), 'not_https');
    assert.equal(linkProblem('https://bit.ly/3abc'), 'shortener');
    assert.equal(linkProblem('https://xn--80ak6aa92e.com'), 'punycode');
    assert.equal(linkProblem('https://kaspi-pay.top/order'), 'lookalike');
    assert.equal(linkProblem('olx-kz.delivery-secure.com/pay'), 'lookalike');
    assert.equal(linkProblem('http://185.22.10.4/login'), 'ip_address');
    assert.equal(linkProblem('https://kaspi.kz/shop'), null);
    assert.equal(linkProblem('https://pay.kaspi.kz/x'), null);
    assert.equal(linkProblem('просто текст без ссылки'), null);
  });

  it('flags payments, card/wallet entities, hubs and disputed evidence', () => {
    const entities = [
      { id: 10, type: 'account', label: '@hr_manager' },
      { id: 11, type: 'card', label: '4400 **** 1234' },
      { id: 12, type: 'phone', label: '+7 700 000 00 00' },
      { id: 13, type: 'link', label: 'https://hr-kaspi.top' },
    ];
    const relationships = [
      { sourceId: 10, targetId: 11 },
      { sourceId: 10, targetId: 12 },
      { sourceId: 13, targetId: 10 },
      { sourceId: 10, targetId: 11 },
    ];
    const r = assessRisk({ evidence: [ev(1, 'payment', 'Перевод 15 000 ₸', 'disputed')], entities, relationships });
    assert.deepEqual(ids(r), ['suspicious_link', 'personal_payment', 'hub_entity', 'disputed_evidence']);
    assert.deepEqual(r.rules.find((x) => x.id === 'hub_entity').refs.map((x) => [x.id, x.detail]), [[10, '3']]);
    assert.equal(r.rules.find((x) => x.id === 'personal_payment').refs.length, 2);
  });

  it('a hub needs 3 distinct neighbours', () => {
    const entities = [1, 2, 3].map((id) => ({ id, type: 'person', label: `p${id}` }));
    const r = assessRisk({ entities, relationships: [{ sourceId: 1, targetId: 2 }, { sourceId: 1, targetId: 3 }, { sourceId: 2, targetId: 1 }] });
    assert.deepEqual(ids(r), []);
  });

  it('caps the score at 100 and is deterministic', () => {
    const input = {
      evidence: [
        ev(1, 'message', 'Срочно оплатите и пришлите код'),
        ev(2, 'link', 'http://kaspi-bonus.top'),
        ev(3, 'payment', '20 000', 'disputed'),
      ],
      entities: [1, 2, 3, 4].map((id) => ({ id: 100 + id, type: 'person', label: String(id) })),
      relationships: [{ sourceId: 101, targetId: 102 }, { sourceId: 101, targetId: 103 }, { sourceId: 101, targetId: 104 }],
    };
    const r = assessRisk(input);
    assert.equal(r.score, 100);
    assert.equal(r.level, 'high');
    assert.deepEqual(assessRisk(input), r);
  });

  it('uses the level thresholds 30 and 60', () => {
    assert.deepEqual([0, 29, 30, 59, 60, 100].map(levelFor), ['low', 'low', 'medium', 'medium', 'high', 'high']);
  });

  it('says when nothing is confirmed', () => {
    assert.equal(assessRisk({ evidence: [ev(1, 'observation', 'x')] }).basedOnlyOnUnverified, true);
    assert.equal(assessRisk({ evidence: [ev(1, 'observation', 'x', 'confirmed')] }).basedOnlyOnUnverified, false);
    assert.equal(assessRisk({}).basedOnlyOnUnverified, true);
  });
});
