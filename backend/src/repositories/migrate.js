// Copies every table from one database to another (#107), e.g. the SQLite file to PostgreSQL.
// Ids are kept so links between rows stay valid; PostgreSQL sequences are moved past the copied ids.
import { createSqlRepository } from './sql.js';

/** Parents before children, so foreign keys hold during the copy. */
const ORDER = ['User', 'Session', 'Case', 'Evidence', 'Entity', 'Relationship', 'RelationshipEvidence', 'Report', 'Attachment', 'CaseMember', 'AuditEvent'];
const BATCH = 500;

/**
 * @returns {Promise<{ table: string, source: number, target: number }[]>}
 * @throws if the target already has data (unless force) or the row counts differ after the copy
 */
export async function migrateDatabase(fromUrl, toUrl, { force = false, log = () => {} } = {}) {
  if (fromUrl === toUrl) throw new Error('source and target are the same database');
  const from = await createSqlRepository(fromUrl);
  const to = await createSqlRepository(toUrl, { reset: false });
  try {
    if (!force && (await to.models.User.count()) > 0) throw new Error('target database is not empty (use --force to replace its data)');
    if (force) await to.sequelize.sync({ force: true });
    const counts = [];
    for (const name of ORDER) {
      const src = from.models[name];
      const dst = to.models[name];
      const total = await src.count();
      for (let offset = 0; offset < total; offset += BATCH) {
        const rows = await src.findAll({ order: [[src.primaryKeyAttribute, 'ASC']], limit: BATCH, offset });
        // Plain values through the model getters (e.g. tags as an array) so the target setters store them correctly.
        await dst.bulkCreate(rows.map((r) => r.get({ plain: true })), { validate: false, hooks: false });
      }
      const copied = await dst.count();
      counts.push({ table: src.tableName, source: total, target: copied });
      log(`${src.tableName}: ${copied}/${total}`);
    }
    if (to.sequelize.getDialect() === 'postgres') {
      for (const name of ORDER.filter((n) => to.models[n].rawAttributes.id?.autoIncrement)) {
        const table = to.models[name].getTableName();
        await to.sequelize.query(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`,
        );
      }
    }
    const bad = counts.filter((c) => c.source !== c.target);
    if (bad.length) throw new Error(`row counts differ: ${bad.map((c) => `${c.table} ${c.target}/${c.source}`).join(', ')}`);
    return counts;
  } finally {
    await from.close();
    await to.close();
  }
}
