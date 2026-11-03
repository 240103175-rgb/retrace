import { useEffect, useState } from 'react';
import { useConfirm, useTitle } from '../components/kit';
import { useAuth } from '../lib/auth';
import { dateTime } from '../lib/format';
import { STATUS, T, t } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { AuditEvent, CaseStatus, Role, User } from '../services/types';
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
const ACTION_GROUPS: [string, string][] = [
  ['case.', 'Дела'],
  ['evidence.', 'Доказательства'],
  ['entity.', 'Сущности'],
  ['relationship.', 'Связи'],
  ['report.', 'Отчёты'],
  ['user.', 'Пользователи'],
];
const PAGE = 50;

const actionText = (a: string) =>
  ({ 'case.export': 'экспортировал дело', 'evidence.attachment.add': 'прикрепил файл', 'evidence.attachment.delete': 'удалил файл', 'user.update': 'изменил имя', 'user.password': 'сменил пароль', 'user.logout_all': 'вышел на всех устройствах', 'user.disabled': 'отключил пользователя', 'user.enabled': 'включил пользователя' } as Record<string, string>)[a] ??
  ACTION[a] ??
  (a.startsWith('case.status.') ? `статус → ${STATUS[a.slice(12) as CaseStatus] ?? a.slice(12)}` : a.startsWith('user.role.') ? `роль → ${a.slice(10)}` : a);

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
              За 7 дней
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
                      {u.id === user?.id && <span className="muted"> (вы)</span>}
                    </td>
                    <td className="mono">{u.email}</td>
                    <td>
                      <select aria-label={`${T.role} ${u.email}`} value={u.role} onChange={(e) => void update(u, { role: e.target.value as Role })}>
                        <option value="investigator">Следователь</option>
                        <option value="admin">Администратор</option>
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
                {label}
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
                      {e.caseId != null && e.resourceType !== 'case' ? ` (дело #${e.caseId})` : ''}
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
