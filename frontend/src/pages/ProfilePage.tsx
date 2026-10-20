import { useState, type FormEvent } from 'react';
import { useConfirm, useTitle } from '../components/kit';
import { Field, FormError } from '../components/ui';
import { useAuth } from '../lib/auth';
import { T, t } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';

export function ProfilePage() {
  const api = useApi();
  const { user, setUser, signOut } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  useTitle(T.profile);
  const [name, setName] = useState(user?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: '', next: '', repeat: '' });
  const [pwError, setPwError] = useState<string | null>(null);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    setNameError(null);
    if (name.trim().length < 2) return setNameError(T.nameLength);
    try {
      setUser(await api.updateMe({ name }));
      toast('ok', T.ok_saved);
    } catch (err) {
      setNameError(t(errorKey(err)));
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (pw.next.length < 8) return setPwError(T.passwordShort);
    if (pw.next !== pw.repeat) return setPwError(T.passwordsDiffer);
    try {
      await api.changePassword({ currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '', repeat: '' });
      toast('ok', T.passwordChanged);
    } catch (err) {
      setPwError(t(errorKey(err)));
    }
  };

  const logoutAll = async () => {
    if (!(await confirm({ title: T.logoutAll, confirmLabel: T.logoutAll }))) return;
    try {
      await api.logoutAll();
    } finally {
      await signOut().catch(() => {});
    }
  };

  return (
    <>
      <h1>{T.profile}</h1>
      <p className="muted">{user?.email}</p>
      <form className="panel form narrow" onSubmit={saveName}>
        <h2>{T.changeName}</h2>
        <FormError message={nameError} />
        <Field label={T.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required />
        </Field>
        <div className="row-end">
          <button className="btn btn-primary">{T.save}</button>
        </div>
      </form>
      <form className="panel form narrow" onSubmit={savePassword} noValidate>
        <h2>{T.changePassword}</h2>
        <FormError message={pwError} />
        <Field label={T.currentPassword}>
          <input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        </Field>
        <Field label={T.newPassword}>
          <input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        </Field>
        <Field label={T.repeatPassword}>
          <input type="password" autoComplete="new-password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} />
        </Field>
        <div className="row-end">
          <button className="btn btn-primary">{T.changePassword}</button>
        </div>
      </form>
      <section className="panel narrow">
        <button type="button" className="btn btn-danger" onClick={() => void logoutAll()}>
          {T.logoutAll}
        </button>
      </section>
    </>
  );
}
