// Rule-based entity suggestions from evidence text (#23). Deterministic, no external AI:
// every suggestion can be traced to the pattern and the evidence it came from.
// Pure JS so the browser mock runs it too.

const digits = (s) => s.replace(/\D/g, '');

/** Luhn checksum: filters out random 16-digit numbers (order ids, phone pairs). */
export function luhn(number) {
  const d = digits(number);
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return d.length >= 13 && sum % 10 === 0;
}

const trimUrl = (u) => u.replace(/[.,;:!?)»"'\]]+$/, '');
const formatKzPhone = (d) => `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;

/**
 * Each rule: kind, entity type, a global regex and a function turning a match into a label
 * (or null to drop it). Order matters: earlier matches mask their text so later rules do not reuse it.
 */
const RULES = [
  { kind: 'url', type: 'link', re: /\b(?:https?:\/\/|www\.)[^\s<>"«»]+/giu, label: (m) => trimUrl(m) },
  { kind: 'email', type: 'account', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, label: (m) => m.toLowerCase() },
  { kind: 'iban', type: 'account', re: /\bKZ\d{2}(?:\s?[A-Z0-9]{4}){4}\b/g, label: (m) => m.replace(/\s/g, '') },
  { kind: 'wallet', type: 'wallet', re: /\b(?:T[1-9A-HJ-NP-Za-km-z]{33}|bc1[a-z0-9]{25,59}|0x[a-fA-F0-9]{40})\b/g, label: (m) => m },
  {
    kind: 'card',
    type: 'card',
    re: /(?<!\d)\d{4}(?:[ -]?\d{4}){3}(?!\d)/g,
    label: (m) => (luhn(m) ? digits(m).replace(/(\d{4})(?=\d)/g, '$1 ') : null),
  },
  {
    kind: 'phone',
    type: 'phone',
    // KZ numbers: +7 / 8, then 10 digits with optional spaces, dashes or brackets.
    re: /(?<![\d+])(?:\+7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)/g,
    label: (m) => formatKzPhone(`7${digits(m).slice(1)}`),
  },
  {
    kind: 'phone',
    type: 'phone',
    // Other countries: + and 9–14 digits.
    re: /(?<![\d+])\+(?!7)\d[\d\s()-]{7,16}\d(?!\d)/g,
    label: (m) => (digits(m).length >= 9 && digits(m).length <= 15 ? `+${digits(m)}` : null),
  },
  { kind: 'handle', type: 'account', re: /(?<![\w@.])@[A-Za-z][A-Za-z0-9_.]{1,30}[A-Za-z0-9_]/g, label: (m) => m.toLowerCase() },
];

/** Finds candidate entities in one text: [{ kind, type, label }], de-duplicated. */
export function extractEntities(text) {
  let rest = String(text ?? '');
  const found = new Map();
  for (const rule of RULES) {
    rest = rest.replace(rule.re, (m) => {
      const label = rule.label(m);
      if (label) found.set(`${rule.type}|${key(rule.type, label)}`, { kind: rule.kind, type: rule.type, label });
      return ' '.repeat(m.length); // mask so a card is not also read as a phone, an email not as a handle
    });
  }
  return [...found.values()];
}

/** Comparison key: digits for phones and cards; links without scheme, www. and trailing slash; case-insensitive text otherwise. */
export function key(type, label) {
  if (type === 'phone' || type === 'card') return digits(label);
  const text = String(label).trim().toLocaleLowerCase();
  return type === 'link' ? text.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') : text;
}

/**
 * Suggestions across a case's evidence, minus entities that already exist.
 * @returns [{ kind, type, label, evidenceIds }]
 */
export function suggestEntities(evidence, entities) {
  const existing = new Set(entities.map((e) => `${e.type}|${key(e.type, e.label)}`));
  const host = (k) => k.split(/[/?#]/)[0];
  const out = new Map();
  for (const ev of evidence) {
    for (const s of extractEntities(`${ev.content} ${ev.source ?? ''}`)) {
      const id = `${s.type}|${key(s.type, s.label)}`;
      if (existing.has(id)) continue;
      // A link whose site is already recorded as an entity (e.g. the bare domain) is not new information.
      if (s.type === 'link' && existing.has(`link|${host(key('link', s.label))}`)) continue;
      if (!out.has(id)) out.set(id, { ...s, evidenceIds: [] });
      if (!out.get(id).evidenceIds.includes(ev.id)) out.get(id).evidenceIds.push(ev.id);
    }
  }
  return [...out.values()];
}
