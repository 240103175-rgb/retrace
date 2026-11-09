// #140 admin: switch risk rules off and change their weight; every change is audited by the API.
import { RULE, T, t, tf } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { RiskRuleSetting } from '../services/types';
import { ErrorBox, Loading } from './ui';

export function RiskRulesAdmin({ onChanged }: { onChanged(): void }) {
  const api = useApi();
  const toast = useToast();
  const rules = useAsync(() => api.adminRiskRules(), [api]);
  const save = async (r: RiskRuleSetting, patch: { enabled?: boolean; weight?: number }) => {
    try {
      await api.adminSetRiskRule(r.id, patch);
      toast('ok', T.ok_saved);
    } catch (err) {
      toast('err', t(errorKey(err)));
    } finally {
      rules.reload();
      onChanged();
    }
  };
  if (rules.error) return <ErrorBox error={rules.error} onRetry={rules.reload} />;
  if (!rules.data) return <Loading />;
  return (
    <>
      <p className="muted small">{T.riskRulesHint}</p>
      <div className="table-wrap">
        <table className="table" data-testid="risk-rules">
          <thead>
            <tr>
              <th>{T.rulesTriggered}</th>
              <th>{T.ruleEnabled}</th>
              <th>{T.ruleWeight}</th>
            </tr>
          </thead>
          <tbody>
            {rules.data.map((r) => (
              <tr key={r.id}>
                <td>
                  {RULE[r.id]?.title ?? r.id}
                  <div className="muted small">{tf('ruleDefault', { w: r.defaultWeight })}</div>
                </td>
                <td>
                  <input type="checkbox" aria-label={`${T.ruleEnabled}: ${RULE[r.id]?.title ?? r.id}`} checked={r.enabled} onChange={(e) => void save(r, { enabled: e.target.checked })} />
                </td>
                <td className="nowrap">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    className="weight-input"
                    aria-label={`${T.ruleWeight}: ${RULE[r.id]?.title ?? r.id}`}
                    defaultValue={r.weight}
                    key={`${r.id}-${r.weight}`}
                    onBlur={(e) => Number(e.target.value) !== r.weight && void save(r, { weight: Number(e.target.value) })}
                  />{' '}
                  {(r.weight !== r.defaultWeight || !r.enabled) && (
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => void save(r, { enabled: true, weight: r.defaultWeight })}>
                      {T.resetDefault}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
