// RetraceApi over the REST API described in /openapi.yml.
import type { RetraceApi } from './api';
import { ApiError, type CaseFilter, type Download, type ErrorCode } from './types';

export function createHttpService(baseUrl = '/api/v1', fetchImpl: typeof fetch = (...a) => fetch(...a)): RetraceApi {
  let token: string | null = null;

  /** Called on any 401 while a token is set (#78). */
  let onUnauthorized: (() => void) | null = null;

  async function download(path: string, filename: string): Promise<Download> {
    let res: Response;
    try {
      res = await fetchImpl(baseUrl + path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    } catch {
      throw new ApiError('network', 0);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError((data?.error?.code as ErrorCode | undefined) ?? 'server_error', res.status);
    }
    const cd = res.headers.get('content-disposition') ?? '';
    const star = /filename\*=UTF-8''([^;]+)/.exec(cd)?.[1];
    const name = star ? decodeURIComponent(star) : (/filename="([^"]+)"/.exec(cd)?.[1] ?? filename);
    return { filename: name, blob: await res.blob() };
  }

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
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
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
  const filter = (f: CaseFilter = {}) => qs({ q: f.q, status: f.status, sort: f.sort, tag: f.tag, limit: f.limit, offset: f.offset });
  const c = (id: number) => `/cases/${id}`;

  return {
    setToken: (next) => {
      token = next;
    },
    onUnauthorized: (fn) => {
      onUnauthorized = fn;
    },
    register: (input) => request('POST', '/auth/register', input),
    login: (input) => request('POST', '/auth/login', input),
    logout: () => request('POST', '/auth/logout'),
    me: () => request('GET', '/me'),
    logoutAll: () => request('POST', '/auth/logout-all'),
    updateMe: (input) => request('PATCH', '/me', input),
    changePassword: (input) => request('POST', '/me/password', input),

    listCases: (f) => request('GET', `/cases${filter(f)}`),
    createCase: (input) => request('POST', '/cases', input),
    getCase: (id) => request('GET', c(id)),
    updateCase: (id, patch) => request('PATCH', c(id), patch),
    exportCase: (id) => download(`${c(id)}/export`, `retrace-case-${id}.json`),
    exportEvidenceCsv: (id) => download(`${c(id)}/evidence.csv`, `retrace-case-${id}-evidence.csv`),

    listEvidence: (caseId, f = {}) => request('GET', `${c(caseId)}/evidence${qs({ q: f.q, type: f.type, verification: f.verification })}`),
    createEvidence: (caseId, input) => request('POST', `${c(caseId)}/evidence`, input),
    updateEvidence: (caseId, id, patch) => request('PATCH', `${c(caseId)}/evidence/${id}`, patch),
    deleteEvidence: (caseId, id) => request('DELETE', `${c(caseId)}/evidence/${id}`),

    listAttachments: (caseId, evidenceId) => request('GET', `${c(caseId)}/evidence/${evidenceId}/attachments`),
    uploadAttachment: (caseId, evidenceId, input) => request('POST', `${c(caseId)}/evidence/${evidenceId}/attachments`, input),
    downloadAttachment: (caseId, evidenceId, a) => download(`${c(caseId)}/evidence/${evidenceId}/attachments/${a.id}/content`, a.filename),
    deleteAttachment: (caseId, evidenceId, id) => request('DELETE', `${c(caseId)}/evidence/${evidenceId}/attachments/${id}`),

    listEntities: (caseId) => request('GET', `${c(caseId)}/entities`),
    entitySuggestions: (caseId) => request('GET', `${c(caseId)}/entity-suggestions`),
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
    adminUpdateUser: (userId, patch) => request('PATCH', `/admin/users/${userId}`, patch),
    adminAudit: (p = {}) =>
      request('GET', `/admin/audit-events${qs({ caseId: p.caseId, limit: p.limit, offset: p.offset, actorId: p.actorId, action: p.action })}`),
  };
}
