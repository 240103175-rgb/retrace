import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { LEVEL, STATUS, T, t, VERIFICATION } from '../lib/text';
import { errorKey } from '../lib/useAsync';
import type { CaseStatus, RiskLevel, Verification } from '../services/types';

export function Logo() {
  return (
    <Link to="/cases" className="logo" aria-label="Re:Trace">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="22" cy="24" r="6" />
        <circle cx="44" cy="20" r="5" opacity=".7" />
        <circle cx="36" cy="44" r="7" />
        <path d="M22 24 44 20M22 24l14 20M44 20l-8 24" />
      </svg>
      <span>
        Re<b>:</b>Trace
      </span>
    </Link>
  );
}

export function Shell({ children, mock }: { children: ReactNode; mock: boolean }) {
  const { user, signOut } = useAuth();
  return (
    <div className="shell">
      <header className="topbar">
        <Logo />
        {mock && <span className="badge-demo">{T.demoBadge}</span>}
        {user && (
          <>
            <nav className="nav">
              <NavLink to="/cases">{T.cases}</NavLink>
              {user.role === 'admin' && <NavLink to="/admin">{T.admin}</NavLink>}
            </nav>
            <div className="who">
              <span className="who-name">
                {user.name}
                <small>{user.role === 'admin' ? 'Администратор' : 'Следователь'}</small>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
                {T.logout}
              </button>
            </div>
          </>
        )}
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {T.loading}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      <strong>{T.errorTitle}</strong>
      <p>{t(errorKey(error))}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          {T.retry}
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function StatusPill({ status }: { status: CaseStatus }) {
  return <span className={`pill status-${status}`}>{STATUS[status]}</span>;
}

export function RiskBadge({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <span className={`risk risk-${level}`} title={T.disclaimer}>
      <b>{score}</b> {LEVEL[level]}
    </span>
  );
}

export function VerificationPill({ value }: { value: Verification }) {
  return <span className={`pill verify-${value}`}>{VERIFICATION[value]}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? (
    <div className="form-error" role="alert">
      {message}
    </div>
  ) : null;
}
