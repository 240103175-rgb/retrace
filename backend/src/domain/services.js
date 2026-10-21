// Business rules (_docs/plan.md §4). Storage- and transport-agnostic:
// talks only to the repository interface and to injected crypto helpers,
// so the same code runs in the backend and in the frontend mockService.
import { fail } from './errors.js';
import { suggestEntities } from './extract.js';
import { MAX_FILES_PER_EVIDENCE, checkUpload } from './files.js';
import { assessRisk } from './risk.js';

export const CASE_STATUSES = ['open', 'in_review', 'closed', 'archived'];
export const LOCKED_STATUSES = ['closed', 'archived'];
export const EVIDENCE_TYPES = ['message', 'link', 'account', 'payment', 'observation'];
export const VERIFICATION = ['unverified', 'confirmed', 'disputed'];
export const ENTITY_TYPES = ['person', 'account', 'phone', 'link', 'card', 'wallet', 'organization'];
export const RELATIONSHIP_TYPES = ['contacted', 'paid', 'owns', 'links_to', 'same_as'];
export const ROLES = ['investigator', 'admin'];
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SORTS = ['updated', 'created', 'title', 'risk'];
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());

// ---------- validation helpers ----------
function text(value, { field, min = 0, max, optional = false }) {
  if (value == null || value === '') {
    if (optional) return null;
    if (min > 0) fail('validation_error', 400, `${field} is required`);
    return '';
  }
  if (typeof value !== 'string') fail('validation_error', 400, `${field} must be a string`);
  const v = value.trim();
  if (v.length < min || v.length > max) fail('validation_error', 400, `${field} must be ${min}–${max} characters`);
  if (!v && optional) return null;
  return v;
}
function oneOf(value, allowed, field, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!allowed.includes(value)) fail('validation_error', 400, `${field} must be one of ${allowed.join(', ')}`);
  return value;
}
function dateOrNull(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    fail('validation_error', 400, `${field} must be YYYY-MM-DD`);
  }
  return value;
}
function amountOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000_000) fail('validation_error', 400, 'amount must be a whole number ≥ 0');
  return n;
}
const normEmail = (email) => {
  const e = text(email, { field: 'email', min: 3, max: 120 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail('validation_error', 400, 'email is invalid');
  return e;
};

// ---------- DTOs ----------
export const userDto = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, disabled: Boolean(u.disabled), createdAt: iso(u.createdAt) });
const attachmentDto = (a) => ({
  id: a.id,
  evidenceId: a.evidenceId,
  caseId: a.caseId,
  filename: a.filename,
  mimeType: a.mimeType,
  size: a.size,
  sha256: a.sha256,
  createdAt: iso(a.createdAt),
});
const evidenceDto = (e, files = []) => ({
  id: e.id,
  caseId: e.caseId,
  type: e.type,
  content: e.content,
  source: e.source ?? null,
  observedOn: e.observedOn ?? null,
  amount: e.amount ?? null,
  verification: e.verification,
  createdAt: iso(e.createdAt),
  attachments: files.filter((a) => a.evidenceId === e.id).map(attachmentDto),
});
const entityDto = (e) => ({ id: e.id, caseId: e.caseId, type: e.type, label: e.label, note: e.note ?? null });
const normLabel = (s) => String(s).trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const TAG = /^[\p{L}\p{N} _-]{1,30}$/u;
function tagsOf(value) {
  if (!Array.isArray(value)) fail('validation_error', 400, 'tags must be an array');
  const out = [];
  for (const raw of value) {
    if (typeof raw !== 'string') fail('validation_error', 400, 'tags must be strings');
    const tag = raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (!TAG.test(tag)) fail('validation_error', 400, 'a tag is 1–30 letters, digits, spaces, - or _');
    if (!out.includes(tag)) out.push(tag);
  }
  if (out.length > 10) fail('validation_error', 400, 'at most 10 tags');
  return out;
}

