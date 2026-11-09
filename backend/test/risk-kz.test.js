// #138 look-alike domains of Kazakh brands; #142 Kazakh-language scam phrases; #140 rule settings.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessRisk, editDistance, linkProblem } from '../src/domain/risk.js';

const ids = (evidence) => assessRisk({ evidence: evidence.map((e, i) => ({ id: i + 1, type: 'message', verification: 'unverified', ...e })) }).rules.map((r) => r.id);

describe('#138 look-alike domains', () => {
  const POSITIVE = {
    typosquat: ['kaspl.kz', 'https://ka5pi.kz/pay', 'http://0lx.kz/deal', 'kasp1.kz', 'https://homebamk.kz', 'kolesq.kz', 'krlsha.kz', 'eg0v.kz', 'jusam.kz', 'h0mebank.kz'],
    // A brand name inside a domain that is not the brand's is reported as a look-alike first.
    lookalike: ['halykbnk.kz', 'https://kaspii.kz', 'kaspi-bonus.top', 'https://olx-kz.delivery-secure.com/pay/1', 'halyk-online.info', 'egov-kz.com', 'https://kaspi.kz.secure-pay.info', 'jusanbank-bonus.ru', 'bcc-kz.online', 'my-forte-bank.com'],
    risky_tld: ['https://deal-safe.top', 'bonus-24.click', 'https://refund.icu/form'],
  };
  const NEGATIVE = [
    'https://kaspi.kz', 'https://pay.kaspi.kz/invoice', 'https://www.olx.kz/d/obyavlenie', 'https://egov.kz/cms/ru',
    'https://homebank.kz', 'https://kolesa.kz/a/show/1', 'https://krisha.kz', 'https://t.me/kaspi_official',
    'https://jusan.kz', 'https://bcc.kz', 'https://fortepiano-school.kz', 'https://freedomhouse.org',
    'https://google.com', 'https://example.kz/olxford', 'https://gov.kz',
  ];

  for (const [code, list] of Object.entries(POSITIVE)) {
    for (const url of list) it(`${url} → ${code}`, () => assert.equal(linkProblem(url), code));
  }
  for (const url of NEGATIVE) it(`${url} → no problem`, () => assert.equal(linkProblem(url), null));

  it('counts at least 20 positives and 15 negatives', () => {
    assert.ok(Object.values(POSITIVE).flat().length >= 20);
    assert.ok(NEGATIVE.length >= 15);
  });

  it('edit distance with transpositions', () => {
    assert.equal(editDistance('kaspi', 'kaspl'), 1);
    assert.equal(editDistance('kaspi', 'kapsi'), 1);
    assert.equal(editDistance('olx', 'olx'), 0);
  });
});

describe('#142 Kazakh phrases', () => {
  it('credential request', () => assert.ok(ids([{ content: 'SMS-кодты жіберіңіз, әйтпесе тапсырыс жойылады' }]).includes('credential_request')));
  it('credential request (құпия сөз)', () => assert.ok(ids([{ content: 'Банктің құпия сөзін айтыңыз' }]).includes('credential_request')));
  it('urgent payment', () => assert.ok(ids([{ content: 'Шұғыл түрде бүгін ғана 20 000 теңге төлеңіз' }]).includes('urgent_payment')));
  it('urgent payment in Latin transliteration', () => assert.ok(ids([{ content: 'tez arada aqsha audaryñyz' }]).includes('urgent_payment')));
  it('fake prize', () => assert.ok(ids([{ content: 'Құттықтаймыз! Сіз сыйлық ұттыңыз, салықты төлеңіз' }]).includes('fake_prize')));
  it('remote access', () => assert.ok(ids([{ content: 'AnyDesk орнатыңыз, біз көмектесеміз' }]).includes('remote_access')));
  it('mixed Russian and Kazakh', () => assert.deepEqual(ids([{ content: 'Срочно аударыңыз деньги, кодты айтыңыз' }]).sort(), ['credential_request', 'urgent_payment']));
  it('a neutral Kazakh message triggers nothing', () => assert.deepEqual(ids([{ content: 'Сәлеметсіз бе, тауар әлі сатылымда ма?' }]), []));
});

describe('#140 rule settings', () => {
  const content = { evidence: [{ id: 1, type: 'message', content: 'Срочно оплатите и пришлите код', verification: 'confirmed' }] };
  it('defaults when no settings', () => assert.equal(assessRisk(content).score, 45));
  it('a disabled rule is not counted or listed', () => {
    const r = assessRisk(content, { credential_request: { enabled: false } });
    assert.deepEqual(r.rules.map((x) => x.id), ['urgent_payment']);
    assert.equal(r.score, 20);
  });
  it('a reweighted rule uses the new weight', () => assert.equal(assessRisk(content, { urgent_payment: { weight: 50 } }).score, 75));
});
