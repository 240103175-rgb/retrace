import { useState, type FormEvent } from 'react';
import { date, money } from '../lib/format';
import { EVIDENCE_TYPE, T, t, VERIFICATION } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import type { CaseTabProps } from '../pages/CasePage';
import { useApi } from '../services/ApiContext';
import type { Evidence, EvidenceType, Verification } from '../services/types';
import { CharCounter, useConfirm, useDiscardGuard, useUnsavedWarning } from './kit';
import { Empty, ErrorBox, Field, FormError, Loading, VerificationPill } from './ui';

interface Draft {
  type: EvidenceType;
  content: string;
  source: string;
  observedOn: string;
  amount: string;
  verification: Verification;
}
const EMPTY: Draft = { type: 'message', content: '', source: '', observedOn: '', amount: '', verification: 'unverified' };

export function EvidenceTab({ caseData, editable, onChanged }: CaseTabProps) {
  const api = useApi();
  const toast = useToast();
  const [filter, setFilter] = useState<{ q: string; type: EvidenceType | ''; verification: Verification | '' }>({ q: '', type: '', verification: '' });
  const list = useAsync(
    () => api.listEvidence(caseData.id, { q: filter.q, type: filter.type || null, verification: filter.verification || null }),
    [api, caseData.id, filter.q, filter.type, filter.verification],
  );
  const confirm = useConfirm();
  const guard = useDiscardGuard();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initial, setInitial] = useState<Draft | null>(null);
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(initial);
  useUnsavedWarning(dirty);

  const open = (e?: Evidence) => {
    setError(null);
    setEditingId(e?.id ?? null);
    const d: Draft = e
      ? { type: e.type, content: e.content, source: e.source ?? '', observedOn: e.observedOn ?? '', amount: e.amount == null ? '' : String(e.amount), verification: e.verification }
      : EMPTY;
    setDraft(d);
    setInitial(d);
  };

  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!draft) return;
    if (!draft.content.trim()) {
      setError('Содержание: от 1 до 5000 символов');
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      type: draft.type,
      content: draft.content,
      source: draft.source || null,
      observedOn: draft.observedOn || null,
      amount: draft.type === 'payment' && draft.amount !== '' ? Number(draft.amount) : null,
      verification: draft.verification,
    };
    try {
      if (editingId) await api.updateEvidence(caseData.id, editingId, body);
      else await api.createEvidence(caseData.id, body);
      toast('ok', editingId ? T.ok_saved : T.ok_created);
      setDraft(null);
      list.reload();
      onChanged();
    } catch (err) {
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: Evidence) => {
    if (!(await confirm({ title: T.confirmDelete, text: e.content.slice(0, 120) }))) return;
    try {
      await api.deleteEvidence(caseData.id, e.id);
      toast('ok', T.ok_deleted);
      list.reload();
      onChanged();
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };

  return (
    <>
      <div className="tab-head">
        <h2>{T.evidence}</h2>
        {editable && !draft && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => open()}>
            + {T.add}
          </button>
        )}
      </div>
      <div className="filters filters-3" role="search">
        <input type="search" aria-label={T.searchEvidence} placeholder={T.searchEvidence} value={filter.q} maxLength={100} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <select aria-label={T.type} value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value as EvidenceType | '' })}>
          <option value="">{T.allTypes}</option>
          {(Object.keys(EVIDENCE_TYPE) as EvidenceType[]).map((k) => (
            <option key={k} value={k}>
              {EVIDENCE_TYPE[k]}
            </option>
          ))}
        </select>
        <select aria-label={T.verification} value={filter.verification} onChange={(e) => setFilter({ ...filter, verification: e.target.value as Verification | '' })}>
          <option value="">{T.anyVerification}</option>
          {(Object.keys(VERIFICATION) as Verification[]).map((k) => (
            <option key={k} value={k}>
              {VERIFICATION[k]}
            </option>
          ))}
        </select>
      </div>
      {draft && (
        <form className="form subpanel" onSubmit={save} noValidate>
          <FormError message={error} />
          <div className="grid-2">
            <Field label={T.type}>
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as EvidenceType })}>
                {(Object.keys(EVIDENCE_TYPE) as EvidenceType[]).map((k) => (
                  <option key={k} value={k}>
                    {EVIDENCE_TYPE[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={T.verification}>
              <select value={draft.verification} onChange={(e) => setDraft({ ...draft, verification: e.target.value as Verification })}>
                {(Object.keys(VERIFICATION) as Verification[]).map((k) => (
                  <option key={k} value={k}>
                    {VERIFICATION[k]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={T.content} extra={<CharCounter value={draft.content} max={5000} />}>
            <textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} rows={3} maxLength={5000} />
          </Field>
          <div className="grid-2">
            <Field label={T.source}>
              <input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} maxLength={200} />
            </Field>
            <Field label={T.observedOn}>
              <input type="date" value={draft.observedOn} onChange={(e) => setDraft({ ...draft, observedOn: e.target.value })} />
            </Field>
          </div>
          {draft.type === 'payment' && (
            <Field label={T.amount}>
              <input type="number" min={0} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            </Field>
          )}
          <div className="row-end">
            <button type="button" className="btn btn-ghost" onClick={() => void guard(dirty).then((ok) => ok && setDraft(null))}>
              {T.cancel}
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? T.saving : T.save}
            </button>
          </div>
        </form>
      )}
      {list.error ? (
        <ErrorBox error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.length === 0 ? (
        <Empty>{filter.q || filter.type || filter.verification ? T.nothingFound : T.noEvidence}</Empty>
      ) : (
        <ul className="items">
          {list.data.map((e) => (
            <li key={e.id} className={`item verify-row-${e.verification}`} data-testid="evidence-row">
              <div className="item-head">
                <span className="tl-type">{EVIDENCE_TYPE[e.type]}</span>
                <VerificationPill value={e.verification} />
                {e.observedOn && <span className="muted">{date(e.observedOn)}</span>}
                {e.amount != null && <span className="mono">{money(e.amount)}</span>}
              </div>
              <p className={e.type === 'link' ? 'mono break' : ''}>{e.content}</p>
              {e.source && (
                <p className="muted small">
                  {T.source}: {e.source}
                </p>
              )}
              {editable && (
                <div className="item-actions">
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => open(e)}>
                    {T.edit}
                  </button>
                  <button type="button" className="btn btn-danger btn-xs" onClick={() => void remove(e)}>
                    {T.delete}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