/** RFC 4180 CSV with a UTF-8 BOM so Excel opens Cyrillic correctly (#54). */
export function toCsv(rows) {
  const cell = (v) => {
    const t = v == null ? '' : String(v);
    return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

const relationshipDto = (r) => ({
  id: r.id,
  caseId: r.caseId,
  sourceId: r.sourceId,
  targetId: r.targetId,
  type: r.type,
  evidenceIds: [...(r.evidenceIds ?? [])].sort((a, b) => a - b),
});

/**
 * @param repo repository (memory or sql)
 * @param deps { now, hashPassword(pw) -> Promise<string>, verifyPassword(pw, hash) -> Promise<boolean>, randomToken() -> string }
 */
export function createServices(repo, deps) {
  const now = deps.now ?? Date.now;
  // #39 failed logins per email: { count, since }. In-process: the app runs as one instance.
  const failures = new Map();

  async function audit(actor, action, resourceType, resourceId, caseId = null) {
    await repo.addAudit({ actorId: actor?.id ?? null, action, resourceType, resourceId: resourceId ?? null, caseId, at: now() });
  }

  // ---------- access ----------
  /** Owner or admin may read; others get not_found so they cannot probe for ids. */
  async function readableCase(user, caseId) {
    const c = await repo.getCase(Number(caseId));
    if (!c || (c.ownerId !== user.id && user.role !== 'admin')) fail('not_found', 404);
    return c;
  }
  /** Only the owner may change a case; admins read other people's cases but do not edit them. */
  async function writableCase(user, caseId, { allowLocked = false } = {}) {
    const c = await readableCase(user, caseId);
    if (c.ownerId !== user.id) fail('forbidden', 403);
    if (!allowLocked && LOCKED_STATUSES.includes(c.status)) fail('case_locked', 409);
    return c;
  }
  const touch = (c) => repo.updateCase(c.id, { updatedAt: now() });
  /** #49: confirmed evidence must record where it came from. */
  function needsSource(verification, source) {
    if (verification === 'confirmed' && !String(source ?? '').trim()) fail('validation_error', 400, 'confirmed evidence needs a source');
    return verification;
  }
  async function assertUniqueEntity(caseId, type, label, exceptId = null) {
    const key = normLabel(label);
    const clash = (await repo.listEntities(caseId)).find((x) => x.id !== exceptId && x.type === type && normLabel(x.label) === key);
    if (clash) fail('duplicate_entity', 409);
  }
  const requireAdmin = (user) => user.role === 'admin' || fail('forbidden', 403);

  async function caseContent(caseId) {
    const [evidence, entities, relationships, files] = await Promise.all([
      repo.listEvidence(caseId),
      repo.listEntities(caseId),
      repo.listRelationships(caseId),
      repo.listAttachments({ caseId }),
    ]);
    return { evidence, entities, relationships, files };
  }
  async function evidenceItem(c, evidenceId) {
    const e = await repo.getEvidence(Number(evidenceId));
    if (!e || e.caseId !== c.id) fail('not_found', 404);
    return e;
  }

  async function caseSummary(c) {
    const content = await caseContent(c.id);
    const risk = assessRisk(content);
    const owner = await repo.findUserById(c.ownerId);
    return {
      id: c.id,
      title: c.title,
      description: c.description ?? '',
      status: c.status,
      tags: Array.isArray(c.tags) ? c.tags : [],
      notes: c.notes ?? null,
      ownerId: c.ownerId,
      ownerName: owner?.name ?? '',
      createdAt: iso(c.createdAt),
      updatedAt: iso(c.updatedAt),
      evidenceCount: content.evidence.length,
      entityCount: content.entities.length,
      relationshipCount: content.relationships.length,
      riskScore: risk.score,
      riskLevel: risk.level,
    };
  }

  function sortCases(list, sort) {
    const by = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
      title: (a, b) => a.title.localeCompare(b.title, 'ru'),
      risk: (a, b) => b.riskScore - a.riskScore || b.updatedAt.localeCompare(a.updatedAt),
    }[sort];
    return [...list].sort(by);
  }

  function intParam(value, { field, min, max, fallback }) {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || (max !== undefined && n > max)) fail('validation_error', 400, `${field} must be an integer ${min}${max !== undefined ? `–${max}` : '+'}`);
    return n;
  }

  async function filteredCases(cases, { q = '', status = null, sort = 'updated', limit, offset, tag = null } = {}) {
    if (status) oneOf(status, CASE_STATUSES, 'status');
    oneOf(sort, SORTS, 'sort');
    const lim = intParam(limit, { field: 'limit', min: 1, max: 100, fallback: 100 });
    const off = intParam(offset, { field: 'offset', min: 0, fallback: 0 });
    const query = String(q).trim().toLocaleLowerCase();
    const picked = cases
      .filter((c) => !status || c.status === status)
      .filter((c) => !tag || (c.tags ?? []).includes(String(tag).trim().toLocaleLowerCase()))
      .filter((c) => !query || `${c.title} ${c.description ?? ''}`.toLocaleLowerCase().includes(query));
    return sortCases(await Promise.all(picked.map(caseSummary)), sort).slice(off, off + lim);
  }

  async function startSession(user) {
    const token = deps.randomToken();
    await repo.createSession({ token, userId: user.id, expiresAt: now() + SESSION_TTL_MS });
    return { token, user: userDto(user) };
  }

  return {
    // ---------- auth ----------
    async register({ email, password, name } = {}) {
      const e = normEmail(email);
      const n = text(name, { field: 'name', min: 2, max: 80 });
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
        fail('validation_error', 400, 'password must be at least 8 characters');
      }
      if (await repo.findUserByEmail(e)) fail('email_taken', 409);
      const user = await repo.createUser({ email: e, name: n, role: 'investigator', passwordHash: await deps.hashPassword(password), createdAt: now() });
      await audit(user, 'user.register', 'user', user.id);
      return startSession(user);
    },

    async login({ email, password } = {}) {
      const key = String(email ?? '').trim().toLowerCase();
      const f = failures.get(key);
      if (f && now() - f.since >= LOGIN_WINDOW_MS) failures.delete(key);
      if ((failures.get(key)?.count ?? 0) >= LOGIN_MAX_FAILURES) fail('too_many_attempts', 429);
      const user = await repo.findUserByEmail(key);
      // Same error whether the email exists or not; unknown emails are counted too.
      if (!user || !(await deps.verifyPassword(String(password ?? ''), user.passwordHash))) {
        const cur = failures.get(key) ?? { count: 0, since: now() };
        failures.set(key, { count: cur.count + 1, since: cur.since });
        fail('invalid_credentials', 401);
      }
      failures.delete(key);
      if (user.disabled) fail('account_disabled', 403);
      await audit(user, 'user.login', 'user', user.id);
      return startSession(user);
    },

    async logout(token) {
      if (token) await repo.deleteSession(token);
    },

    async userFromToken(token) {
      const user = token ? await repo.findSessionUser(token, now()) : null;
      return user && !user.disabled ? user : null;
    },

    async logoutAll(user) {
      await repo.deleteSessionsOfUser(user.id);
      await audit(user, 'user.logout_all', 'user', user.id);
    },

    async updateMe(user, body = {}) {
      const name = text(body.name, { field: 'name', min: 2, max: 80 });
      const updated = await repo.updateUser(user.id, { name });
      await audit(user, 'user.update', 'user', user.id);
      return userDto(updated);
    },

    async changePassword(user, token, { currentPassword, newPassword } = {}) {
      if (!(await deps.verifyPassword(String(currentPassword ?? ''), user.passwordHash))) fail('wrong_password', 400);
      if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 200) {
        fail('validation_error', 400, 'password must be at least 8 characters');
      }
      if (newPassword === currentPassword) fail('validation_error', 400, 'the new password must differ from the current one');
      await repo.updateUser(user.id, { passwordHash: await deps.hashPassword(newPassword) });
      await repo.deleteSessionsOfUser(user.id, token);
      await audit(user, 'user.password', 'user', user.id);
    },

    // ---------- cases ----------
    async listCases(user, filter) {
      return filteredCases(await repo.listCases({ ownerId: user.id }), filter);
    },

    async createCase(user, body = {}) {
      const c = await repo.createCase({
        ownerId: user.id,
        title: text(body.title, { field: 'title', min: 3, max: 120 }),
        description: text(body.description, { field: 'description', max: 2000 }),
        status: 'open',
        createdAt: now(),
        updatedAt: now(),
      });
      await audit(user, 'case.create', 'case', c.id, c.id);
      return caseSummary(c);
    },

    async getCase(user, caseId) {
      return caseSummary(await readableCase(user, caseId));
    },

    async updateCase(user, caseId, body = {}) {
      const statusOnly = Object.keys(body).every((k) => k === 'status');
      const c = await writableCase(user, caseId, { allowLocked: statusOnly });
      const patch = { updatedAt: now() };
      if (body.title !== undefined) patch.title = text(body.title, { field: 'title', min: 3, max: 120 });
      if (body.description !== undefined) patch.description = text(body.description, { field: 'description', max: 2000 });
      if (body.status !== undefined) patch.status = oneOf(body.status, CASE_STATUSES, 'status');
      if (body.tags !== undefined) patch.tags = tagsOf(body.tags);
      if (body.notes !== undefined) patch.notes = text(body.notes, { field: 'notes', max: 5000, optional: true });
      const updated = await repo.updateCase(c.id, patch);
      await audit(user, body.status && body.status !== c.status ? `case.status.${body.status}` : 'case.update', 'case', c.id, c.id);
      return caseSummary(updated);
    },

    // ---------- evidence ----------
    async listEvidence(user, caseId, { q = '', type = null, verification = null } = {}) {
      const c = await readableCase(user, caseId);
      if (type) oneOf(type, EVIDENCE_TYPES, 'type');
      if (verification) oneOf(verification, VERIFICATION, 'verification');
      const query = String(q ?? '').trim().toLocaleLowerCase();
      const files = await repo.listAttachments({ caseId: c.id });
      return (await repo.listEvidence(c.id))
        .filter((e) => !type || e.type === type)
        .filter((e) => !verification || e.verification === verification)
        .filter((e) => !query || `${e.content} ${e.source ?? ''}`.toLocaleLowerCase().includes(query))
        .map((e) => evidenceDto(e, files));
    },

    async createEvidence(user, caseId, body = {}) {
      const c = await writableCase(user, caseId);
      const e = await repo.createEvidence({
        caseId: c.id,
        type: oneOf(body.type, EVIDENCE_TYPES, 'type'),
        content: text(body.content, { field: 'content', min: 1, max: 5000 }),
        source: text(body.source, { field: 'source', max: 200, optional: true }),
        observedOn: dateOrNull(body.observedOn, 'observedOn'),
        amount: body.type === 'payment' ? amountOrNull(body.amount) : null,
        verification: needsSource(oneOf(body.verification, VERIFICATION, 'verification', 'unverified'), body.source),
        createdAt: now(),
      });
      await touch(c);
      await audit(user, 'evidence.create', 'evidence', e.id, c.id);
      return evidenceDto(e);
    },

    async updateEvidence(user, caseId, evidenceId, body = {}) {
      const c = await writableCase(user, caseId);
      const e = await repo.getEvidence(Number(evidenceId));
      if (!e || e.caseId !== c.id) fail('not_found', 404);
      const patch = {};
      if (body.type !== undefined) patch.type = oneOf(body.type, EVIDENCE_TYPES, 'type');
      if (body.content !== undefined) patch.content = text(body.content, { field: 'content', min: 1, max: 5000 });
      if (body.source !== undefined) patch.source = text(body.source, { field: 'source', max: 200, optional: true });
      if (body.observedOn !== undefined) patch.observedOn = dateOrNull(body.observedOn, 'observedOn');
      if (body.amount !== undefined) patch.amount = amountOrNull(body.amount);
      if (body.verification !== undefined) patch.verification = oneOf(body.verification, VERIFICATION, 'verification');
      needsSource(patch.verification ?? e.verification, 'source' in patch ? patch.source : e.source);
      const updated = await repo.updateEvidence(e.id, patch);
      await touch(c);
      await audit(user, 'evidence.update', 'evidence', e.id, c.id);
      return evidenceDto(updated, await repo.listAttachments({ caseId: c.id, evidenceId: e.id }));
    },

    async deleteEvidence(user, caseId, evidenceId) {
      const c = await writableCase(user, caseId);
      const e = await repo.getEvidence(Number(evidenceId));
      if (!e || e.caseId !== c.id) fail('not_found', 404);
      await repo.deleteEvidence(e.id);
      await touch(c);
      await audit(user, 'evidence.delete', 'evidence', e.id, c.id);
    },

    // ---------- attachments (#25) ----------
    async listAttachments(user, caseId, evidenceId) {
      const c = await readableCase(user, caseId);
      const e = await evidenceItem(c, evidenceId);
      return (await repo.listAttachments({ caseId: c.id, evidenceId: e.id })).map(attachmentDto);
    },

    async uploadAttachment(user, caseId, evidenceId, body = {}) {
      const c = await writableCase(user, caseId);
      const e = await evidenceItem(c, evidenceId);
      const { filename, mimeType, bytes } = checkUpload(body);
      const sha256 = await deps.sha256(bytes);
      if (body.sha256 !== undefined && String(body.sha256).toLowerCase() !== sha256) fail('checksum_mismatch', 400, 'sha256 does not match the uploaded bytes');
      if ((await repo.listAttachments({ caseId: c.id, evidenceId: e.id })).length >= MAX_FILES_PER_EVIDENCE) fail('too_many_files', 409);
      const a = await repo.createAttachment({ caseId: c.id, evidenceId: e.id, filename, mimeType, size: bytes.length, sha256, data: bytes, createdBy: user.id, createdAt: now() });
      await touch(c);
      await audit(user, 'evidence.attachment.add', 'attachment', a.id, c.id);
      return attachmentDto(a);
    },

    /** The stored bytes plus what is needed for download headers. */
    async attachmentContent(user, caseId, evidenceId, attachmentId) {
      const c = await readableCase(user, caseId);
      const e = await evidenceItem(c, evidenceId);
      const a = await repo.getAttachment(Number(attachmentId));
      if (!a || a.evidenceId !== e.id) fail('not_found', 404);
      return { ...attachmentDto(a), data: a.data };
    },

    async deleteAttachment(user, caseId, evidenceId, attachmentId) {
      const c = await writableCase(user, caseId);
      const e = await evidenceItem(c, evidenceId);
      const a = await repo.getAttachment(Number(attachmentId));
      if (!a || a.evidenceId !== e.id) fail('not_found', 404);
      await repo.deleteAttachment(a.id);
      await touch(c);
      await audit(user, 'evidence.attachment.delete', 'attachment', a.id, c.id);
    },

    // ---------- entities ----------
    async listEntities(user, caseId) {
      const c = await readableCase(user, caseId);
      return (await repo.listEntities(c.id)).map(entityDto);
    },

    /** #23 rule-based suggestions; the investigator decides what to add. */
    async entitySuggestions(user, caseId) {
      const c = await readableCase(user, caseId);
      const { evidence, entities } = await caseContent(c.id);
      return suggestEntities(evidence, entities);
    },

    async createEntity(user, caseId, body = {}) {
      const c = await writableCase(user, caseId);
      const fields = {
        caseId: c.id,
        type: oneOf(body.type, ENTITY_TYPES, 'type'),
        label: text(body.label, { field: 'label', min: 1, max: 200 }),
        note: text(body.note, { field: 'note', max: 1000, optional: true }),
      };
      await assertUniqueEntity(c.id, fields.type, fields.label);
      const en = await repo.createEntity(fields);
      await touch(c);
      await audit(user, 'entity.create', 'entity', en.id, c.id);
      return entityDto(en);
    },

    async updateEntity(user, caseId, entityId, body = {}) {
      const c = await writableCase(user, caseId);
      const en = await repo.getEntity(Number(entityId));
      if (!en || en.caseId !== c.id) fail('not_found', 404);
      const patch = {};
      if (body.type !== undefined) patch.type = oneOf(body.type, ENTITY_TYPES, 'type');
      if (body.label !== undefined) patch.label = text(body.label, { field: 'label', min: 1, max: 200 });
      if (body.note !== undefined) patch.note = text(body.note, { field: 'note', max: 1000, optional: true });
      if (patch.type !== undefined || patch.label !== undefined) await assertUniqueEntity(c.id, patch.type ?? en.type, patch.label ?? en.label, en.id);
      const updated = await repo.updateEntity(en.id, patch);
      await touch(c);
      await audit(user, 'entity.update', 'entity', en.id, c.id);
      return entityDto(updated);
    },

    async deleteEntity(user, caseId, entityId) {
      const c = await writableCase(user, caseId);
      const en = await repo.getEntity(Number(entityId));
      if (!en || en.caseId !== c.id) fail('not_found', 404);
      await repo.deleteEntity(en.id); // also deletes its relationships
      await touch(c);
      await audit(user, 'entity.delete', 'entity', en.id, c.id);
    },

    // ---------- relationships ----------
    async listRelationships(user, caseId) {
      const c = await readableCase(user, caseId);
      return (await repo.listRelationships(c.id)).map(relationshipDto);
    },

    async createRelationship(user, caseId, body = {}) {
      const c = await writableCase(user, caseId);
      const sourceId = Number(body.sourceId);
      const targetId = Number(body.targetId);
      const type = oneOf(body.type, RELATIONSHIP_TYPES, 'type');
      const [source, target] = await Promise.all([repo.getEntity(sourceId), repo.getEntity(targetId)]);
      if (!source || !target || source.caseId !== c.id || target.caseId !== c.id || sourceId === targetId) {
        fail('invalid_relationship', 400);
      }
      const evidenceIds = [...new Set((Array.isArray(body.evidenceIds) ? body.evidenceIds : []).map(Number))];
      for (const id of evidenceIds) {
        const e = await repo.getEvidence(id);
        if (!e || e.caseId !== c.id) fail('invalid_relationship', 400, 'supporting evidence must belong to the case');
      }
      if ((await repo.listRelationships(c.id)).some((x) => x.sourceId === sourceId && x.targetId === targetId && x.type === type)) {
        fail('duplicate_relationship', 409);
      }
      const r = await repo.createRelationship({ caseId: c.id, sourceId, targetId, type, evidenceIds });
      await touch(c);
      await audit(user, 'relationship.create', 'relationship', r.id, c.id);
      return relationshipDto(r);
    },

    async deleteRelationship(user, caseId, relationshipId) {
      const c = await writableCase(user, caseId);
      const r = await repo.getRelationship(Number(relationshipId));
      if (!r || r.caseId !== c.id) fail('not_found', 404);
      await repo.deleteRelationship(r.id);
      await touch(c);
      await audit(user, 'relationship.delete', 'relationship', r.id, c.id);
    },

    // ---------- graph and risk ----------
    async graph(user, caseId) {
      const c = await readableCase(user, caseId);
      const { entities, relationships } = await caseContent(c.id);
      const degree = new Map();
      for (const r of relationships) {
        for (const [a, b] of [[r.sourceId, r.targetId], [r.targetId, r.sourceId]]) {
          if (!degree.has(a)) degree.set(a, new Set());
          degree.get(a).add(b);
        }
      }
      return {
        nodes: entities.map((e) => ({ id: e.id, type: e.type, label: e.label, degree: degree.get(e.id)?.size ?? 0 })),
        edges: relationships.map((r) => ({ id: r.id, sourceId: r.sourceId, targetId: r.targetId, type: r.type, evidenceCount: r.evidenceIds.length })),
      };
    },

    async risk(user, caseId) {
      const c = await readableCase(user, caseId);
      return assessRisk(await caseContent(c.id));
    },

    // ---------- export ----------
    async exportCase(user, caseId) {
      const c = await readableCase(user, caseId);
      const content = await caseContent(c.id);
      const reports = await repo.listReports(c.id);
      await audit(user, 'case.export', 'case', c.id, c.id);
      return {
        format: 'retrace-case/1',
        exportedAt: iso(now()),
        case: await caseSummary(c),
        evidence: content.evidence.map((e) => evidenceDto(e, content.files)),
        entities: content.entities.map(entityDto),
        relationships: content.relationships.map(relationshipDto),
        risk: assessRisk(content),
        reports: await Promise.all(reports.map(async (r) => reportSummary(r, await repo.findUserById(r.createdBy)))),
      };
    },

    async exportEvidenceCsv(user, caseId) {
      const c = await readableCase(user, caseId);
      const rows = (await repo.listEvidence(c.id)).map((e) => [e.id, e.observedOn ?? '', e.type, e.verification, e.source ?? '', e.amount ?? '', e.content]);
      return { caseId: c.id, csv: toCsv([['id', 'observed_on', 'type', 'verification', 'source', 'amount', 'content'], ...rows]) };
    },

    // ---------- reports ----------
    async createReport(user, caseId) {
      const c = await readableCase(user, caseId);
      if (c.ownerId !== user.id) fail('forbidden', 403);
      const content = await caseContent(c.id);
      const snapshot = {
        case: await caseSummary(c),
        evidence: content.evidence.map((e) => evidenceDto(e, content.files)),
        entities: content.entities.map(entityDto),
        relationships: content.relationships.map(relationshipDto),
        risk: assessRisk(content),
      };
      const r = await repo.createReport({ caseId: c.id, createdBy: user.id, createdAt: now(), snapshot: JSON.stringify(snapshot) });
      await audit(user, 'report.create', 'report', r.id, c.id);
      return reportDto(r, user);
    },

    async listReports(user, caseId) {
      const c = await readableCase(user, caseId);
      const reports = await repo.listReports(c.id);
      return Promise.all(reports.map(async (r) => reportSummary(r, await repo.findUserById(r.createdBy))));
    },

    async getReport(user, caseId, reportId) {
      const c = await readableCase(user, caseId);
      const r = await repo.getReport(Number(reportId));
      if (!r || r.caseId !== c.id) fail('not_found', 404);
      return reportDto(r, await repo.findUserById(r.createdBy));
    },

    // ---------- admin ----------
    async adminStats(user) {
      requireAdmin(user);
      const [users, cases] = await Promise.all([repo.listUsers(), repo.listCases({})]);
      const summaries = await Promise.all(cases.map(caseSummary));
      const byStatus = Object.fromEntries(CASE_STATUSES.map((s) => [s, summaries.filter((c) => c.status === s).length]));
      return {
        users: users.length,
        cases: cases.length,
        casesByStatus: byStatus,
        evidence: summaries.reduce((n, c) => n + c.evidenceCount, 0),
        highRiskCases: summaries.filter((c) => c.riskLevel === 'high').length,
        casesLast7Days: cases.filter((c) => c.createdAt <= now() && now() - c.createdAt <= 7 * 24 * 60 * 60 * 1000).length,
      };
    },

    async adminCases(user, filter) {
      requireAdmin(user);
      return filteredCases(await repo.listCases({}), filter);
    },

    async adminUsers(user) {
      requireAdmin(user);
      return (await repo.listUsers()).map(userDto);
    },

    async adminSetRole(user, userId, body = {}) {
      requireAdmin(user);
      const target = (await repo.findUserById(Number(userId))) ?? fail('not_found', 404);
      if (body.role === undefined && body.disabled === undefined) fail('validation_error', 400, 'role or disabled is required');
      const role = body.role === undefined ? target.role : oneOf(body.role, ROLES, 'role');
      if (body.disabled !== undefined && typeof body.disabled !== 'boolean') fail('validation_error', 400, 'disabled must be a boolean');
      const disabled = body.disabled ?? Boolean(target.disabled);
      if (disabled && !target.disabled && target.id === user.id) fail('self_action', 409);
      const activeAdmins = (await repo.listUsers()).filter((u) => u.role === 'admin' && !u.disabled);
      const staysActiveAdmin = role === 'admin' && !disabled;
      if (target.role === 'admin' && !target.disabled && !staysActiveAdmin && activeAdmins.length <= 1) fail('last_admin', 409);
      const updated = await repo.updateUser(target.id, { role, disabled });
      if (role !== target.role) await audit(user, `user.role.${role}`, 'user', target.id);
      if (disabled !== Boolean(target.disabled)) {
        if (disabled) await repo.deleteSessionsOfUser(target.id);
        await audit(user, disabled ? 'user.disabled' : 'user.enabled', 'user', target.id);
      }
      return userDto(updated);
    },

    async adminAudit(user, { caseId = null, limit = 100, offset, actorId = null, action = null } = {}) {
      requireAdmin(user);
      const n = Math.min(Math.max(Number(limit) || 100, 1), 500);
      const off = intParam(offset, { field: 'offset', min: 0, fallback: 0 });
      const actor = intParam(actorId, { field: 'actorId', min: 1, fallback: null });
      const prefix = action == null || action === '' ? null : String(action).slice(0, 60);
      const events = await repo.listAudit({ caseId: caseId == null || caseId === '' ? null : Number(caseId), limit: n, offset: off, actorId: actor, actionPrefix: prefix });
      const names = new Map();
      for (const e of events) if (e.actorId != null && !names.has(e.actorId)) names.set(e.actorId, (await repo.findUserById(e.actorId))?.name ?? null);
      return events.map((e) => ({
        id: e.id,
        at: iso(e.at),
        actorId: e.actorId,
        actorName: names.get(e.actorId) ?? null,
        action: e.action,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        caseId: e.caseId,
      }));
    },
  };

  function reportSummary(r, author) {
    const risk = JSON.parse(r.snapshot).risk;
    return { id: r.id, caseId: r.caseId, createdAt: iso(r.createdAt), createdBy: r.createdBy, createdByName: author?.name ?? null, riskScore: risk.score, riskLevel: risk.level };
  }
  function reportDto(r, author) {
    return { ...reportSummary(r, author), snapshot: JSON.parse(r.snapshot) };
  }
}
