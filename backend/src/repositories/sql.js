// Sequelize repository. Same interface as repositories/memory.js.
// The database is chosen by DATABASE_URL (default: a SQLite file); nothing below is SQLite-specific
// except reading the file path from a sqlite: URL.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DataTypes, Op, Sequelize } from 'sequelize';

export const DEFAULT_DATABASE_URL = 'sqlite:data/retrace.db';

function defineModels(sequelize) {
  // Fresh objects every time: Sequelize mutates attribute definitions.
  const str = (len, allowNull = false) => ({ type: DataTypes.STRING(len), allowNull });
  const txt = (allowNull = false) => ({ type: DataTypes.TEXT, allowNull });
  const ms = () => ({ type: DataTypes.BIGINT, allowNull: false });
  const opts = (tableName, extra = {}) => ({ tableName, timestamps: false, ...extra });
  const fk = (name, allowNull = false) => ({ foreignKey: { name, allowNull }, onDelete: 'CASCADE' });

  const User = sequelize.define(
    'User',
    {
      email: { ...str(120), unique: true },
      name: str(80),
      role: { type: DataTypes.ENUM('investigator', 'admin'), allowNull: false },
      passwordHash: str(200),
      createdAt: ms(),
    },
    opts('users'),
  );
  const Session = sequelize.define('Session', { token: { type: DataTypes.STRING(128), primaryKey: true }, expiresAt: ms() }, opts('sessions'));
  const Case = sequelize.define(
    'Case',
    {
      title: str(120),
      description: txt(true),
      status: { type: DataTypes.ENUM('open', 'in_review', 'closed', 'archived'), allowNull: false },
      createdAt: ms(),
      updatedAt: ms(),
    },
    opts('cases', { indexes: [{ fields: ['ownerId'] }, { fields: ['status'] }] }),
  );
  const Evidence = sequelize.define(
    'Evidence',
    {
      type: { type: DataTypes.ENUM('message', 'link', 'account', 'payment', 'observation'), allowNull: false },
      content: txt(),
      source: str(200, true),
      observedOn: { type: DataTypes.STRING(10), allowNull: true },
      amount: { type: DataTypes.INTEGER, allowNull: true },
      verification: { type: DataTypes.ENUM('unverified', 'confirmed', 'disputed'), allowNull: false },
      createdAt: ms(),
    },
    opts('evidence', { indexes: [{ fields: ['caseId'] }] }),
  );
  const Entity = sequelize.define(
    'Entity',
    {
      type: { type: DataTypes.ENUM('person', 'account', 'phone', 'link', 'card', 'wallet', 'organization'), allowNull: false },
      label: str(200),
      note: { type: DataTypes.STRING(1000), allowNull: true },
    },
    opts('entities', { indexes: [{ fields: ['caseId'] }] }),
  );
  const Relationship = sequelize.define(
    'Relationship',
    { type: { type: DataTypes.ENUM('contacted', 'paid', 'owns', 'links_to', 'same_as'), allowNull: false } },
    opts('relationships', { indexes: [{ fields: ['caseId'] }] }),
  );
  const RelationshipEvidence = sequelize.define('RelationshipEvidence', {}, opts('relationship_evidence'));
  const Report = sequelize.define('Report', { createdAt: ms(), snapshot: txt() }, opts('reports', { indexes: [{ fields: ['caseId'] }] }));
  const AuditEvent = sequelize.define(
    'AuditEvent',
    { action: str(60), resourceType: str(30), resourceId: { type: DataTypes.INTEGER, allowNull: true }, caseId: { type: DataTypes.INTEGER, allowNull: true }, at: ms() },
    opts('audit_events', { indexes: [{ fields: ['caseId'] }, { fields: ['at'] }] }),
  );

  Session.belongsTo(User, fk('userId'));
  Case.belongsTo(User, { as: 'owner', ...fk('ownerId') });
  Evidence.belongsTo(Case, fk('caseId'));
  Entity.belongsTo(Case, fk('caseId'));
  Relationship.belongsTo(Case, fk('caseId'));
  Relationship.belongsTo(Entity, { as: 'source', ...fk('sourceId') });
  Relationship.belongsTo(Entity, { as: 'target', ...fk('targetId') });
  RelationshipEvidence.belongsTo(Relationship, fk('relationshipId'));
  RelationshipEvidence.belongsTo(Evidence, fk('evidenceId'));
  Relationship.hasMany(RelationshipEvidence, { as: 'support', ...fk('relationshipId') });
  Report.belongsTo(Case, fk('caseId'));
  Report.belongsTo(User, { as: 'author', ...fk('createdBy') });
  AuditEvent.belongsTo(User, { as: 'actor', foreignKey: { name: 'actorId', allowNull: true }, onDelete: 'SET NULL' });

  return { User, Session, Case, Evidence, Entity, Relationship, RelationshipEvidence, Report, AuditEvent };
}

const plain = (row) => (row ? row.get({ plain: true }) : null);
const num = (row) => {
  if (!row) return null;
  // BIGINT columns come back as strings on some dialects; keep numbers everywhere.
  for (const k of ['createdAt', 'updatedAt', 'expiresAt', 'at']) if (row[k] != null) row[k] = Number(row[k]);
  return row;
};
const out = (row) => num(plain(row));

