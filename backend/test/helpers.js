import { after } from 'node:test';
import { nodeDeps } from '../src/crypto.js';
import { createServices } from '../src/domain/services.js';
import { DEMO_PASSWORD, seed } from '../src/domain/seedData.js';
import { createMemoryRepository } from '../src/repositories/memory.js';
import { createSqlRepository } from '../src/repositories/sql.js';

export const NOW = Date.parse('2026-10-20T08:00:00Z');

/** Storage implementations every service and API test runs against. */
export const REPOSITORIES = {
  memory: async () => createMemoryRepository(),
  sqlite: () => createSqlRepository('sqlite::memory:'),
  // #29 PostgreSQL when TEST_DATABASE_URL is set (CI); each setup starts from an empty schema.
  ...(process.env.TEST_DATABASE_URL ? { postgres: () => createSqlRepository(process.env.TEST_DATABASE_URL, { reset: true }) } : {}),
};

// Database connections stay open until the file's tests finish (PostgreSQL pools would keep the process alive).
const opened = [];
after(async () => {
  for (const repo of opened.splice(0)) await repo.close();
});

export async function setup(makeRepo = REPOSITORIES.memory) {
  const repo = await makeRepo();
  opened.push(repo);
  const deps = nodeDeps(() => NOW);
  await seed(repo, { hashPassword: deps.hashPassword, now: NOW });
  const svc = createServices(repo, deps);
  const login = async (email) => (await svc.login({ email, password: DEMO_PASSWORD })).user;
  const users = {
    aigerim: await repo.findUserByEmail('aigerim@retrace.test'),
    daniyar: await repo.findUserByEmail('daniyar@retrace.test'),
    admin: await repo.findUserByEmail('admin@retrace.test'),
  };
  const cases = await repo.listCases({});
  const byTitle = (part) => cases.find((c) => c.title.includes(part));
  return { repo, svc, deps, users, login, job: byTitle('вакансия'), olx: byTitle('OLX'), bank: byTitle('банка') };
}
