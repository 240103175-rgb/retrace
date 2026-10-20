import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { EntitiesTab } from '../components/EntitiesTab';
import { EvidenceTab } from '../components/EvidenceTab';
import { GraphTab } from '../components/GraphTab';
import { ReportsTab } from '../components/ReportsTab';
import { RiskTab } from '../components/RiskTab';
import { CharCounter, saveDownload, useTitle } from '../components/kit';
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
  openTab?(tab: Tab): void;
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
  const [tagDraft, setTagDraft] = useState('');
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  useTitle(c.data?.title ?? T.cases);

  // #75 keep the active tab visible on narrow screens.
  useEffect(() => {
    tabRefs.current[tab]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [tab, c.data?.id]);

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

  const props: CaseTabProps = { caseData: data, editable, owner, onChanged: c.reload, openTab: (t) => setParams({ tab: t }, { replace: true }) };

  const saveTags = async (tags: string[]) => {
    try {
      await api.updateCase(data.id, { tags });
      setTagDraft('');
      c.reload();
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagDraft.trim()) {
      e.preventDefault();
      void saveTags([...data.tags, tagDraft]);
    }
  };
  const doExport = async (kind: 'json' | 'csv') => {
    try {
      saveDownload(kind === 'json' ? await api.exportCase(data.id) : await api.exportEvidenceCsv(data.id));
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };

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
            <Field label={T.description} extra={<CharCounter value={form.description} max={2000} />}>
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
        <div className="tag-row" aria-label={T.tags}>
          {data.tags.map((tag) => (
            <span className="tag" key={tag}>
              #{tag}
              {editable && (
                <button type="button" className="tag-x" aria-label={`${T.removeTag} ${tag}`} onClick={() => void saveTags(data.tags.filter((x) => x !== tag))}>
                  ×
                </button>
              )}
            </span>
          ))}
          {editable && data.tags.length < 10 && (
            <input
              className="tag-input"
              aria-label={T.addTag}
              placeholder={T.addTag}
              value={tagDraft}
              maxLength={30}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={onTagKey}
            />
          )}
        </div>
        <div className="row-start">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void doExport('json')}>
            {T.exportJson}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void doExport('csv')}>
            {T.exportCsv}
          </button>
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
            id={`tab-${tb}`}
            aria-controls="tab-panel"
            ref={(el) => {
              tabRefs.current[tb] = el;
            }}
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

      <section className="panel" role="tabpanel" id="tab-panel" aria-labelledby={`tab-${tab}`}>
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

function Overview({ caseData, editable, onChanged, openTab }: CaseTabProps) {
  const api = useApi();
  const toast = useToast();
  const evidence = useAsync(() => api.listEvidence(caseData.id), [api, caseData.id, caseData.updatedAt]);
  const [notes, setNotes] = useState(caseData.notes ?? '');
  const saveNotes = async () => {
    try {
      await api.updateCase(caseData.id, { notes });
      toast('ok', T.ok_saved);
      onChanged();
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };
  const empty = caseData.evidenceCount === 0 && caseData.entityCount === 0;
  return (
    <>
      {empty && editable && (
        <div className="checklist" data-testid="checklist">
          <h2>{T.startHere}</h2>
          <ol>
            <li>
              <button type="button" className="link" onClick={() => openTab?.('evidence')}>
                {T.step1}
              </button>
            </li>
            <li>
              <button type="button" className="link" onClick={() => openTab?.('entities')}>
                {T.step2}
              </button>
            </li>
            <li>
              <button type="button" className="link" onClick={() => openTab?.('entities')}>
                {T.step3}
              </button>
            </li>
            <li>
              <button type="button" className="link" onClick={() => openTab?.('risk')}>
                {T.step4}
              </button>
            </li>
          </ol>
        </div>
      )}
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
      <h2>{T.notes}</h2>
      <Field label={T.notes} extra={<CharCounter value={notes} max={5000} />}>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={5000} readOnly={!editable} />
      </Field>
      {editable && (
        <div className="row-end">
          <button type="button" className="btn btn-ghost btn-sm" disabled={notes === (caseData.notes ?? '')} onClick={() => void saveNotes()}>
            {T.saveNotes}
          </button>
        </div>
      )}
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
