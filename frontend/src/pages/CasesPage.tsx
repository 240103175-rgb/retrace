import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CharCounter, useTitle } from '../components/kit';
import { Empty, ErrorBox, Field, FormError, Loading, RiskBadge, StatusPill } from '../components/ui';
import { useToast } from '../lib/toast';
import { dateTime, plural } from '../lib/format';
import { EVIDENCE_FORMS, STATUS, T, t } from '../lib/text';
import { errorKey, useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { CaseSort, CaseStatus, CaseSummary } from '../services/types';

export function CaseTable({ cases, showOwner = false, onTag }: { cases: CaseSummary[]; showOwner?: boolean; onTag?(tag: string): void }) {
  return (
    <ul className="case-list">
      {cases.map((c) => (
        <li key={c.id}>
          <Link to={`/cases/${c.id}`} className="case-row" data-testid="case-row">
            <div className="case-main">
              <strong>{c.title}</strong>
              <span className="muted">
                {c.evidenceCount} {plural(c.evidenceCount, EVIDENCE_FORMS)} · {T.updated} {dateTime(c.updatedAt)}
                {showOwner && ` · ${c.ownerName}`}
              </span>
              {c.tags.length > 0 && (
                <span className="tag-row">
                  {c.tags.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      className="tag"
                      onClick={(e) => {
                        e.preventDefault();
                        onTag?.(tag);
                      }}
                    >
                      #{tag}
                    </button>
                  ))}
                </span>
              )}
            </div>
            <StatusPill status={c.status} />
            <RiskBadge score={c.riskScore} level={c.riskLevel} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CaseFilters({
  q,
  status,
  sort,
  tag = null,
  onChange,
}: {
  q: string;
  status: CaseStatus | null;
  sort: CaseSort;
  tag?: string | null;
  onChange(next: { q?: string; status?: CaseStatus | null; sort?: CaseSort; tag?: string | null }): void;
}) {
  return (
    <>
    {tag && (
      <div className="active-filter">
        {T.tags}: <b>#{tag}</b>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange({ tag: null })}>
          {T.clearFilter}
        </button>
      </div>
    )}
    <div className="filters">
      <input type="search" placeholder={T.search} aria-label={T.search} value={q} onChange={(e) => onChange({ q: e.target.value })} maxLength={100} />
      <select aria-label={T.status} value={status ?? ''} onChange={(e) => onChange({ status: (e.target.value || null) as CaseStatus | null })}>
        <option value="">{T.allStatuses}</option>
        {(Object.keys(STATUS) as CaseStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS[s]}
          </option>
        ))}
      </select>
      <select aria-label="Сортировка" value={sort} onChange={(e) => onChange({ sort: e.target.value as CaseSort })}>
        <option value="updated">{T.sortUpdated}</option>
        <option value="created">{T.sortCreated}</option>
        <option value="title">{T.sortTitle}</option>
        <option value="risk">{T.sortRisk}</option>
      </select>
    </div>
    </>
  );
}

export function useCaseFilters() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = (params.get('status') as CaseStatus | null) || null;
  const sort = (params.get('sort') as CaseSort | null) ?? 'updated';
  const tag = params.get('tag');
  const onChange = (next: { q?: string; status?: CaseStatus | null; sort?: CaseSort; tag?: string | null }) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, String(v));
      else p.delete(k);
    }
    setParams(p, { replace: true });
  };
  return { q, status, sort, tag, onChange };
}

export function CasesPage() {
  const api = useApi();
  const navigate = useNavigate();
  const { q, status, sort, tag, onChange } = useCaseFilters();
  const cases = useAsync(() => api.listCases({ q, status, sort, tag }), [api, q, status, sort, tag]);
  const toast = useToast();
  useTitle(T.cases);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 3) {
      setError('Название: от 3 до 120 символов');
      return;
    }
    setBusy(true);
    try {
      const c = await api.createCase({ title, description });
      toast('ok', T.ok_caseCreated);
      navigate(`/cases/${c.id}`);
    } catch (err) {
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const filtered = Boolean(q || status || tag);
  return (
    <>
      <div className="page-head">
        <h1>{T.cases}</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(!creating)}>
          + {T.newCase}
        </button>
      </div>
      {creating && (
        <form className="panel form" onSubmit={create}>
          <FormError message={error} />
          <Field label={T.title}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus />
          </Field>
          <Field label={T.description} extra={<CharCounter value={description} max={2000} />}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} />
          </Field>
          <div className="row-end">
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
              {T.cancel}
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {T.create}
            </button>
          </div>
        </form>
      )}
      <CaseFilters q={q} status={status} sort={sort} tag={tag} onChange={onChange} />
      {cases.error ? (
        <ErrorBox error={cases.error} onRetry={cases.reload} />
      ) : !cases.data ? (
        <Loading />
      ) : cases.data.length ? (
        <CaseTable cases={cases.data} onTag={(t) => onChange({ tag: t })} />
      ) : (
        <Empty>{filtered ? T.nothingFound : T.noCases}</Empty>
      )}
    </>
  );
}
