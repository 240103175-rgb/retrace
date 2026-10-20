import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApi } from '../services/ApiContext';
import type { Session, User } from '../services/types';

const STORAGE_KEY = 'retrace_token';

interface AuthValue {
  user: User | null;
  checking: boolean;
  signIn(session: Session): void;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const read = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const write = (token: string | null) => {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(() => Boolean(read()));

  useEffect(() => {
    const token = read();
    if (!token) return;
    api.setToken(token);
    api
      .me()
      .then(setUser)
      .catch(() => {
        api.setToken(null);
        write(null);
      })
      .finally(() => setChecking(false));
  }, [api]);

  const signIn = useCallback(
    (session: Session) => {
      api.setToken(session.token);
      write(session.token);
      setUser(session.user);
    },
    [api],
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      api.setToken(null);
      write(null);
      setUser(null);
    }
  }, [api]);

  const value = useMemo(() => ({ user, checking, signIn, signOut }), [user, checking, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth outside AuthProvider');
  return value;
}
