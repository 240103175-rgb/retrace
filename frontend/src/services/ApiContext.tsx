import { createContext, useContext, type ReactNode } from 'react';
import type { RetraceApi } from './api';

const ApiContext = createContext<RetraceApi | null>(null);

export function ApiProvider({ api, children }: { api: RetraceApi; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): RetraceApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi outside ApiProvider');
  return api;
}
