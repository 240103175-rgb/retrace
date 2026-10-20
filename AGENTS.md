# AGENTS.md

Context for any AI agent working in this repository. Read it every time.

## Project

**Re:Trace** — organise an investigation of a suspected online scam: cases, evidence, entities, relationships graph, explainable risk assessment, reports, admin and audit. Full spec: `_docs/plan.md`.

Stack: React + TypeScript + Vite (`frontend/`), Node.js ≥ 22.13 + Express 5 (`backend/`), Sequelize ORM over SQLite, OpenAPI 3.1 contract (`openapi.yml`).

## Commands

```bash
npm install            # install both workspaces
npm run dev            # API on :3200 + Vite on :5174
npm run build          # build the React app
npm start              # API + built app on http://localhost:3200 (SQLite)
npm test               # backend + frontend tests
npm run validate:api   # validate openapi.yml
```

Demo accounts (synthetic, see `backend/src/seedData.js`): investigator `aigerim@retrace.test`, admin `admin@retrace.test`, password `demo-password`.

## Where things are

| Path | What |
|---|---|
| `openapi.yml` | API contract — change it first, then the code |
| `backend/src/domain/services.js` | Business rules and access control (also used by the frontend mock) |
| `backend/src/domain/risk.js` | Risk rules |
| `backend/src/repositories/` | `memory.js` and `sql.js` (Sequelize) — same interface |
| `backend/src/app.js` | Routes and JSON errors |
| `frontend/src/services/` | `RetraceApi`, `mockService`, `httpService` |
| `frontend/src/pages/`, `components/` | Screens |
| `frontend/src/lib/text.ts` | All UI text (Russian) |

## Docs

- `_docs/plan.md` — goals, scope, business rules (§4 is the source of truth).
- `_docs/process.md` — how issues move: groom → test cases → implement → QA engineer verifies and closes.
- `_docs/task-template.md` — the issue format.
- `_docs/design-system.md` — design references and tokens.
- `_docs/architecture.md`, `_docs/test-plan.md` — layers, data model, tests.
- `_docs/team/pm.md`, `_docs/team/qa.md`, `_docs/team/software-engineer.md`, `_docs/team/qa-engineer.md` — role instructions.

If you were not told your role, ask before doing anything.

## Rules

- GitHub issues are the backlog. Work on one issue at a time.
- Do not add dependencies without asking.
- Do not push to `main`; changes go through a pull request.
- Change `openapi.yml` first, then the code.
- Access control is enforced in backend services for every request, never only by hiding UI.
- Never log or return passwords, password hashes or tokens (except the token from sign-in).
- A risk score is an indicator, never proof — keep that wording in the UI and reports.
- Demo data is synthetic. Never commit real personal data, secrets, `.env` or the `data/` folder.
- Keep code, comments, commits and docs in English; UI text in Russian.