export async function createSqlRepository(url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL) {
  const storage = url.startsWith('sqlite:') ? url.slice('sqlite:'.length) : null;
  if (storage && storage !== ':memory:') mkdirSync(dirname(storage), { recursive: true });
  const sequelize = storage
    ? new Sequelize({ dialect: 'sqlite', storage, logging: false, ...(storage === ':memory:' ? { pool: { max: 1 } } : {}) })
    : new Sequelize(url, { logging: false });
  if (sequelize.getDialect() === 'sqlite') await sequelize.query('PRAGMA foreign_keys = ON;');
  const m = defineModels(sequelize);
  await sequelize.sync();

  const relOut = (r) => {
    const { support, ...rest } = plain(r);
    return { ...rest, evidenceIds: (support ?? []).map((s) => s.evidenceId).sort((a, b) => a - b) };
  };
  const relInclude = { model: m.RelationshipEvidence, as: 'support', attributes: ['evidenceId'] };

  return {
    kind: `sql:${sequelize.getDialect()}`,
    sequelize,
    models: m,
    async close() {
      await sequelize.close();
    },

    async findUserByEmail(email) {
      return out(await m.User.findOne({ where: { email } }));
    },
    async findUserById(id) {
      return out(await m.User.findByPk(id));
    },
    async createUser(user) {
      return out(await m.User.create(user));
    },
    async updateUser(id, p) {
      await m.User.update(p, { where: { id } });
      return out(await m.User.findByPk(id));
    },
    async listUsers() {
      return (await m.User.findAll({ order: [['id', 'ASC']] })).map(out);
    },

    async createSession(s) {
      await m.Session.create(s);
    },
    async findSessionUser(token, now) {
      const s = await m.Session.findOne({ where: { token, expiresAt: { [Op.gt]: now } }, include: m.User });
      return s ? out(s.User) : null;
    },
    async deleteSession(token) {
      await m.Session.destroy({ where: { token } });
    },

    async createCase(c) {
      return out(await m.Case.create(c));
    },
    async getCase(id) {
      return out(await m.Case.findByPk(id));
    },
    async updateCase(id, p) {
      await m.Case.update(p, { where: { id } });
      return out(await m.Case.findByPk(id));
    },
    async listCases({ ownerId } = {}) {
      return (await m.Case.findAll({ where: ownerId == null ? {} : { ownerId }, order: [['id', 'ASC']] })).map(out);
    },

    async listEvidence(caseId) {
      const rows = (await m.Evidence.findAll({ where: { caseId } })).map(out);
      return rows.sort((a, b) => (a.observedOn ?? '9999').localeCompare(b.observedOn ?? '9999') || a.id - b.id);
    },
    async getEvidence(id) {
      return out(await m.Evidence.findByPk(id));
    },
    async createEvidence(e) {
      return out(await m.Evidence.create(e));
    },
    async updateEvidence(id, p) {
      await m.Evidence.update(p, { where: { id } });
      return out(await m.Evidence.findByPk(id));
    },
    async deleteEvidence(id) {
      await sequelize.transaction(async (transaction) => {
        await m.RelationshipEvidence.destroy({ where: { evidenceId: id }, transaction });
        await m.Evidence.destroy({ where: { id }, transaction });
      });
    },

    async listEntities(caseId) {
      return (await m.Entity.findAll({ where: { caseId }, order: [['id', 'ASC']] })).map(out);
    },
    async getEntity(id) {
      return out(await m.Entity.findByPk(id));
    },
    async createEntity(e) {
      return out(await m.Entity.create(e));
    },
    async updateEntity(id, p) {
      await m.Entity.update(p, { where: { id } });
      return out(await m.Entity.findByPk(id));
    },
    async deleteEntity(id) {
      await sequelize.transaction(async (transaction) => {
        const rels = await m.Relationship.findAll({ where: { [Op.or]: [{ sourceId: id }, { targetId: id }] }, attributes: ['id'], transaction });
        const relIds = rels.map((r) => r.id);
        if (relIds.length) {
          await m.RelationshipEvidence.destroy({ where: { relationshipId: relIds }, transaction });
          await m.Relationship.destroy({ where: { id: relIds }, transaction });
        }
        await m.Entity.destroy({ where: { id }, transaction });
      });
    },

    async listRelationships(caseId) {
      return (await m.Relationship.findAll({ where: { caseId }, include: relInclude, order: [['id', 'ASC']] })).map(relOut);
    },
    async getRelationship(id) {
      const r = await m.Relationship.findByPk(id, { include: relInclude });
      return r ? relOut(r) : null;
    },
    async createRelationship({ evidenceIds = [], ...r }) {
      const id = await sequelize.transaction(async (transaction) => {
        const row = await m.Relationship.create(r, { transaction });
        if (evidenceIds.length) {
          await m.RelationshipEvidence.bulkCreate(evidenceIds.map((evidenceId) => ({ relationshipId: row.id, evidenceId })), { transaction });
        }
        return row.id;
      });
      return this.getRelationship(id);
    },
    async deleteRelationship(id) {
      await sequelize.transaction(async (transaction) => {
        await m.RelationshipEvidence.destroy({ where: { relationshipId: id }, transaction });
        await m.Relationship.destroy({ where: { id }, transaction });
      });
    },

    async createReport(r) {
      return out(await m.Report.create(r));
    },
    async listReports(caseId) {
      return (await m.Report.findAll({ where: { caseId }, order: [['createdAt', 'DESC'], ['id', 'DESC']] })).map(out);
    },
    async getReport(id) {
      return out(await m.Report.findByPk(id));
    },

    async addAudit(e) {
      await m.AuditEvent.create(e);
    },
    async listAudit({ caseId = null, limit = 100 } = {}) {
      return (
        await m.AuditEvent.findAll({ where: caseId == null ? {} : { caseId }, order: [['at', 'DESC'], ['id', 'DESC']], limit })
      ).map(out);
    },
  };
}
