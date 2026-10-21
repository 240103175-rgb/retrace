// In-browser RetraceApi: the real domain services (backend/src/domain) over the in-memory repository,
// seeded with synthetic data. Lets the UI be built and tested before the API exists.
import { AppError } from '../../../backend/src/domain/errors.js';
import { DEMO_PASSWORD, seed } from '../../../backend/src/domain/seedData.js';
import { createServices, userDto } from '../../../backend/src/domain/services.js';
import { createMemoryRepository } from '../../../backend/src/repositories/memory.js';
import type { RetraceApi } from './api';
import { ApiError, type ErrorCode, type User } from './types';

export { DEMO_PASSWORD };

export interface MockOptions {
  /** Simulated network latency in ms (0 in tests). */
  latency?: number;
  now?: () => number;
}

// Mock-only password "hash": never used outside the browser demo.
const mockDeps = (now: () => number) => ({
  now,
  hashPassword: async (pw: string) => `mock$${pw}`,
  verifyPassword: async (pw: string, stored: string) => stored === `mock$${pw}`,
  randomToken: () => `mock-${crypto.randomUUID()}`,
  sha256: async (bytes: Uint8Array) =>
    [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join(''),
});

export function createMockService(options: MockOptions = {}): RetraceApi & { failNext(code: ErrorCode, status?: number): void; expireSession(): Promise<void> } {
  const latency = options.latency ?? 200;
  const now = options.now ?? Date.now;
  const repo = createMemoryRepository();
  const deps = mockDeps(now);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc: any = createServices(repo, deps);
  const ready = seed(repo, { hashPassword: deps.hashPassword, now: now() });
  let token: string | null = null;
  let pendingFailure: ApiError | null = null;
  let onUnauthorized: (() => void) | null = null;

  async function call<T>(fn: () => Promise<T>): Promise<T> {
    await ready;
    if (latency) await new Promise((r) => setTimeout(r, latency));
    if (pendingFailure) {
      const err = pendingFailure;
      pendingFailure = null;
      throw err;
    }
    try {
      const result = await fn();
      // Downloads carry a Blob; everything else is cloned so callers cannot mutate mock state.
      return result && typeof result === 'object' && 'blob' in result ? result : structuredClone(result);
    } catch (err) {
      if (err instanceof AppError && err.status === 401 && token && onUnauthorized) onUnauthorized();
      if (err instanceof AppError) throw new ApiError(err.code as ErrorCode, err.status, err.message);
      throw err;
    }
  }

  async function user(): Promise<User> {
    const u = await svc.userFromToken(token);
    if (!u) throw new AppError('unauthorized', 401);
    return u;
  }
  const authed = <T>(fn: (u: User) => Promise<T>) => call(async () => fn(await user()));

  return {
    failNext(code, status = 500) {
      pendingFailure = new ApiError(code, status);
    },
    setToken(next) {
      token = next;
    },
    onUnauthorized(fn) {
      onUnauthorized = fn;
    },
    /** Test hook: end the current session as if it expired. */
    async expireSession() {
      await svc.logout(token);
    },

    register: (input) => call(() => svc.register(input)),
    login: (input) => call(() => svc.login(input)),
    logout: () => call(() => svc.logout(token)),
    me: () => authed(async (u) => userDto(u) as User),
    logoutAll: () => authed((u) => svc.logoutAll(u)),
    updateMe: (input) => authed((u) => svc.updateMe(u, input)),
    changePassword: (input) => authed((u) => svc.changePassword(u, token, input)),

    listCases: (filter = {}) => authed((u) => svc.listCases(u, filter)),
    createCase: (input) => authed((u) => svc.createCase(u, input)),
    getCase: (id) => authed((u) => svc.getCase(u, id)),
    updateCase: (id, patch) => authed((u) => svc.updateCase(u, id, patch)),
    exportCase: (id) =>
      authed(async (u) => ({
        filename: `retrace-case-${id}.json`,
        blob: new Blob([JSON.stringify(await svc.exportCase(u, id), null, 2)], { type: 'application/json' }),
      })),
    exportEvidenceCsv: (id) =>
      authed(async (u) => {
        const { csv } = await svc.exportEvidenceCsv(u, id);
        return { filename: `retrace-case-${id}-evidence.csv`, blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }) };
      }),

    listEvidence: (caseId, filter = {}) => authed((u) => svc.listEvidence(u, caseId, filter)),
    createEvidence: (caseId, input) => authed((u) => svc.createEvidence(u, caseId, input)),
    updateEvidence: (caseId, id, patch) => authed((u) => svc.updateEvidence(u, caseId, id, patch)),
    deleteEvidence: (caseId, id) => authed((u) => svc.deleteEvidence(u, caseId, id)),

    listAttachments: (caseId, evidenceId) => authed((u) => svc.listAttachments(u, caseId, evidenceId)),
    uploadAttachment: (caseId, evidenceId, input) => authed((u) => svc.uploadAttachment(u, caseId, evidenceId, input)),
    downloadAttachment: (caseId, evidenceId, a) =>
      authed(async (u) => {
        const f = await svc.attachmentContent(u, caseId, evidenceId, a.id);
        return { filename: f.filename, blob: new Blob([f.data], { type: 'application/octet-stream' }) };
      }),
    deleteAttachment: (caseId, evidenceId, id) => authed((u) => svc.deleteAttachment(u, caseId, evidenceId, id)),

    listEntities: (caseId) => authed((u) => svc.listEntities(u, caseId)),
    entitySuggestions: (caseId) => authed((u) => svc.entitySuggestions(u, caseId)),
    createEntity: (caseId, input) => authed((u) => svc.createEntity(u, caseId, input)),
    updateEntity: (caseId, id, patch) => authed((u) => svc.updateEntity(u, caseId, id, patch)),
    deleteEntity: (caseId, id) => authed((u) => svc.deleteEntity(u, caseId, id)),

    listRelationships: (caseId) => authed((u) => svc.listRelationships(u, caseId)),
    createRelationship: (caseId, input) => authed((u) => svc.createRelationship(u, caseId, input)),
    deleteRelationship: (caseId, id) => authed((u) => svc.deleteRelationship(u, caseId, id)),

    graph: (caseId) => authed((u) => svc.graph(u, caseId)),
    risk: (caseId) => authed((u) => svc.risk(u, caseId)),

    listReports: (caseId) => authed((u) => svc.listReports(u, caseId)),
    createReport: (caseId) => authed((u) => svc.createReport(u, caseId)),
    getReport: (caseId, id) => authed((u) => svc.getReport(u, caseId, id)),

    adminStats: () => authed((u) => svc.adminStats(u)),
    adminCases: (filter = {}) => authed((u) => svc.adminCases(u, filter)),
    adminUsers: () => authed((u) => svc.adminUsers(u)),
    adminUpdateUser: (userId, patch) => authed((u) => svc.adminSetRole(u, userId, patch)),
    adminAudit: (params = {}) => authed((u) => svc.adminAudit(u, params)),
  };
}
