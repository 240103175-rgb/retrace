// Synthetic demo data. All people, accounts, numbers and links are made up.
export const DEMO_PASSWORD = 'demo-password';

export const DEMO_USERS = [
  { email: 'aigerim@retrace.test', name: 'Айгерим Нурланова', role: 'investigator' },
  { email: 'daniyar@retrace.test', name: 'Данияр Сеитов', role: 'investigator' },
  { email: 'admin@retrace.test', name: 'Администратор', role: 'admin' },
];

const DAY = 24 * 60 * 60 * 1000;

const CASES = [
  {
    owner: 'aigerim@retrace.test',
    title: 'Фейковая вакансия оператора колл-центра',
    description: 'В Telegram предложили удалённую работу и попросили оплатить «обучение» перед стартом.',
    status: 'in_review',
    daysAgo: 3,
    evidence: [
      { key: 'msg1', type: 'message', content: 'Здравствуйте! Вы прошли отбор. Срочно внесите предоплату 15 000 ₸ за обучение, места заканчиваются сегодня.', source: 'Telegram, @hr_manager_astana', observedOn: '2026-10-14', verification: 'confirmed' },
      { key: 'link1', type: 'link', content: 'http://hr-kaspi-job.top/anketa', source: 'Ссылка из сообщения', observedOn: '2026-10-14', verification: 'confirmed' },
      { key: 'pay1', type: 'payment', content: 'Перевод на карту по номеру телефона', source: 'Скриншот перевода', observedOn: '2026-10-15', amount: 15000, verification: 'unverified' },
      { key: 'obs1', type: 'observation', content: 'После оплаты аккаунт перестал отвечать и удалил переписку.', source: 'Пострадавшая', observedOn: '2026-10-16', verification: 'unverified' },
    ],
    entities: [
      { key: 'hr', type: 'account', label: '@hr_manager_astana', note: 'Telegram, создан недавно' },
      { key: 'site', type: 'link', label: 'http://hr-kaspi-job.top/anketa' },
      { key: 'card', type: 'card', label: '4400 43** **** 1207' },
      { key: 'phone', type: 'phone', label: '+7 700 123 45 67', note: 'Номер для перевода' },
      { key: 'victim', type: 'person', label: 'Пострадавшая (А.)' },
    ],
    relationships: [
      { from: 'hr', to: 'victim', type: 'contacted', evidence: ['msg1'] },
      { from: 'hr', to: 'site', type: 'links_to', evidence: ['link1'] },
      { from: 'victim', to: 'card', type: 'paid', evidence: ['pay1'] },
      { from: 'phone', to: 'card', type: 'owns', evidence: [] },
      { from: 'hr', to: 'phone', type: 'same_as', evidence: [] },
    ],
  },
  {
    owner: 'aigerim@retrace.test',
    title: 'Продажа iPhone на OLX с «безопасной доставкой»',
    description: 'Покупатель прислал ссылку на «оплату доставки» и попросил код из SMS.',
    status: 'open',
    daysAgo: 1,
    evidence: [
      { key: 'm1', type: 'message', content: 'Оплатил через безопасную сделку, перейдите по ссылке и введите данные карты для получения денег.', source: 'OLX чат', observedOn: '2026-10-18', verification: 'confirmed' },
      { key: 'l1', type: 'link', content: 'https://olx-kz.delivery-secure.com/pay/88123', source: 'OLX чат', observedOn: '2026-10-18', verification: 'confirmed' },
      { key: 'm2', type: 'message', content: 'Пришлите код из SMS, это подтверждение для банка.', source: 'WhatsApp', observedOn: '2026-10-18', verification: 'unverified' },
    ],
    entities: [
      { key: 'buyer', type: 'account', label: 'Покупатель «Ерлан»' },
      { key: 'fake', type: 'link', label: 'olx-kz.delivery-secure.com' },
      { key: 'wa', type: 'phone', label: '+7 747 000 11 22' },
    ],
    relationships: [
      { from: 'buyer', to: 'fake', type: 'links_to', evidence: ['l1'] },
      { from: 'buyer', to: 'wa', type: 'same_as', evidence: ['m2'] },
    ],
  },
  {
    owner: 'daniyar@retrace.test',
    title: 'Звонок «из службы безопасности банка»',
    description: 'Звонящий представился сотрудником банка и попросил назвать CVV.',
    status: 'open',
    daysAgo: 2,
    evidence: [
      { key: 'c1', type: 'observation', content: 'Звонок с номера +7 708 555 00 00, представились службой безопасности.', source: 'Заявитель', observedOn: '2026-10-17', verification: 'unverified' },
      { key: 'c2', type: 'message', content: 'Назовите CVV, чтобы мы заблокировали подозрительную операцию.', source: 'Пересказ разговора', observedOn: '2026-10-17', verification: 'disputed' },
    ],
    entities: [{ key: 'caller', type: 'phone', label: '+7 708 555 00 00' }],
    relationships: [],
  },
];

/** Fills an empty repository with demo users and cases. Returns false if users already exist. */
export async function seed(repo, { hashPassword, now = Date.now() }) {
  if ((await repo.listUsers()).length > 0) return false;
  const users = {};
  const hash = await hashPassword(DEMO_PASSWORD);
  for (const u of DEMO_USERS) users[u.email] = await repo.createUser({ ...u, passwordHash: hash, createdAt: now - 30 * DAY });
  for (const c of CASES) {
    const at = now - c.daysAgo * DAY;
    const created = await repo.createCase({ ownerId: users[c.owner].id, title: c.title, description: c.description, status: c.status, createdAt: at, updatedAt: at });
    const ev = {};
    for (const { key, ...e } of c.evidence) {
      ev[key] = await repo.createEvidence({ caseId: created.id, amount: null, ...e, createdAt: at });
    }
    const en = {};
    for (const { key, ...e } of c.entities) en[key] = await repo.createEntity({ caseId: created.id, note: null, ...e });
    for (const r of c.relationships) {
      await repo.createRelationship({ caseId: created.id, sourceId: en[r.from].id, targetId: en[r.to].id, type: r.type, evidenceIds: r.evidence.map((k) => ev[k].id) });
    }
  }
  return true;
}
