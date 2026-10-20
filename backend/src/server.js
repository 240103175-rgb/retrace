import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { hashPassword } from './crypto.js';
import { seed } from './domain/seedData.js';
import { createMemoryRepository } from './repositories/memory.js';
import { createSqlRepository } from './repositories/sql.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`Invalid configuration: ${err.message}`);
  process.exit(1);
}

const repo = config.storage === 'memory' ? createMemoryRepository() : await createSqlRepository(config.databaseUrl);
if (!config.production && (await seed(repo, { hashPassword }))) console.log('Seeded synthetic demo data.');

const app = createApp({ repo, staticDir: fileURLToPath(new URL('../../frontend/dist', import.meta.url)) });
const server = app.listen(config.port, (err) => {
  if (err) {
    console.error(`Cannot start on port ${config.port}: ${err.message}`);
    process.exit(1);
  }
  console.log(`Re:Trace API (${repo.kind} storage) on http://localhost:${config.port}`);
});

// #36: stop accepting connections, close the database, exit.
let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Shutting down (${signal})…`);
  server.close();
  server.closeAllConnections?.();
  await repo.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
