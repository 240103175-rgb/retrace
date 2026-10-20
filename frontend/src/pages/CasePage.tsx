import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { EntitiesTab } from '../components/EntitiesTab';
import { EvidenceTab } from '../components/EvidenceTab';
import { GraphTab } from '../components/GraphTab';
import { ReportsTab } from '../components/ReportsTab';
import { RiskTab } from '../components/RiskTab';
import { ErrorBox, Field, FormError, Loading, RiskBadge, StatusPill, VerificationPill } from '../components/ui';
import { useAuth } from '../lib/auth';
import { date, dateTime } from '../lib/format';
import { EVIDENCE_TYPE, STATUS, T, t } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { CaseStatus, CaseSummary } from '../services/types';

const TABS = ['overview', 'evidence', 'entities', 'graph', 'risk', 'reports'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  overview: T.overview,
  evidence: T.evidence,
  entities: T.entities,
  graph: T.graph,
  risk: T.risk,
  reports: T.reports,
};

export interface CaseTabProps {
  caseData: CaseSummary;
  /** Owner and the case is not closed/archived. */
  editable: boolean;
  /** The signed-in user owns the case. */
  owner: boolean;
  onChanged(): void;
}

export function CasePage() {
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();
  const caseId = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'overview';
  const c = useAsync(() => api.getCase(caseId), [api, caseId]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  if (c.error) {
    return c.error.code === 'not_found' ? (
      <section className="panel center">
        <h1>{T.notFound}</h1>
        <Link to="/cases">{T.back}</Link>
      </section>
    ) : (
      <ErrorBox error={c.error} onRetry={c.reload} />
    );
  }
  if (!c.data) return <Loading />;
  const data = c.data;
  const owner = data.ownerId === user?.id;
  const locked = data.status === 'closed' || data.status === 'archived';
  const editable = owner && !locked;

  const setStatus = async (status: CaseStatus) => {
    try {
      await api.updateCase(data.id, { status });
      toast('ok', T.ok_saved);
      c.reload();
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };

  const saveDetails = async () => {
    setError(null);
    try {
      await api.updateCase(data.id, form);
      setEditing(false);
      toast('ok', T.ok_saved);
      c.reload();
    } catch (err) {
      setError(t(errorKey(err)));
    }
  };

  const props: CaseTabProps = { caseData: data, editable, owner, onChanged: c.reload };

  return (
    <>
      <Link to={user?.role === 'admin' && !owner ? '/admin' : '/cases'} className="back">
        ← {T.back}
      </Link>
      <section className="case-head panel">
        {editing ? (
          <div className="form">
            <FormError message={error} />
            <Field label={T.title}>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} />
            </Field>
            <Field label={T.description}>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={2000} />
            </Field>
            <div className="row-end">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                {T.cancel}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void saveDetails()}>
                {T.save}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="case-title">
              <h1>{data.title}</h1>
              {editable && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => (setForm({ title: data.title, description: data.description }), setEditing(true))}
                >
                  {T.edit}
                </button>
              )}
            </div>
            {data.description && <p className="muted">{data.description}</p>}
          </>
        )}
        <div className="case-meta">
          <StatusPill status={data.status} />
          <RiskBadge score={data.riskScore} level={data.riskLevel} />
          <span className="muted">
            {T.owner}: {data.ownerName} · {T.updated} {dateTime(data.updatedAt)}
          </span>
          {owner && (
            <select aria-label={T.status} value={data.status} onChange={(e) => void setStatus(e.target.value as CaseStatus)}>
              {(Object.keys(STATUS) as CaseStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS[s]}
                </option>
              ))}
            </select>
          )}
        </div>
        {owner && locked && <div className="notice">{T.locked}</div>}
        {!owner && <div className="notice">{T.readOnly}</div>}
      </section>

      <nav className="tabs" role="tablist">
        {TABS.map((tb) => (
          <button
            type="button"
            role="tab"
            key={tb}
            aria-selected={tab === tb}
            className={tab === tb ? 'is-active' : ''}
            onClick={() => setParams({ tab: tb }, { replace: true })}
          >
            {TAB_LABEL[tb]}
            {tb === 'evidence' && <span className="count">{data.evidenceCount}</span>}
            {tb === 'entities' && <span className="count">{data.entityCount}</span>}
          </button>
        ))}
      </nav>

      <section className="panel">
        {tab === 'overview' && <Overview {...props} />}
        {tab === 'evidence' && <EvidenceTab {...props} />}
        {tab === 'entities' && <EntitiesTab {...props} />}
        {tab === 'graph' && <GraphTab {...props} />}
        {tab === 'risk' && <RiskTab {...props} />}
        {tab === 'reports' && <ReportsTab {...props} />}
      </section>
    </>
  );
}

function Overview({ caseData }: CaseTabProps) {
  const api = useApi();
  const evidence = useAsync(() => api.listEvidence(caseData.id), [api, caseData.id, caseData.updatedAt]);
  return (
    <>
      <div className="stats-row">
        <div className="stat">
          <b>{caseData.evidenceCount}</b>
          {T.evidence}
        </div>
        <div className="stat">
          <b>{caseData.entityCount}</b>
          {T.entities}
        </div>
        <div className="stat">
          <b>{caseData.relationshipCount}</b>
          {T.relationships}
        </div>
        <div className="stat">
          <b>{caseData.riskScore}</b>
          {T.risk}
        </div>
      </div>
      <h2>{T.timeline}</h2>
      {evidence.error ? (
        <ErrorBox error={evidence.error} onRetry={evidence.reload} />
      ) : !evidence.data ? (
        <Loading />
      ) : evidence.data.length === 0 ? (
        <p className="muted">{T.noEvidence}</p>
      ) : (
        <ol className="timeline">
          {evidence.data.map((e) => (
            <li key={e.id}>
              <span className="tl-date">{e.observedOn ? date(e.observedOn) : '—'}</span>
              <div>
                <span className="tl-type">{EVIDENCE_TYPE[e.type]}</span> <VerificationPill value={e.verification} />
                <p>{e.content}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
