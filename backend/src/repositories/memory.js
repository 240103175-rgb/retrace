// In-memory repository. Same interface as repositories/sql.js; data is lost on restart.
// Pure JS (no Node APIs) so the frontend mockService can run it in the browser.

const clone = (row) => (row == null ? null : structuredClone(row));

export function createMemoryRepository() {
  let nextId = 1;
  const t = { users: [], sessions: new Map(), cases: [], evidence: [], entities: [], relationships: [], reports: [], audit: [], files: [], members: [], riskSettings: new Map(), comments: [], tasks: [], intake: [] };
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
      return insert(t.users, { disabled: false, ...user });
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
    async deleteSessionsOfUser(userId, exceptToken = null) {
      for (const [token, s] of t.sessions) if (s.userId === userId && token !== exceptToken) t.sessions.delete(token);
    },

    async createCase(c) {
      if (!byId(t.users, c.ownerId)) throw new Error('FOREIGN KEY constraint failed');
      return insert(t.cases, { tags: [], notes: null, version: 1, ...c });
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
      return insert(t.evidence, { version: 1, ...e });
    },
    async updateEvidence(id, p) {
      return patch(t.evidence, id, p);
    },
    async deleteEvidence(id) {
      t.evidence = t.evidence.filter((e) => e.id !== id);
      t.files = t.files.filter((a) => a.evidenceId !== id);
      for (const r of t.relationships) r.evidenceIds = r.evidenceIds.filter((x) => x !== id);
    },

    // #25 attachments; lists never include the bytes.
    async createAttachment(a) {
      if (!byId(t.evidence, a.evidenceId)) throw new Error('FOREIGN KEY constraint failed');
      const { data, ...meta } = insert(t.files, { ...a, data: new Uint8Array(a.data) });
      return meta;
    },
    async listAttachments({ caseId, evidenceId = null }) {
      return t.files
        .filter((a) => a.caseId === caseId && (evidenceId == null || a.evidenceId === evidenceId))
        .map(({ data, ...meta }) => clone(meta));
    },
    async getAttachment(id) {
      return clone(byId(t.files, id));
    },
    async deleteAttachment(id) {
      t.files = t.files.filter((a) => a.id !== id);
    },

    // #27 sharing
    async addMember(m) {
      if (t.members.some((x) => x.caseId === m.caseId && x.userId === m.userId)) throw new Error('UNIQUE constraint failed: case_members');
      return insert(t.members, m);
    },
    async listMembers(caseId) {
      return t.members.filter((x) => x.caseId === caseId).map(clone);
    },
    async getMember(caseId, userId) {
      return clone(t.members.find((x) => x.caseId === caseId && x.userId === userId));
    },
    async listMemberships(userId) {
      return t.members.filter((x) => x.userId === userId).map(clone);
    },
    async updateMember(caseId, userId, p) {
      const r = t.members.find((x) => x.caseId === caseId && x.userId === userId);
      Object.assign(r, p);
      return clone(r);
    },
    async removeMember(caseId, userId) {
      t.members = t.members.filter((x) => !(x.caseId === caseId && x.userId === userId));
    },

    /** #136 every entity, for cross-case matching (no case content). */
    async listAllEntities() {
      return t.entities.map(({ id, caseId, type, label }) => ({ id, caseId, type, label }));
    },

    // #140 risk rule settings
    async getRiskSettings() {
      return [...t.riskSettings.values()].map(clone);
    },
    async setRiskSetting(ruleId, p) {
      t.riskSettings.set(ruleId, { ruleId, ...(t.riskSettings.get(ruleId) ?? {}), ...p });
      return clone(t.riskSettings.get(ruleId));
    },

    // #150 comments and tasks
    async createComment(c) {
      return insert(t.comments, c);
    },
    async listComments(caseId) {
      return t.comments.filter((c) => c.caseId === caseId).sort((a, b) => a.createdAt - b.createdAt || a.id - b.id).map(clone);
    },
    async getComment(id) {
      return clone(byId(t.comments, id));
    },
    async deleteComment(id) {
      t.comments = t.comments.filter((c) => c.id !== id);
    },
    async createTask(task) {
      return insert(t.tasks, { done: false, assigneeId: null, ...task });
    },
    async listTasks(caseId) {
      return t.tasks.filter((x) => x.caseId === caseId).sort((a, b) => a.id - b.id).map(clone);
    },
    async getTask(id) {
      return clone(byId(t.tasks, id));
    },
    async updateTask(id, p) {
      return patch(t.tasks, id, p);
    },
    async deleteTask(id) {
      t.tasks = t.tasks.filter((x) => x.id !== id);
    },

    // #152 reports from the public form
    async createIntake(r) {
      const { data, ...meta } = insert(t.intake, { status: 'new', takenBy: null, caseId: null, takenAt: null, ...r, data: r.data ? new Uint8Array(r.data) : null });
      return meta;
    },
    async listIntake({ status = null } = {}) {
      return t.intake
        .filter((r) => status == null || r.status === status)
        .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
        .map(({ data, ...meta }) => clone(meta));
    },
    async getIntake(id) {
      return clone(byId(t.intake, id));
    },
    /** Marks a report taken only if nobody took it first; true when this call won. */
    async takeIntake(id, p) {
      const r = byId(t.intake, id);
      if (!r || r.status !== 'new') return false;
      Object.assign(r, { status: 'taken', ...p });
      return true;
    },

    async linkIntakeCase(id, caseId) {
      byId(t.intake, id).caseId = caseId;
    },

    async listEntities(caseId) {
      return t.entities.filter((e) => e.caseId === caseId).map(clone);
    },
    async getEntity(id) {
      return clone(byId(t.entities, id));
    },
    async createEntity(e) {
      return insert(t.entities, { version: 1, ...e });
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
    async listAudit({ caseId = null, limit = 100, offset = 0, actorId = null, actionPrefix = null } = {}) {
      return t.audit
        .filter((e) => caseId == null || e.caseId === caseId)
        .filter((e) => actorId == null || e.actorId === actorId)
        .filter((e) => actionPrefix == null || e.action.startsWith(actionPrefix))
        .sort((a, b) => b.at - a.at || b.id - a.id)
        .slice(offset, offset + limit)
        .map(clone);
    },
  };
}
