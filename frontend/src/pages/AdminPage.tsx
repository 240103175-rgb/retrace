import { useAuth } from '../lib/auth';
import { dateTime } from '../lib/format';
import { STATUS, T, t } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { CaseStatus, Role } from '../services/types';
import { CaseFilters, CaseTable, useCaseFilters } from './CasesPage';
import { Empty, ErrorBox, Loading } from '../components/ui';

const ACTION: Record<string, string> = {
  'user.register': 'регистрация',
  'user.login': 'вход',
  'case.create': 'создал дело',
  'case.update': 'изменил дело',
  'evidence.create': 'добавил доказательство',
  'evidence.update': 'изменил доказательство',
  'evidence.delete': 'удалил доказательство',
  'entity.create': 'добавил сущность',
  'entity.update': 'изменил сущность',
  'entity.delete': 'удалил сущность',
  'relationship.create': 'создал связь',
  'relationship.delete': 'удалил связь',
  'report.create': 'сформировал отчёт',
};
const actionText = (a: string) =>
  ACTION[a] ??
  (a.startsWith('case.status.') ? `статус → ${STATUS[a.slice(12) as CaseStatus] ?? a.slice(12)}` : a.startsWith('user.role.') ? `роль → ${a.slice(10)}` : a);

export function AdminPage() {
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();
  const { q, status, sort, onChange } = useCaseFilters();
  const stats = useAsync(() => api.adminStats(), [api]);
  const cases = useAsync(() => api.adminCases({ q, status, sort }), [api, q, status, sort]);
  const users = useAsync(() => api.adminUsers(), [api]);
  const audit = useAsync(() => api.adminAudit({ limit: 50 }), [api]);

  const setRole = async (id: number, role: Role) => {
    try {
      await api.adminSetRole(id, role);
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
            <div className="stat stat-high">
              <b>{stats.data.highRiskCases}</b>
              {T.highRisk}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>{T.allCases}</h2>
        <CaseFilters q={q} status={status} sort={sort} onChange={onChange} />
        {cases.error ? (
          <ErrorBox error={cases.error} onRetry={cases.reload} />
        ) : !cases.data ? (
          <Loading />
        ) : cases.data.length ? (
          <CaseTable cases={cases.data} showOwner />
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
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.name}
                      {u.id === user?.id && <span className="muted"> (вы)</span>}
                    </td>
                    <td className="mono">{u.email}</td>
                    <td>
                      <select aria-label={`${T.role} ${u.email}`} value={u.role} onChange={(e) => void setRole(u.id, e.target.value as Role)}>
                        <option value="investigator">Следователь</option>
                        <option value="admin">Администратор</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>{T.auditLog}</h2>
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
                {audit.data.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{dateTime(e.at)}</td>
                    <td>{e.actorName ?? '—'}</td>
                    <td>{actionText(e.action)}</td>
                    <td className="mono small">
                      {e.resourceType} #{e.resourceId}
                      {e.caseId != null && e.resourceType !== 'case' ? ` (дело #${e.caseId})` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
