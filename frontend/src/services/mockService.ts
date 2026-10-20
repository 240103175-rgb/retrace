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
});

export function createMockService(options: MockOptions = {}): RetraceApi & { failNext(code: ErrorCode, status?: number): void } {
  const latency = options.latency ?? 200;
  const now = options.now ?? Date.now;
  const repo = createMemoryRepository();
  const deps = mockDeps(now);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc: any = createServices(repo, deps);
  const ready = seed(repo, { hashPassword: deps.hashPassword, now: now() });
  let token: string | null = null;
  let pendingFailure: ApiError | null = null;

  async function call<T>(fn: () => Promise<T>): Promise<T> {
    await ready;
    if (latency) await new Promise((r) => setTimeout(r, latency));
    if (pendingFailure) {
      const err = pendingFailure;
      pendingFailure = null;
      throw err;
    }
    try {
      return structuredClone(await fn());
    } catch (err) {
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

    register: (input) => call(() => svc.register(input)),
    login: (input) => call(() => svc.login(input)),
    logout: () => call(() => svc.logout(token)),
    me: () => authed(async (u) => userDto(u) as User),

    listCases: (filter = {}) => authed((u) => svc.listCases(u, filter)),
    createCase: (input) => authed((u) => svc.createCase(u, input)),
    getCase: (id) => authed((u) => svc.getCase(u, id)),
    updateCase: (id, patch) => authed((u) => svc.updateCase(u, id, patch)),

    listEvidence: (caseId) => authed((u) => svc.listEvidence(u, caseId)),
    createEvidence: (caseId, input) => authed((u) => svc.createEvidence(u, caseId, input)),
    updateEvidence: (caseId, id, patch) => authed((u) => svc.updateEvidence(u, caseId, id, patch)),
    deleteEvidence: (caseId, id) => authed((u) => svc.deleteEvidence(u, caseId, id)),

    listEntities: (caseId) => authed((u) => svc.listEntities(u, caseId)),
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
    adminSetRole: (userId, role) => authed((u) => svc.adminSetRole(u, userId, { role })),
    adminAudit: (params = {}) => authed((u) => svc.adminAudit(u, params)),
  };
}
