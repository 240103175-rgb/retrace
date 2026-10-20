// RetraceApi over the REST API described in /openapi.yml.
import type { RetraceApi } from './api';
import { ApiError, type CaseFilter, type ErrorCode } from './types';

export function createHttpService(baseUrl = '/api/v1', fetchImpl: typeof fetch = (...a) => fetch(...a)): RetraceApi {
  let token: string | null = null;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(baseUrl + path, {
        method,
        headers: {
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError('network', 0);
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const code = (data?.error?.code as ErrorCode | undefined) ?? (res.status >= 500 ? 'server_error' : 'validation_error');
      throw new ApiError(code, res.status, data?.error?.message);
    }
    return data as T;
  }

  const qs = (params: Record<string, string | number | null | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  const filter = (f: CaseFilter = {}) => qs({ q: f.q, status: f.status, sort: f.sort });
  const c = (id: number) => `/cases/${id}`;

  return {
    setToken: (next) => {
      token = next;
    },
    register: (input) => request('POST', '/auth/register', input),
    login: (input) => request('POST', '/auth/login', input),
    logout: () => request('POST', '/auth/logout'),
    me: () => request('GET', '/me'),

    listCases: (f) => request('GET', `/cases${filter(f)}`),
    createCase: (input) => request('POST', '/cases', input),
    getCase: (id) => request('GET', c(id)),
    updateCase: (id, patch) => request('PATCH', c(id), patch),

    listEvidence: (caseId) => request('GET', `${c(caseId)}/evidence`),
    createEvidence: (caseId, input) => request('POST', `${c(caseId)}/evidence`, input),
    updateEvidence: (caseId, id, patch) => request('PATCH', `${c(caseId)}/evidence/${id}`, patch),
    deleteEvidence: (caseId, id) => request('DELETE', `${c(caseId)}/evidence/${id}`),

    listEntities: (caseId) => request('GET', `${c(caseId)}/entities`),
    createEntity: (caseId, input) => request('POST', `${c(caseId)}/entities`, input),
    updateEntity: (caseId, id, patch) => request('PATCH', `${c(caseId)}/entities/${id}`, patch),
    deleteEntity: (caseId, id) => request('DELETE', `${c(caseId)}/entities/${id}`),

    listRelationships: (caseId) => request('GET', `${c(caseId)}/relationships`),
    createRelationship: (caseId, input) => request('POST', `${c(caseId)}/relationships`, input),
    deleteRelationship: (caseId, id) => request('DELETE', `${c(caseId)}/relationships/${id}`),

    graph: (caseId) => request('GET', `${c(caseId)}/graph`),
    risk: (caseId) => request('GET', `${c(caseId)}/risk`),

    listReports: (caseId) => request('GET', `${c(caseId)}/reports`),
    createReport: (caseId) => request('POST', `${c(caseId)}/reports`),
    getReport: (caseId, id) => request('GET', `${c(caseId)}/reports/${id}`),

    adminStats: () => request('GET', '/admin/stats'),
    adminCases: (f) => request('GET', `/admin/cases${filter(f)}`),
    adminUsers: () => request('GET', '/admin/users'),
    adminSetRole: (userId, role) => request('PATCH', `/admin/users/${userId}`, { role }),
    adminAudit: (p = {}) => request('GET', `/admin/audit-events${qs({ caseId: p.caseId, limit: p.limit })}`),
  };
}
