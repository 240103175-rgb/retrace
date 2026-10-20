// In-memory repository. Same interface as repositories/sql.js; data is lost on restart.
// Pure JS (no Node APIs) so the frontend mockService can run it in the browser.

const clone = (row) => (row == null ? null : structuredClone(row));

export function createMemoryRepository() {
  let nextId = 1;
  const t = { users: [], sessions: new Map(), cases: [], evidence: [], entities: [], relationships: [], reports: [], audit: [] };
  const byId = (list, id) => list.find((x) => x.id === id);
  const insert = (list, row) => {
    const r = { id: nextId++, ...row };
    list.push(r);
    return clone(r);
  };
  const patch = (list, id, p) => {
    const r = byId(list, id);
    Object.assign(r, p);
    return clone(r);
  };

  return {
    kind: 'memory',
    async close() {},

    async findUserByEmail(email) {
      return clone(t.users.find((u) => u.email === email));
    },
    async findUserById(id) {
      return clone(byId(t.users, id));
    },
    async createUser(user) {
      if (t.users.some((u) => u.email === user.email)) throw new Error('UNIQUE constraint failed: users.email');
      return insert(t.users, user);
    },
    async updateUser(id, p) {
      return patch(t.users, id, p);
    },
    async listUsers() {
      return t.users.map(clone);
    },

    async createSession(s) {
      t.sessions.set(s.token, { ...s });
    },
    async findSessionUser(token, now) {
      const s = t.sessions.get(token);
      return s && s.expiresAt > now ? clone(byId(t.users, s.userId)) : null;
    },
    async deleteSession(token) {
      t.sessions.delete(token);
    },

    async createCase(c) {
      if (!byId(t.users, c.ownerId)) throw new Error('FOREIGN KEY constraint failed');
      return insert(t.cases, c);
    },
    async getCase(id) {
      return clone(byId(t.cases, id));
    },
    async updateCase(id, p) {
      return patch(t.cases, id, p);
    },
    async listCases({ ownerId } = {}) {
      return t.cases.filter((c) => ownerId == null || c.ownerId === ownerId).map(clone);
    },

    async listEvidence(caseId) {
      return t.evidence
        .filter((e) => e.caseId === caseId)
        .sort((a, b) => (a.observedOn ?? '9999').localeCompare(b.observedOn ?? '9999') || a.id - b.id)
        .map(clone);
    },
    async getEvidence(id) {
      return clone(byId(t.evidence, id));
    },
    async createEvidence(e) {
      return insert(t.evidence, e);
    },
    async updateEvidence(id, p) {
      return patch(t.evidence, id, p);
    },
    async deleteEvidence(id) {
      t.evidence = t.evidence.filter((e) => e.id !== id);
      for (const r of t.relationships) r.evidenceIds = r.evidenceIds.filter((x) => x !== id);
    },

    async listEntities(caseId) {
      return t.entities.filter((e) => e.caseId === caseId).map(clone);
    },
    async getEntity(id) {
      return clone(byId(t.entities, id));
    },
    async createEntity(e) {
      return insert(t.entities, e);
    },
    async updateEntity(id, p) {
      return patch(t.entities, id, p);
    },
    async deleteEntity(id) {
      t.entities = t.entities.filter((e) => e.id !== id);
      t.relationships = t.relationships.filter((r) => r.sourceId !== id && r.targetId !== id);
    },

    async listRelationships(caseId) {
      return t.relationships.filter((r) => r.caseId === caseId).map(clone);
    },
    async getRelationship(id) {
      return clone(byId(t.relationships, id));
    },
    async createRelationship(r) {
      return insert(t.relationships, { ...r, evidenceIds: [...r.evidenceIds] });
    },
    async deleteRelationship(id) {
      t.relationships = t.relationships.filter((r) => r.id !== id);
    },

    async createReport(r) {
      return insert(t.reports, r);
    },
    async listReports(caseId) {
      return t.reports.filter((r) => r.caseId === caseId).sort((a, b) => b.createdAt - a.createdAt || b.id - a.id).map(clone);
    },
    async getReport(id) {
      return clone(byId(t.reports, id));
    },

    async addAudit(e) {
      insert(t.audit, e);
    },
    async listAudit({ caseId = null, limit = 100 } = {}) {
      return t.audit
        .filter((e) => caseId == null || e.caseId === caseId)
        .sort((a, b) => b.at - a.at || b.id - a.id)
        .slice(0, limit)
        .map(clone);
    },
  };
}
