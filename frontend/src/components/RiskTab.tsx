import { LEVEL, LINK_PROBLEM, RULE, T } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import type { CaseTabProps } from '../pages/CasePage';
import { useApi } from '../services/ApiContext';
import type { Risk } from '../services/types';
import { ErrorBox, Loading } from './ui';

export function RiskView({ risk }: { risk: Risk }) {
  return (
    <div className="risk-view" data-testid="risk-view">
      <div className={`risk-score risk-${risk.level}`}>
        <span className="risk-number">{risk.score}</span>
        <span>
          <b>{LEVEL[risk.level]}</b>
          <small>{T.score} 0–100</small>
        </span>
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${risk.score}%` }} />
        </div>
      </div>
      {risk.basedOnlyOnUnverified && <div className="notice">{T.onlyUnverified}</div>}
      <h3>{T.rulesTriggered}</h3>
      {risk.rules.length === 0 ? (
        <p className="muted">{T.noRules}</p>
      ) : (
        <ul className="rules">
          {risk.rules.map((r) => (
            <li key={r.id}>
              <div className="rule-head">
                <b>{RULE[r.id].title}</b>
                <span className="weight">+{r.weight}</span>
              </div>
              <p className="muted small">{RULE[r.id].hint}</p>
              <p className="small">{T.triggeredBy}:</p>
              <ul className="refs">
                {r.refs.map((ref) => (
                  <li key={`${ref.kind}-${ref.id}`}>
                    <span className="ref-kind">{ref.kind === 'evidence' ? 'доказательство' : 'сущность'}</span> {ref.label}
                    {ref.detail && <em> — {LINK_PROBLEM[ref.detail] ?? `${ref.detail} связи`}</em>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="disclaimer">{T.disclaimer}</p>
    </div>
  );
}

export function RiskTab({ caseData }: CaseTabProps) {
  const api = useApi();
  const risk = useAsync(() => api.risk(caseData.id), [api, caseData.id, caseData.updatedAt]);
  if (risk.error) return <ErrorBox error={risk.error} onRetry={risk.reload} />;
  if (!risk.data) return <Loading />;
  return <RiskView risk={risk.data} />;
}
