# Running on PostgreSQL (#29)

Re:Trace uses Sequelize, so the database is chosen by `DATABASE_URL`. SQLite is the default; PostgreSQL 14+ works with the bundled `pg` driver.

## Setup

```bash
createdb retrace                      # or CREATE DATABASE retrace;
export DATABASE_URL=postgres://user:password@localhost:5432/retrace
npm run build && npm start            # creates tables, adds missing columns, seeds demo data unless NODE_ENV=production
curl http://localhost:3200/api/v1/health   # "storage": "sql:postgres"
```

- Tables are created on the first start; columns added in later versions are added by `migrate()` on start.
- With `NODE_ENV=production` no demo data is inserted. Create the first admin by registering and changing the role in the database (`UPDATE users SET role='admin' WHERE email='…'`).
- `npm run db:reset` only works for SQLite on purpose.
- Keep the password out of the repository: set `DATABASE_URL` in the environment or an untracked `.env`.

## Tests

```bash
TEST_DATABASE_URL=postgres://user:password@localhost:5432/retrace_test npm run test:postgres -w backend
```

The service, feature and API suites (contract checks and the access matrix included) run on PostgreSQL. Every test starts from an empty schema, so use a throwaway database. CI runs this against a `postgres:16` service container, then starts the server on PostgreSQL and runs the smoke test.

## Differences handled in code

| Topic | Handling |
|---|---|
| `BIGINT` timestamps come back as strings | converted to numbers in `sql.js` (`num()`) |
| Enum columns | native PostgreSQL enums created by Sequelize |
| Foreign keys | on by default (SQLite needs `PRAGMA foreign_keys`) |
