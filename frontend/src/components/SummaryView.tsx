// #24 draft summary: renders template statements in Russian with citation chips.
import { money } from '../lib/format';
import { count, ENTITY_TYPE, LEVEL, RULE, T, tf } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { EntityType, RiskLevel, RuleId, Summary, SummaryStatement } from '../services/types';
import { ErrorBox, Loading } from './ui';

const n = (v: unknown) => Number(v ?? 0);

export function statementText(s: SummaryStatement): string {
  const p = s.params as Record<string, unknown>;
  switch (s.kind) {
    case 'scope':
      return tf('sum_scope', { evidence: count(n(p.evidence), 'forms_evidence'), entities: count(n(p.entities), 'forms_entity'), links: count(n(p.relationships), 'forms_link') });
    case 'verification':
      return tf('sum_verification', { confirmed: n(p.confirmed), unverified: n(p.unverified), disputed: n(p.disputed) });
    case 'risk':
      return `${tf('sum_risk', { score: n(p.score), level: LEVEL[p.level as RiskLevel], rules: count(n(p.rules), 'forms_rule') })}${p.onlyUnverified ? ` ${T.sum_onlyUnverified}` : ''}`;
    case 'rule':
      return `${RULE[p.rule as RuleId]?.title ?? String(p.rule)} (+${n(p.weight)}).`;
    case 'no_rules':
      return T.sum_no_rules;
    case 'payments':
      return tf('sum_payments', { count: count(n(p.count), 'forms_payment'), total: money(n(p.total)) });
    case 'hub':
      return tf('sum_hub', { label: String(p.label), type: ENTITY_TYPE[p.type as EntityType]?.toLowerCase() ?? '', links: count(n(p.links), 'forms_other') });
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
                  {kind === 'evidence' ? T.citeE : T.citeN}#{id}
                </button>
              ) : (
                <span key={`${kind}${id}`} className="cite">
                  {kind === 'evidence' ? T.citeE : T.citeN}#{id}
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
