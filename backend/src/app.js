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
export const VERSION = '1.2.0';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function createApp({ repo, now = Date.now, staticDir = null, log = console.log }) {
  const svc = createServices(repo, nodeDeps(now));
  const app = express();
  app.disable('x-powered-by');

  // #34 security headers on every response.
  app.use((_req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP });
    next();
  });

  // #35 one line per request: method, path (no query), status, duration. Never headers or bodies.
  if (log) {
    app.use((req, res, next) => {
      const start = process.hrtime.bigint();
      const path = req.originalUrl.split('?')[0]; // captured now: req.path changes inside routers
      res.on('finish', () => log(`[req] ${req.method} ${path} ${res.statusCode} ${Number((process.hrtime.bigint() - start) / 1000000n)}ms`));
      next();
    });
  }

  // #41 bodies must be JSON.
  app.use('/api', (req, _res, next) => {
    const hasBody = Number(req.get('content-length') ?? 0) > 0 || req.get('transfer-encoding');
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && hasBody && !req.is('application/json')) {
      return next(new AppError('unsupported_media_type', 415));
    }
    next();
  });
  // #25 file uploads carry base64 (2 MB file ≈ 2.8 MB text); every other route keeps the small limit.
  const UPLOAD = /^\/api\/v1\/cases\/[^/]+\/evidence\/[^/]+\/attachments$/;
  const smallJson = express.json({ limit: '100kb' });
  const uploadJson = express.json({ limit: '3mb' });
  app.use((req, res, next) => (UPLOAD.test(req.path) ? uploadJson : smallJson)(req, res, next));

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
  const open = new Set(['/auth/register', '/auth/login', '/health']);
  api.get('/health', (_req, res) => res.json({ status: 'ok', storage: repo.kind, version: VERSION }));
  api.use((req, _res, next) => (open.has(req.path) || req.user ? next() : next(new AppError('unauthorized', 401))));

  const id = (v) => Number(v);
  const filter = (q) => ({ q: q.q ?? '', status: q.status || null, sort: q.sort || 'updated', limit: q.limit, offset: q.offset, tag: q.tag || null });

  api.post('/auth/register', h(async (req, res) => res.status(201).json(await svc.register(req.body ?? {}))));
  api.post('/auth/login', h(async (req, res) => res.json(await svc.login(req.body ?? {}))));
  api.post('/auth/logout', h(async (req, res) => (await svc.logout(req.token), res.status(204).end())));
  api.post('/auth/logout-all', h(async (req, res) => (await svc.logoutAll(req.user), res.status(204).end())));
  api.get('/me', (req, res) => res.json(userDto(req.user)));
  api.patch('/me', h(async (req, res) => res.json(await svc.updateMe(req.user, req.body ?? {}))));
  api.post('/me/password', h(async (req, res) => (await svc.changePassword(req.user, req.token, req.body ?? {}), res.status(204).end())));

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
  // Must come before crud('evidence') so ".csv" is not taken as an item id.
  api.get('/cases/:caseId/evidence.csv', h(async (req, res) => {
    const { caseId, csv } = await svc.exportEvidenceCsv(req.user, id(req.params.caseId));
    res.set('Content-Disposition', `attachment; filename="retrace-case-${caseId}-evidence.csv"`).type('text/csv; charset=utf-8').send(csv);
  }));
  api.get('/cases/:caseId/export', h(async (req, res) => {
    const data = await svc.exportCase(req.user, id(req.params.caseId));
    res.set('Content-Disposition', `attachment; filename="retrace-case-${data.case.id}.json"`).json(data);
  }));
  api.get('/cases/:caseId/evidence', h(async (req, res) => res.json(await svc.listEvidence(req.user, id(req.params.caseId), { q: req.query.q, type: req.query.type || null, verification: req.query.verification || null }))));
  crud('evidence', 'listEvidence', 'createEvidence', 'updateEvidence', 'deleteEvidence');
  const files = '/cases/:caseId/evidence/:itemId/attachments';
  const fileArgs = (req) => [req.user, id(req.params.caseId), id(req.params.itemId)];
  api.get(files, h(async (req, res) => res.json(await svc.listAttachments(...fileArgs(req)))));
  api.post(files, h(async (req, res) => res.status(201).json(await svc.uploadAttachment(...fileArgs(req), req.body ?? {}))));
  api.delete(`${files}/:fileId`, h(async (req, res) => (await svc.deleteAttachment(...fileArgs(req), id(req.params.fileId)), res.status(204).end())));
  api.get(`${files}/:fileId/content`, h(async (req, res) => {
    const f = await svc.attachmentContent(...fileArgs(req), id(req.params.fileId));
    // Always a download, never rendered by the browser; the type is the sniffed one stored at upload.
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="file-${f.id}"; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      'X-Checksum-SHA256': f.sha256,
      'Cache-Control': 'private, no-store',
    });
    res.send(Buffer.from(f.data));
  }));
  crud('entities', 'listEntities', 'createEntity', 'updateEntity', 'deleteEntity');
  crud('relationships', 'listRelationships', 'createRelationship', null, 'deleteRelationship');

  api.get('/cases/:caseId/summary', h(async (req, res) => res.json(await svc.summary(req.user, id(req.params.caseId)))));
  api.get('/cases/:caseId/entity-suggestions', h(async (req, res) => res.json(await svc.entitySuggestions(req.user, id(req.params.caseId)))));
  api.get('/cases/:caseId/graph', h(async (req, res) => res.json(await svc.graph(req.user, id(req.params.caseId)))));
  api.get('/cases/:caseId/risk', h(async (req, res) => res.json(await svc.risk(req.user, id(req.params.caseId)))));
  api.get('/cases/:caseId/reports', h(async (req, res) => res.json(await svc.listReports(req.user, id(req.params.caseId)))));
  api.post('/cases/:caseId/reports', h(async (req, res) => res.status(201).json(await svc.createReport(req.user, id(req.params.caseId)))));
  api.get('/cases/:caseId/reports/:itemId', h(async (req, res) => res.json(await svc.getReport(req.user, id(req.params.caseId), id(req.params.itemId)))));

  api.get('/admin/stats', h(async (req, res) => res.json(await svc.adminStats(req.user))));
  api.get('/admin/cases', h(async (req, res) => res.json(await svc.adminCases(req.user, filter(req.query)))));
  api.get('/admin/users', h(async (req, res) => res.json(await svc.adminUsers(req.user))));
  api.patch('/admin/users/:itemId', h(async (req, res) => res.json(await svc.adminSetRole(req.user, id(req.params.itemId), req.body ?? {}))));
  api.get('/admin/audit-events', h(async (req, res) => res.json(await svc.adminAudit(req.user, { caseId: req.query.caseId ?? null, limit: req.query.limit ?? 100, offset: req.query.offset, actorId: req.query.actorId, action: req.query.action }))));

  api.use((_req, _res, next) => next(new AppError('not_found', 404)));
  app.use('/api/v1', api);

  if (staticDir && existsSync(staticDir)) {
    express.static.mime?.define?.({ 'application/manifest+json': ['webmanifest'] });
    app.use(express.static(staticDir, { setHeaders: (res, path) => path.endsWith('.webmanifest') && res.type('application/manifest+json') }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(staticDir, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    if (err?.type === 'entity.too.large' && UPLOAD.test(req.path)) {
      return res.status(413).json({ error: { code: 'file_too_large', message: 'File is larger than 2 MB' } });
    }
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
      return res.status(400).json({ error: { code: 'validation_error', message: 'Invalid JSON body' } });
    }
    // Log the method and path only — never bodies (passwords) or headers (tokens).
    console.error(`[error] ${req.method} ${req.path}:`, err?.message ?? err);
    res.status(500).json({ error: { code: 'server_error', message: 'Internal error' } });
  });

  return app;
}
