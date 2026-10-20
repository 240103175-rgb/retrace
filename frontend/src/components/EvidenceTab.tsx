import { useState, type FormEvent } from 'react';
import { date, money } from '../lib/format';
import { EVIDENCE_TYPE, T, t, VERIFICATION } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import type { CaseTabProps } from '../pages/CasePage';
import { useApi } from '../services/ApiContext';
import type { Evidence, EvidenceType, Verification } from '../services/types';
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
  const list = useAsync(() => api.listEvidence(caseData.id), [api, caseData.id]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = (e?: Evidence) => {
    setError(null);
    setEditingId(e?.id ?? null);
    setDraft(
      e
        ? { type: e.type, content: e.content, source: e.source ?? '', observedOn: e.observedOn ?? '', amount: e.amount == null ? '' : String(e.amount), verification: e.verification }
        : EMPTY,
    );
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
    if (!window.confirm(T.confirmDelete)) return;
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
          <Field label={T.content}>
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
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
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
        <Empty>{T.noEvidence}</Empty>
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
