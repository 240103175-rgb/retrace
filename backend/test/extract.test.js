// #23 rule-based entity suggestions: patterns, look-alikes and quality on a labelled corpus.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractEntities, luhn, suggestEntities } from '../src/domain/extract.js';

const labels = (text) => extractEntities(text).map((e) => `${e.type}:${e.label}`).sort();

// Synthetic messages written like real scam reports. Each lists every entity a careful investigator would note.
const CORPUS = [
  ['Пишите в WhatsApp +7 701 234 56 78, менеджер Алия', ['phone:+7 701 234 56 78']],
  ['Звоните: 8 (747) 555-12-34 или 8-777-123-45-67', ['phone:+7 747 555 12 34', 'phone:+7 777 123 45 67']],
  ['Переведите на карту 4400 4301 2345 6789 до 18:00', ['card:4400 4301 2345 6789']],
  ['Карта Kaspi 5169-4931-0000-0002, получатель Ерлан', ['card:5169 4931 0000 0002']],
  ['Номер заказа 1234 5678 9012 3456, ожидайте', []], // fails Luhn → not a card
  ['Оплата доставки: https://olx-kz.delivery-secure.com/pay/88123.', ['link:https://olx-kz.delivery-secure.com/pay/88123']],
  ['Зайдите на www.kaspi-bonus.top и введите код', ['link:www.kaspi-bonus.top']],
  ['Ссылка (https://bit.ly/prize-kz) действует 1 час!', ['link:https://bit.ly/prize-kz']],
  ['Напишите в Telegram @kaspi_support_24 срочно', ['account:@kaspi_support_24']],
  ['Почта для чеков: Refund.Desk@mail-kz.com', ['account:refund.desk@mail-kz.com']],
  ['Отправьте USDT TRC20 на TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', ['wallet:TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE']],
  ['BTC: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', ['wallet:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq']],
  ['ETH 0x52908400098527886E0F7030069857D2E4169EE7 — комиссия', ['wallet:0x52908400098527886E0F7030069857D2E4169EE7']],
  ['Счёт KZ86 125K ZT50 0410 0100 для возврата', ['account:KZ86125KZT5004100100']],
  ['Сумма 45 000 тенге, срок 12.10.2026, код 4821', []],
  ['Позвонил +998 90 123 45 67, представился курьером', ['phone:+998901234567']],
  ['Код из SMS: 735 214. Никому не сообщайте', []],
  ['Мой номер +7(705)1112233, карта 4111 1111 1111 1111', ['phone:+7 705 111 22 33', 'card:4111 1111 1111 1111']],
  ['Аккаунт @olx_buyer_kz прислал ссылку https://olx.kz.secure-pay.info/deal', ['account:@olx_buyer_kz', 'link:https://olx.kz.secure-pay.info/deal']],
  ['Ответ на e-mail support@kaspi.kz пришёл через час', ['account:support@kaspi.kz']],
  ['Время 10:30, офис 2-й этаж, кабинет 204', []],
  ['Перевод 87012345678 через Kaspi', ['phone:+7 701 234 56 78']],
  ['ИИН 900101300123 не сообщайте никому', []],
  ['Instagram @prize.kz.official — розыгрыш', ['account:@prize.kz.official']],
  ['Скидка 50% до 31.12, промокод WINTER2026', []],
];

describe('entity extraction (#23)', () => {
  it('checks card numbers with Luhn', () => {
    assert.equal(luhn('4400 4301 2345 6789'), true);
    assert.equal(luhn('1234 5678 9012 3456'), false);
  });

  it('does not read an email as a handle or a card as a phone', () => {
    assert.deepEqual(labels('mail me: ivan@site.kz'), ['account:ivan@site.kz']);
    assert.deepEqual(labels('4400430123456789'), ['card:4400 4301 2345 6789']);
  });

  it('reaches precision and recall ≥ 0.9 on the labelled corpus', () => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    const misses = [];
    for (const [text, expected] of CORPUS) {
      const got = labels(text);
      const want = [...expected].sort();
      tp += got.filter((g) => want.includes(g)).length;
      fp += got.filter((g) => !want.includes(g)).length;
      fn += want.filter((w) => !got.includes(w)).length;
      if (JSON.stringify(got) !== JSON.stringify(want)) misses.push({ text, got, want });
    }
    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    console.log(`#23 corpus: ${CORPUS.length} texts, precision ${precision.toFixed(3)}, recall ${recall.toFixed(3)}`);
    assert.ok(precision >= 0.9, `precision ${precision} ${JSON.stringify(misses)}`);
    assert.ok(recall >= 0.9, `recall ${recall} ${JSON.stringify(misses)}`);
  });

  it('suggests across evidence, cites the sources and skips existing entities', () => {
    const evidence = [
      { id: 1, content: 'Пишите +7 701 234 56 78', source: null },
      { id: 2, content: 'Тот же номер 87012345678 и карта 4400 4301 2345 6789', source: 'Telegram @seller_kz' },
    ];
    evidence.push({ id: 3, content: 'Оплата: https://www.Pay-Secure.kz/deal/ и https://scam.example/pay/1?x=2', source: null });
    const entities = [
      { type: 'card', label: '4400-4301-2345-6789' },
      { type: 'link', label: 'pay-secure.kz/deal' }, // same link written without scheme
      { type: 'link', label: 'scam.example' }, // the site is already recorded
    ];
    const s = suggestEntities(evidence, entities);
    assert.deepEqual(
      s.map((x) => [x.type, x.label, x.evidenceIds]),
      [
        ['phone', '+7 701 234 56 78', [1, 2]],
        ['account', '@seller_kz', [2]],
      ],
    );
  });
});

describe('entity suggestions service (#23)', async () => {
  const { REPOSITORIES, setup } = await import('./helpers.js');
  for (const [kind, makeRepo] of Object.entries(REPOSITORIES)) {
    it(`suggests from the seed case and respects access (${kind})`, async () => {
      const { svc, users, olx } = await setup(makeRepo);
      assert.deepEqual(await svc.entitySuggestions(users.aigerim, olx.id), []); // the seed link's site is already an entity
      await svc.createEvidence(users.aigerim, olx.id, { type: 'message', content: 'Перезвоните на +7 701 999 88 77' });
      const before = await svc.entitySuggestions(users.aigerim, olx.id);
      assert.deepEqual(before.map((x) => x.label), ['+7 701 999 88 77']);
      for (const s of before) {
        const ev = await svc.listEvidence(users.aigerim, olx.id);
        assert.ok(s.evidenceIds.every((id) => ev.some((e) => e.id === id)), 'cites real evidence of the case');
      }
      const first = before[0];
      await svc.createEntity(users.aigerim, olx.id, { type: first.type, label: first.label });
      const after = await svc.entitySuggestions(users.aigerim, olx.id);
      assert.equal(after.some((s) => s.label === first.label), false);
      await assert.rejects(svc.entitySuggestions(users.daniyar, olx.id), (e) => e.code === 'not_found');
      assert.ok((await svc.entitySuggestions(users.admin, olx.id)).length >= 0);
    });
  }
});
