// Deterministic, explainable risk rules (_docs/plan.md §4).
// Pure module: no I/O. Used by the backend services and by the frontend mockService.

export const RULES = [
  { id: 'credential_request', weight: 25 },
  { id: 'urgent_payment', weight: 20 },
  { id: 'remote_access', weight: 20 },
  { id: 'suspicious_link', weight: 20 },
  { id: 'personal_payment', weight: 15 },
  { id: 'fake_prize', weight: 15 },
  { id: 'seen_elsewhere', weight: 15 },
  { id: 'hub_entity', weight: 10 },
  { id: 'disputed_evidence', weight: 10 },
];

export const LEVELS = { medium: 30, high: 60 };
export const HUB_DEGREE = 3;

// Russian, English and Kazakh (#142) phrasings, incl. common Latin transliterations of Kazakh.
const CREDENTIAL = /(код|code|парол|password|\bpin\b|пин|cvv|cvc|смс|sms|құпия ?сөз|купия ?соз|qupiya ?soz|kupiya ?soz)/i;
const URGENT =
  /(срочно|сейчас же|немедленно|сегодня же|быстрее|только сегодня|urgent|asap|immediately|шұғыл|шугыл|tez arada|тез арада|дереу|бүгін ғана|бугин гана|bugin gana|қазір|казир|qazir)/i;
const PAYMENT =
  /(предоплат|оплат|переве|перевод|внесите|заплат|деньги|pay|transfer|deposit|төле|толе|tole|аудар|audar|ақша|акша|aqsha|салым)/i;
const REMOTE_ACCESS = /(anydesk|teamviewer|rustdesk|quick ?support|удал[её]нн\S* доступ|демонстраци\S* экран|қашықтан қол ?жеткіз|экранды көрсет)/i;
const PRIZE = /(выигр|приз|лотере|розыгрыш|prize|lottery|you won|ұтыс|ұтт|утыс|сыйлық|сыйлык|syilyq|жүлде|жулде|zhulde)/i;
const FEE = /(налог|комисси|пошлин|оплат|доставк|fee|tax|салық|салык|salyq|комиссия|жеткізу|төле|толе)/i;
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
  jusan: ['jusan.kz', 'jusanbank.kz'],
  freedom: ['ffin.kz', 'freedombank.kz', 'bankffin.kz'],
  forte: ['forte.kz', 'fortebank.com'],
  bcc: ['bcc.kz'],
  homecredit: ['homecredit.kz'],
};
// #138 brands short or common enough that only a whole label (between dots/dashes) counts.
const WHOLE_LABEL_BRANDS = new Set(['olx', 'egov', 'bcc', 'forte', 'freedom']);
const OFFICIAL = Object.values(BRANDS).flat();
/** Second-level names of official domains: kaspi, halykbank, olx … — targets for typosquatting. */
const OFFICIAL_NAMES = [...new Set(OFFICIAL.map((d) => d.split('.').slice(-2)[0]).filter((n) => n.length >= 3 && n !== 't'))];
const RISKY_TLDS = ['top', 'xyz', 'click', 'icu', 'shop', 'online', 'site', 'buzz', 'live', 'rest', 'cfd', 'sbs', 'monster', 'zip', 'mov', 'quest', 'cyou', 'lol', 'bond'];
const HOMOGLYPHS = [[/0/g, 'o'], [/1/g, 'l'], [/3/g, 'e'], [/4/g, 'a'], [/5/g, 's'], [/7/g, 't'], [/rn/g, 'm'], [/vv/g, 'w']];
const unglyph = (s) => HOMOGLYPHS.reduce((t, [re, ch]) => t.replace(re, ch), s);

/** Damerau–Levenshtein distance limited to small strings (domain labels). */
export function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** #138 a domain name that is one typo or one look-alike character away from an official one. */
function typosquatOf(host) {
  const name = host.split('.').slice(-2)[0];
  const plain = unglyph(name);
  return OFFICIAL_NAMES.find((official) => {
    if (name === official) return false; // same name on another TLD is handled by the brand check
    if (plain === official) return true; // 0lx, ka5pi
    return official.length >= 5 && editDistance(plain, official) === 1; // kaspl, halykbnk
  });
}

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
  const isOfficial = OFFICIAL.some((d) => host === d || host.endsWith(`.${d}`));
  if (!isOfficial) {
    const labels = host.split(/[.-]/);
    for (const brand of Object.keys(BRANDS)) {
      if (WHOLE_LABEL_BRANDS.has(brand) ? labels.includes(brand) : host.includes(brand)) return 'lookalike';
    }
    if (typosquatOf(host)) return 'typosquat';
    if (RISKY_TLDS.includes(host.split('.').pop())) return 'risky_tld';
  }
  if (hasScheme && match[1].toLowerCase() === 'http://') return 'not_https';
  return null;
}

/**
 * @param {{evidence: Array, entities: Array, relationships: Array}} c
 * @returns {{score:number, level:'low'|'medium'|'high', basedOnlyOnUnverified:boolean,
 *   rules: Array<{id:string, weight:number, refs:Array<{kind:'evidence'|'entity', id:number, label:string, detail?:string}>}>}}
 */
export function assessRisk({ evidence = [], entities = [], relationships = [], matches = null }, settings = null) {
  const refsFor = {};
  const add = (rule, ref) => (refsFor[rule] ??= []).push(ref);
  const short = (s) => (String(s).length > 60 ? `${String(s).slice(0, 57)}…` : String(s));

  for (const e of evidence) {
    const ref = { kind: 'evidence', id: e.id, label: short(e.content) };
    if (e.type === 'message') {
      if (CREDENTIAL.test(e.content)) add('credential_request', ref);
      if (URGENT.test(e.content) && PAYMENT.test(e.content)) add('urgent_payment', ref);
      if (PRIZE.test(e.content) && FEE.test(e.content)) add('fake_prize', ref);
    }
    if ((e.type === 'message' || e.type === 'observation') && REMOTE_ACCESS.test(e.content)) add('remote_access', ref);
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
    // #136 the same phone/card/link is recorded in other investigations (count only).
    const elsewhere = matches?.get(en.id) ?? 0;
    if (elsewhere > 0) add('seen_elsewhere', { ...ref, detail: `cases:${elsewhere}` });
  }

  // #140 admin settings: a rule can be switched off or reweighted; missing settings mean the defaults.
  const ruleSettings = (r) => ({ enabled: settings?.[r.id]?.enabled ?? true, weight: settings?.[r.id]?.weight ?? r.weight });
  const rules = RULES.filter((r) => refsFor[r.id] && ruleSettings(r).enabled).map((r) => ({ id: r.id, weight: ruleSettings(r).weight, refs: refsFor[r.id] }));
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
