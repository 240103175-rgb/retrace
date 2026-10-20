// Deterministic, explainable risk rules (_docs/plan.md §4).
// Pure module: no I/O. Used by the backend services and by the frontend mockService.

export const RULES = [
  { id: 'credential_request', weight: 25 },
  { id: 'urgent_payment', weight: 20 },
  { id: 'suspicious_link', weight: 20 },
  { id: 'personal_payment', weight: 15 },
  { id: 'hub_entity', weight: 10 },
  { id: 'disputed_evidence', weight: 10 },
];

export const LEVELS = { medium: 30, high: 60 };
export const HUB_DEGREE = 3;

const CREDENTIAL = /(код|code|парол|password|\bpin\b|пин|cvv|cvc|смс|sms)/i;
const URGENT = /(срочно|сейчас же|немедленно|сегодня же|быстрее|только сегодня|urgent|asap|immediately)/i;
const PAYMENT = /(предоплат|оплат|переве|перевод|внесите|заплат|деньги|pay|transfer|deposit)/i;
const SHORTENERS = ['bit.ly', 'tinyurl.com', 'clck.ru', 'goo.gl', 't.ly', 'cutt.ly', 'is.gd', 'vk.cc'];
const BRANDS = {
  kaspi: ['kaspi.kz'],
  halyk: ['halykbank.kz', 'homebank.kz'],
  olx: ['olx.kz'],
  wildberries: ['wildberries.ru', 'wildberries.kz', 'wb.ru'],
  kolesa: ['kolesa.kz'],
  krisha: ['krisha.kz'],
  egov: ['egov.kz'],
  telegram: ['telegram.org', 't.me'],
};

/** Returns the reason a link looks suspicious, or null. */
export function linkProblem(text) {
  const raw = String(text ?? '').trim();
  const match = raw.match(/(https?:\/\/)?([a-z0-9-]+(\.[a-z0-9-]+)+)(:\d+)?(\/\S*)?/i);
  if (!match) return null;
  const hasScheme = /^https?:\/\//i.test(match[0]);
  const host = match[2].toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return 'ip_address';
  if (host.split('.').some((p) => p.startsWith('xn--'))) return 'punycode';
  if (SHORTENERS.some((s) => host === s || host.endsWith(`.${s}`))) return 'shortener';
  for (const [brand, official] of Object.entries(BRANDS)) {
    const isOfficial = official.some((d) => host === d || host.endsWith(`.${d}`));
    if (host.includes(brand) && !isOfficial) return 'lookalike';
  }
  if (hasScheme && match[1].toLowerCase() === 'http://') return 'not_https';
  return null;
}

/**
 * @param {{evidence: Array, entities: Array, relationships: Array}} c
 * @returns {{score:number, level:'low'|'medium'|'high', basedOnlyOnUnverified:boolean,
 *   rules: Array<{id:string, weight:number, refs:Array<{kind:'evidence'|'entity', id:number, label:string, detail?:string}>}>}}
 */
export function assessRisk({ evidence = [], entities = [], relationships = [] }) {
  const refsFor = {};
  const add = (rule, ref) => (refsFor[rule] ??= []).push(ref);
  const short = (s) => (String(s).length > 60 ? `${String(s).slice(0, 57)}…` : String(s));

  for (const e of evidence) {
    const ref = { kind: 'evidence', id: e.id, label: short(e.content) };
    if (e.type === 'message') {
      if (CREDENTIAL.test(e.content)) add('credential_request', ref);
      if (URGENT.test(e.content) && PAYMENT.test(e.content)) add('urgent_payment', ref);
    }
    if (e.type === 'link') {
      const problem = linkProblem(e.content);
      if (problem) add('suspicious_link', { ...ref, detail: problem });
    }
    if (e.type === 'payment') add('personal_payment', ref);
    if (e.verification === 'disputed') add('disputed_evidence', ref);
  }

  const neighbours = new Map();
  for (const r of relationships) {
    if (!neighbours.has(r.sourceId)) neighbours.set(r.sourceId, new Set());
    if (!neighbours.has(r.targetId)) neighbours.set(r.targetId, new Set());
    neighbours.get(r.sourceId).add(r.targetId);
    neighbours.get(r.targetId).add(r.sourceId);
  }
  for (const en of entities) {
    const ref = { kind: 'entity', id: en.id, label: short(en.label) };
    if (en.type === 'link') {
      const problem = linkProblem(en.label);
      if (problem) add('suspicious_link', { ...ref, detail: problem });
    }
    if (en.type === 'card' || en.type === 'wallet') add('personal_payment', ref);
    if ((neighbours.get(en.id)?.size ?? 0) >= HUB_DEGREE) add('hub_entity', { ...ref, detail: String(neighbours.get(en.id).size) });
  }

  const rules = RULES.filter((r) => refsFor[r.id]).map((r) => ({ id: r.id, weight: r.weight, refs: refsFor[r.id] }));
  const score = Math.min(100, rules.reduce((sum, r) => sum + r.weight, 0));
  return {
    score,
    level: levelFor(score),
    basedOnlyOnUnverified: !evidence.some((e) => e.verification === 'confirmed'),
    rules,
  };
}

export function levelFor(score) {
  if (score >= LEVELS.high) return 'high';
  if (score >= LEVELS.medium) return 'medium';
  return 'low';
}
