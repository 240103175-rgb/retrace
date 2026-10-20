// npm run db:reset — recreate the SQLite demo database (#40).
import { existsSync, rmSync } from 'node:fs';
import { loadConfig } from '../src/config.js';
import { hashPassword } from '../src/crypto.js';
import { seed } from '../src/domain/seedData.js';
import { createSqlRepository } from '../src/repositories/sql.js';

const config = loadConfig();
if (config.production) {
  console.error('Refusing to reset the database with NODE_ENV=production.');
  process.exit(1);
}
if (!config.databaseUrl.startsWith('sqlite:') || config.databaseUrl === 'sqlite::memory:') {
  console.error(`Refusing: db:reset only works on a SQLite file (DATABASE_URL=${config.databaseUrl}).`);
  process.exit(1);
}
const file = config.databaseUrl.slice('sqlite:'.length);
for (const f of [file, `${file}-wal`, `${file}-shm`]) if (existsSync(f)) rmSync(f);
console.log(`Deleted ${file}`);
const repo = await createSqlRepository(config.databaseUrl);
await seed(repo, { hashPassword });
await repo.close();
console.log('Seeded synthetic demo data.');
