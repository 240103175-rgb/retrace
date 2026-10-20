# Re:Trace

[![CI](https://github.com/240103175-rgb/retrace/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/240103175-rgb/retrace/actions/workflows/ci.yml)

**Re:Trace** helps organise an investigation of a suspected online scam — a fake job offer, a "safe delivery" link, a call "from the bank" — so that every conclusion can be traced back to the evidence behind it.

Open a **case**, record **evidence** (messages, links, accounts, payments, observations), extract the **entities** (people, accounts, phones, links, cards, wallets), connect them with **relationships** backed by evidence, see them as a **graph**, get an **explainable risk assessment**, and produce an immutable **report**. Admins see statistics, all cases, roles and an audit log.

> Re:Trace does not prove guilt, does not access anyone's accounts and does not verify the data entered. A risk score is an indicator, never proof.

**Stack:** React + TypeScript + Vite · Node.js + Express · Sequelize ORM + SQLite · OpenAPI 3.1 · Vitest, node:test · GitHub Actions.

## Run

Requires Node.js 22.13+.

```bash
npm install
npm run build
npm start          # http://localhost:3200 — API + app, SQLite in backend/data/retrace.db, synthetic demo data on first start
```

Development with hot reload (API :3200, Vite :5174 with a proxy):

```bash
npm run dev
```

| Mode | Command |
|---|---|
| Frontend only, in-browser demo data | `VITE_API_MODE=mock npm run dev -w frontend` |
| API with in-memory storage | `STORAGE=memory npm start` |
| Another database (driver installed) | `DATABASE_URL=postgres://… npm start` |

### Demo accounts (synthetic)

| Email | Role | Password |
|---|---|---|
| `aigerim@retrace.test` | investigator (2 cases) | `demo-password` |
| `daniyar@retrace.test` | investigator (1 case) | `demo-password` |
| `admin@retrace.test` | admin | `demo-password` |

## Test

```bash
npm test                # backend (memory + SQLite, API contract, access, persistence) and frontend
npm run validate:api    # openapi.yml
npm run test:coverage -w backend   # backend line coverage
npm run smoke -w backend -- http://localhost:3200   # check a running server
npm run db:reset -w backend        # recreate the SQLite demo database
```

## Docs

| File | What |
|---|---|
| `chat-brainstorm.md` | Real brainstorm history |
| `_docs/plan.md` | Goals, scope, business rules, risk rules |
| `_docs/architecture.md` | Layers, data model, access rules |
| `_docs/design-system.md` | Design references and tokens |
| `_docs/test-plan.md` | Test levels and the manual session |
| `_docs/process.md`, `_docs/task-template.md`, `_docs/team/*.md` | How issues move: PM → QA → engineer → QA engineer |
| `_docs/api.md` | API by example (curl) |
| `_docs/decisions.md`, `_docs/development-log.md` | Why things are as they are; how the work went |
| `_docs/threat-model.md`, `_docs/release-checklist.md` | Security and release |
| `_docs/user-guide.md` | Руководство пользователя (RU) |
| `CHANGELOG.md` | Versions |
| `openapi.yml` | API contract |
| `AGENTS.md` | Context for coding agents |
