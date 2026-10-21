// #24 draft summary: renders template statements in Russian with citation chips.
import { money, plural } from '../lib/format';
import { ENTITY_TYPE, LEVEL, RULE, T } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { EntityType, RiskLevel, RuleId, Summary, SummaryStatement } from '../services/types';
import { ErrorBox, Loading } from './ui';

const n = (v: unknown) => Number(v ?? 0);
const forms = {
  evidence: ['доказательство', 'доказательства', 'доказательств'],
  entity: ['сущность', 'сущности', 'сущностей'],
  link: ['связь', 'связи', 'связей'],
  rule: ['правило', 'правила', 'правил'],
  payment: ['перевод', 'перевода', 'переводов'],
  other: ['другой сущностью', 'другими сущностями', 'другими сущностями'],
} as const;
const count = (v: unknown, f: readonly [string, string, string]) => `${n(v)} ${plural(n(v), f)}`;

export function statementText(s: SummaryStatement): string {
  const p = s.params as Record<string, unknown>;
  switch (s.kind) {
    case 'scope':
      return `В деле ${count(p.evidence, forms.evidence)}, ${count(p.entities, forms.entity)} и ${count(p.relationships, forms.link)}.`;
    case 'verification':
      return `Подтверждено: ${n(p.confirmed)}, не проверено: ${n(p.unverified)}, оспорено: ${n(p.disputed)}.`;
    case 'risk':
      return `Индикатор риска — ${n(p.score)} из 100 (${LEVEL[p.level as RiskLevel]}): сработало ${count(p.rules, forms.rule)}.${p.onlyUnverified ? ' Основано только на непроверенных данных.' : ''}`;
    case 'rule':
      return `${RULE[p.rule as RuleId]?.title ?? String(p.rule)} (+${n(p.weight)}).`;
    case 'no_rules':
      return 'Ни одно правило риска не сработало.';
    case 'payments':
      return `В доказательствах ${count(p.count, forms.payment)} на сумму ${money(n(p.total))}.`;
    case 'hub':
      return `Больше всего связей у «${String(p.label)}» (${ENTITY_TYPE[p.type as EntityType]?.toLowerCase()}): с ${count(p.links, forms.other)}.`;
    default:
      return '';
  }
}

interface ViewProps {
  summary: Summary;
  onCite?: (kind: 'evidence' | 'entity', id: number) => void;
}

export function SummaryView({ summary, onCite }: ViewProps) {
  return (
    <div className="summary" data-testid="summary">
      <p className="muted small">{T.summaryNote}</p>
      <ul className="summary-list">
        {summary.statements.map((s, i) => (
          <li key={i} className={s.kind === 'rule' ? 'summary-rule' : ''}>
            {statementText(s)}
            {[...s.evidenceIds.map((id) => ['evidence', id] as const), ...s.entityIds.map((id) => ['entity', id] as const)].map(([kind, id]) =>
              onCite ? (
                <button key={`${kind}${id}`} type="button" className="cite" aria-label={`${kind === 'evidence' ? T.citeEvidence : T.citeEntity} #${id}`} onClick={() => onCite(kind, id)}>
                  {kind === 'evidence' ? 'Д' : 'С'}#{id}
                </button>
              ) : (
                <span key={`${kind}${id}`} className="cite">
                  {kind === 'evidence' ? 'Д' : 'С'}#{id}
                </span>
              ),
            )}
          </li>
        ))}
      </ul>
      <p className="disclaimer">{T.disclaimer}</p>
    </div>
  );
}

export function CaseSummaryDraft({ caseId, version, onCite }: { caseId: number; version: string; onCite: ViewProps['onCite'] }) {
  const api = useApi();
  const s = useAsync(() => api.summary(caseId), [api, caseId, version]);
  if (s.error) return <ErrorBox error={s.error} onRetry={s.reload} />;
  if (!s.data) return <Loading />;
  return <SummaryView summary={s.data} onCite={onCite} />;
}
