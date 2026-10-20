import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Field, FormError, Logo } from '../components/ui';
import { useAuth } from '../lib/auth';
import { T, t } from '../lib/text';
import { errorKey } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';

export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/cases';
}

export function LoginPage() {
  const api = useApi();
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const next = safeNext(useSearchParams()[0].get('next'));
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user && !busy) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'register' && password.length < 8) {
      setError('Пароль должен быть не короче 8 символов');
      return;
    }
    setBusy(true);
    try {
      const session = mode === 'login' ? await api.login({ email, password }) : await api.register({ email, password, name });
      signIn(session);
      navigate(next, { replace: true });
    } catch (err) {
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-card">
        <Logo />
        <p className="muted">{T.appTagline}</p>
        <h1>{mode === 'login' ? T.login : T.register}</h1>
        <FormError message={error} />
        <form className="form" onSubmit={submit}>
          {mode === 'register' && (
            <Field label={T.name}>
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" />
            </Field>
          )}
          <Field label={T.email}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
          </Field>
          <Field label={T.password}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? T.loading : mode === 'login' ? T.signIn : T.createAccount}
          </button>
        </form>
        <button type="button" className="link" onClick={() => (setMode(mode === 'login' ? 'register' : 'login'), setError(null))}>
          {mode === 'login' ? T.noAccount : T.haveAccount}
        </button>
        <p className="hint">{T.demoHint}</p>
      </section>
    </div>
  );
}
