import { useEffect, useState } from 'react';
import { useConfirm, useTitle } from '../components/kit';
import { useAuth } from '../lib/auth';
import { dateTime } from '../lib/format';
import { RULE, STATUS, T, t, tf, type TextKey } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { AuditEvent, CaseStatus, Role, RuleId, User } from '../services/types';
import { CaseFilters, CaseTable, useCaseFilters } from './CasesPage';
import { RiskRulesAdmin } from '../components/RiskRulesAdmin';
import { Empty, ErrorBox, Loading } from '../components/ui';

const ACTION_GROUPS: [string, TextKey][] = [
  ['case.', 'cases'],
  ['evidence.', 'evidence'],
  ['entity.', 'entities'],
  ['relationship.', 'relationships'],
  ['report.', 'reports'],
  ['user.', 'users'],
  ['risk.rule.', 'riskRules'],
];
const PAGE = 50;

/** Audit action → words in the current language; unknown actions are shown as they are. */
export function actionText(a: string): string {
  const key = `act_${a}` as TextKey;
  if (key in T) return T[key];
  if (a.startsWith('case.status.')) return tf('actStatus', { s: STATUS[a.slice(12) as CaseStatus] ?? a.slice(12) });
  if (a.startsWith('user.role.')) return tf('actRole', { r: a.slice(10) === 'admin' ? T.administrator : T.investigator });
  const rule = /^risk\.rule\.(\w+):(\w+)>(\w+)$/.exec(a);
  if (rule) {
    const state = (v: string) => (v === 'off' ? T.off : v);
    return tf('actRule', { rule: RULE[rule[1] as RuleId]?.title ?? rule[1], from: state(rule[2]), to: state(rule[3]) });
  }
  return a;
}

