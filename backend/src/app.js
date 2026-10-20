// HTTP adapter: routes, auth, JSON errors. Business rules live in domain/services.js.
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { nodeDeps } from './crypto.js';
import { AppError } from './domain/errors.js';
import { createServices, userDto } from './domain/services.js';

/**
 * @param {object} o
 * @param {object} o.repo repository (memory or sql)
 * @param {() => number} [o.now]
 * @param {string|null} [o.staticDir] built frontend (frontend/dist)
 */
export function createApp({ repo, now = Date.now, staticDir = null }) {
  const svc = createServices(repo, nodeDeps(now));
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  const h = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      next(err);
    }
  };
  const bearer = (req) => /^Bearer (.+)$/.exec(req.get('authorization') ?? '')?.[1] ?? null;

  api.use(async (req, _res, next) => {
    try {
      req.token = bearer(req);
      req.user = await svc.userFromToken(req.token);
      next();
    } catch (err) {
      next(err);
    }
  });
  const open = new Set(['/auth/register', '/auth/login']);
  api.use((req, _res, next) => (open.has(req.path) || req.user ? next() : next(new AppError('unauthorized', 401))));

  const id = (v) => Number(v);
  const filter = (q) => ({ q: q.q ?? '', status: q.status || null, sort: q.sort || 'updated' });

  api.post('/auth/register', h(async (req, res) => res.status(201).json(await svc.register(req.body ?? {}))));
  api.post('/auth/login', h(async (req, res) => res.json(await svc.login(req.body ?? {}))));
  api.post('/auth/logout', h(async (req, res) => (await svc.logout(req.token), res.status(204).end())));
  api.get('/me', (req, res) => res.json(userDto(req.user)));

  api.get('/cases', h(async (req, res) => res.json(await svc.listCases(req.user, filter(req.query)))));
  api.post('/cases', h(async (req, res) => res.status(201).json(await svc.createCase(req.user, req.body ?? {}))));
  api.get('/cases/:caseId', h(async (req, res) => res.json(await svc.getCase(req.user, id(req.params.caseId)))));
  api.patch('/cases/:caseId', h(async (req, res) => res.json(await svc.updateCase(req.user, id(req.params.caseId), req.body ?? {}))));

  const crud = (path, list, create, update, remove) => {
    api.get(`/cases/:caseId/${path}`, h(async (req, res) => res.json(await svc[list](req.user, id(req.params.caseId)))));
    api.post(`/cases/:caseId/${path}`, h(async (req, res) => res.status(201).json(await svc[create](req.user, id(req.params.caseId), req.body ?? {}))));
    if (update) {
      api.patch(`/cases/:caseId/${path}/:itemId`, h(async (req, res) => res.json(await svc[update](req.user, id(req.params.caseId), id(req.params.itemId), req.body ?? {}))));
    }
    api.delete(
      `/cases/:caseId/${path}/:itemId`,
      h(async (req, res) => (await svc[remove](req.user, id(req.params.caseId), id(req.params.itemId)), res.status(204).end())),
    );
  };
  crud('evidence', 'listEvidence', 'createEvidence', 'updateEvidence', 'deleteEvidence');
  crud('entities', 'listEntities', 'createEntity', 'updateEntity', 'deleteEntity');
  crud('relationships', 'listRelationships', 'createRelationship', null, 'deleteRelationship');

  api.get('/cases/:caseId/graph', h(async (req, res) => res.json(await svc.graph(req.user, id(req.params.caseId)))));
  api.get('/cases/:caseId/risk', h(async (req, res) => res.json(await svc.risk(req.user, id(req.params.caseId)))));
  api.get('/cases/:caseId/reports', h(async (req, res) => res.json(await svc.listReports(req.user, id(req.params.caseId)))));
  api.post('/cases/:caseId/reports', h(async (req, res) => res.status(201).json(await svc.createReport(req.user, id(req.params.caseId)))));
  api.get('/cases/:caseId/reports/:itemId', h(async (req, res) => res.json(await svc.getReport(req.user, id(req.params.caseId), id(req.params.itemId)))));

  api.get('/admin/stats', h(async (req, res) => res.json(await svc.adminStats(req.user))));
  api.get('/admin/cases', h(async (req, res) => res.json(await svc.adminCases(req.user, filter(req.query)))));
  api.get('/admin/users', h(async (req, res) => res.json(await svc.adminUsers(req.user))));
  api.patch('/admin/users/:itemId', h(async (req, res) => res.json(await svc.adminSetRole(req.user, id(req.params.itemId), req.body ?? {}))));
  api.get('/admin/audit-events', h(async (req, res) => res.json(await svc.adminAudit(req.user, { caseId: req.query.caseId ?? null, limit: req.query.limit ?? 100 }))));

  api.use((_req, _res, next) => next(new AppError('not_found', 404)));
  app.use('/api/v1', api);

  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(staticDir, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
      return res.status(400).json({ error: { code: 'validation_error', message: 'Invalid JSON body' } });
    }
    // Log the method and path only — never bodies (passwords) or headers (tokens).
    console.error(`[error] ${req.method} ${req.path}:`, err?.message ?? err);
    res.status(500).json({ error: { code: 'server_error', message: 'Internal error' } });
  });

  return app;
}
