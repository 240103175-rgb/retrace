// Draft case summary (#24): fixed templates over the case data, every factual statement citing
// the evidence and entities it rests on. Returns structured statements; the UI renders the words.
// Pure JS so the browser mock runs it too.

/**
 * @param content { evidence, entities, relationships }
 * @param risk result of assessRisk(content)
 * @returns { statements: [{ kind, params, evidenceIds, entityIds }] }
 */
export function buildSummary({ evidence = [], entities = [], relationships = [] }, risk) {
  const statements = [];
  const say = (kind, params, evidenceIds = [], entityIds = []) =>
    statements.push({ kind, params, evidenceIds: [...new Set(evidenceIds)].sort((a, b) => a - b), entityIds: [...new Set(entityIds)].sort((a, b) => a - b) });
  const ids = (list) => list.map((x) => x.id);

  say('scope', { evidence: evidence.length, entities: entities.length, relationships: relationships.length });
  if (!evidence.length) return { statements };

  const by = (v) => evidence.filter((e) => e.verification === v);
  const confirmed = by('confirmed');
  const disputed = by('disputed');
  say('verification', { confirmed: confirmed.length, unverified: by('unverified').length, disputed: disputed.length }, [...ids(confirmed), ...ids(disputed)]);

  if (risk.rules.length) {
    const refs = risk.rules.flatMap((r) => r.refs);
    say(
      'risk',
      { score: risk.score, level: risk.level, rules: risk.rules.length, onlyUnverified: risk.basedOnlyOnUnverified },
      refs.filter((x) => x.kind === 'evidence').map((x) => x.id),
      refs.filter((x) => x.kind === 'entity').map((x) => x.id),
    );
    for (const r of risk.rules) {
      say(
        'rule',
        { rule: r.id, weight: r.weight },
        r.refs.filter((x) => x.kind === 'evidence').map((x) => x.id),
        r.refs.filter((x) => x.kind === 'entity').map((x) => x.id),
      );
    }
  } else {
    say('no_rules', { score: risk.score });
  }

  const payments = evidence.filter((e) => e.type === 'payment' && e.amount != null);
  if (payments.length) say('payments', { total: payments.reduce((n, e) => n + e.amount, 0), count: payments.length }, ids(payments));

  // The most connected entity, when it links at least two others.
  const neighbours = new Map();
  for (const r of relationships) {
    for (const [a, b] of [[r.sourceId, r.targetId], [r.targetId, r.sourceId]]) {
      if (!neighbours.has(a)) neighbours.set(a, new Set());
      neighbours.get(a).add(b);
    }
  }
  const [hubId, hubSet] = [...neighbours.entries()].sort((x, y) => y[1].size - x[1].size || x[0] - y[0])[0] ?? [];
  const hub = entities.find((e) => e.id === hubId);
  if (hub && hubSet.size >= 2) {
    const rels = relationships.filter((r) => r.sourceId === hub.id || r.targetId === hub.id);
    say('hub', { label: hub.label, type: hub.type, links: hubSet.size }, rels.flatMap((r) => r.evidenceIds ?? []), [hub.id, ...hubSet]);
  }
  return { statements };
}