export function AdminPage() {
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  useTitle(T.admin);
  const { q, status, sort, tag, onChange } = useCaseFilters();
  const stats = useAsync(() => api.adminStats(), [api]);
  const cases = useAsync(() => api.adminCases({ q, status, sort, tag }), [api, q, status, sort, tag]);
  const users = useAsync(() => api.adminUsers(), [api]);
  const [auditFilter, setAuditFilter] = useState<{ actorId: number | null; action: string | null }>({ actorId: null, action: null });
  const audit = useAsync(() => api.adminAudit({ limit: PAGE, ...auditFilter }), [api, auditFilter.actorId, auditFilter.action]);
  const [more, setMore] = useState<AuditEvent[]>([]);
  const [hasMore, setHasMore] = useState(true);
  useEffect(() => {
    setMore([]);
    setHasMore((audit.data?.length ?? 0) === PAGE);
  }, [audit.data]);

  const loadMore = async () => {
    try {
      const page = await api.adminAudit({ limit: PAGE, offset: (audit.data?.length ?? 0) + more.length, ...auditFilter });
      setMore([...more, ...page]);
      setHasMore(page.length === PAGE);
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };

  const update = async (u: User, patch: { role?: Role; disabled?: boolean }) => {
    if (patch.disabled && !(await confirm({ title: `${T.disable}: ${u.name}?`, text: T.confirmDisable, confirmLabel: T.disable }))) return;
    try {
      await api.adminUpdateUser(u.id, patch);
      toast('ok', T.ok_saved);
    } catch (err) {
      toast('err', t(errorKey(err)));
    } finally {
      users.reload();
      audit.reload();
    }
  };

  return (
    <>
      <h1>{T.admin}</h1>
      <section className="panel">
        <h2>{T.stats}</h2>
        {stats.error ? (
          <ErrorBox error={stats.error} onRetry={stats.reload} />
        ) : !stats.data ? (
          <Loading />
        ) : (
          <div className="stats-row">
            <div className="stat">
              <b>{stats.data.users}</b>
              {T.users}
            </div>
            <div className="stat">
              <b>{stats.data.cases}</b>
              {T.cases}
            </div>
            {(Object.keys(STATUS) as CaseStatus[]).map((s) => (
              <div className="stat" key={s}>
                <b>{stats.data!.casesByStatus[s]}</b>
                {STATUS[s]}
              </div>
            ))}
            <div className="stat">
              <b>{stats.data.evidence}</b>
              {T.evidence}
            </div>
            <div className="stat">
              <b>{stats.data.casesLast7Days}</b>
              {T.last7days}
            </div>
            <div className="stat stat-high">
              <b>{stats.data.highRiskCases}</b>
              {T.highRisk}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>{T.allCases}</h2>
        <CaseFilters q={q} status={status} sort={sort} tag={tag} onChange={onChange} />
        {cases.error ? (
          <ErrorBox error={cases.error} onRetry={cases.reload} />
        ) : !cases.data ? (
          <Loading />
        ) : cases.data.length ? (
          <CaseTable cases={cases.data} showOwner onTag={(x) => onChange({ tag: x })} />
        ) : (
          <Empty>{T.nothingFound}</Empty>
        )}
      </section>

      <section className="panel">
        <h2>{T.users}</h2>
        {users.error ? (
          <ErrorBox error={users.error} onRetry={users.reload} />
        ) : !users.data ? (
          <Loading />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{T.name}</th>
                  <th>{T.email}</th>
                  <th>{T.role}</th>
                  <th>{T.status}</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.name}
                      {u.id === user?.id && <span className="muted"> {T.you}</span>}
                    </td>
                    <td className="mono">{u.email}</td>
                    <td>
                      <select aria-label={`${T.role} ${u.email}`} value={u.role} onChange={(e) => void update(u, { role: e.target.value as Role })}>
                        <option value="investigator">{T.investigator}</option>
                        <option value="admin">{T.administrator}</option>
                      </select>
                    </td>
                    <td className="nowrap">
                      <span className={`pill ${u.disabled ? 'status-archived' : 'verify-confirmed'}`}>{u.disabled ? T.disabledUser : T.active}</span>{' '}
                      {u.id !== user?.id && (
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => void update(u, { disabled: !u.disabled })}>
                          {u.disabled ? T.enable : T.disable}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>{T.riskRules}</h2>
        <RiskRulesAdmin onChanged={() => (stats.reload(), cases.reload(), audit.reload())} />
      </section>

      <section className="panel">
        <h2>{T.auditLog}</h2>
        <div className="filters filters-2">
          <select
            aria-label={T.who}
            value={auditFilter.actorId ?? ''}
            onChange={(e) => setAuditFilter({ ...auditFilter, actorId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">{T.everyone}</option>
            {users.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select aria-label={T.action} value={auditFilter.action ?? ''} onChange={(e) => setAuditFilter({ ...auditFilter, action: e.target.value || null })}>
            <option value="">{T.allActions}</option>
            {ACTION_GROUPS.map(([prefix, label]) => (
              <option key={prefix} value={prefix}>
                {T[label]}
              </option>
            ))}
          </select>
        </div>
        {audit.error ? (
          <ErrorBox error={audit.error} onRetry={audit.reload} />
        ) : !audit.data ? (
          <Loading />
        ) : (
          <div className="table-wrap">
            <table className="table" data-testid="audit">
              <thead>
                <tr>
                  <th>{T.when}</th>
                  <th>{T.who}</th>
                  <th>{T.action}</th>
                  <th>{T.resource}</th>
                </tr>
              </thead>
              <tbody>
                {[...audit.data, ...more].map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{dateTime(e.at)}</td>
                    <td>{e.actorName ?? '—'}</td>
                    <td>{actionText(e.action)}</td>
                    <td className="mono small">
                      {e.resourceType} #{e.resourceId}
                      {e.caseId != null && e.resourceType !== 'case' ? ` ${tf('inCase', { id: e.caseId })}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadMore()}>
                {T.showMore}
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
