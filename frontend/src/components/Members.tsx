// #27 who the case is shared with. The owner adds, changes and removes members; a member may leave.
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { T, t } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { CaseSummary, Member, MemberRole } from '../services/types';
import { useConfirm } from './kit';
import { ErrorBox, FormError, Loading } from './ui';

export function Members({ caseData, onChanged }: { caseData: CaseSummary; onChanged(): void }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { user } = useAuth();
  const list = useAsync(() => api.listMembers(caseData.id), [api, caseData.id]);
  const owner = caseData.access === 'owner';
  const [form, setForm] = useState<{ email: string; role: MemberRole }>({ email: '', role: 'viewer' });
  const [error, setError] = useState<string | null>(null);

  const done = (msg: string) => {
    toast('ok', msg);
    list.reload();
    onChanged();
  };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.email.trim()) return setError(t('err_user_not_found'));
    try {
      await api.addMember(caseData.id, { email: form.email.trim(), role: form.role });
      setForm({ email: '', role: form.role });
      done(T.ok_memberAdded);
    } catch (err) {
      setError(t(errorKey(err)));
    }
  };
  const setRole = async (m: Member, role: MemberRole) => {
    try {
      await api.updateMember(caseData.id, m.userId, { role });
      done(T.ok_saved);
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };
  const remove = async (m: Member) => {
    const self = m.userId === user?.id;
    if (!(await confirm({ title: self ? T.leaveCase : `${T.delete}: ${m.name}?`, text: self ? T.confirmLeave : m.email }))) return;
    try {
      await api.removeMember(caseData.id, m.userId);
      if (self) navigate('/cases', { replace: true });
      else done(T.ok_deleted);
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };

  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading />;
  return (
    <div className="members" data-testid="members">
      {list.data.length === 0 ? (
        <p className="muted">{T.noMembers}</p>
      ) : (
        <ul className="member-list">
          {list.data.map((m) => (
            <li key={m.userId}>
              <span>
                <b>{m.name}</b> <span className="muted small">{m.email}</span>
              </span>
              {owner ? (
                <select aria-label={`Роль ${m.email}`} value={m.role} onChange={(e) => void setRole(m, e.target.value as MemberRole)}>
                  <option value="editor">{T.editor}</option>
                  <option value="viewer">{T.viewer}</option>
                </select>
              ) : (
                <span className="pill status-in_review">{m.role === 'editor' ? T.editor : T.viewer}</span>
              )}
              {(owner || m.userId === user?.id) && (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => void remove(m)}>
                  {m.userId === user?.id ? T.leaveCase : T.delete}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {owner && (
        <form className="member-form" onSubmit={add} noValidate>
          <FormError message={error} />
          <input type="email" aria-label={T.memberEmail} placeholder={T.memberEmail} value={form.email} maxLength={120} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select aria-label="Роль нового участника" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as MemberRole })}>
            <option value="viewer">{T.viewer}</option>
            <option value="editor">{T.editor}</option>
          </select>
          <button className="btn btn-primary btn-sm">{T.addMember}</button>
        </form>
      )}
    </div>
  );
}
