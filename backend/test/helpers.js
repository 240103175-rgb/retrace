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
};

export async function setup(makeRepo = REPOSITORIES.memory) {
  const repo = await makeRepo();
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
