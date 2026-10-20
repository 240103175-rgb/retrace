# Architecture

```
React UI (frontend/src/pages, components)
   │ only through
RetraceApi interface (frontend/src/services/api.ts)
   ├── mockService — runs the real domain services in the browser over the in-memory repository
   └── httpService — fetch /api/v1 with a bearer token
          │ contract: openapi.yml
Express routes (backend/src/app.js) — auth, JSON errors, no business rules
   │
Domain (backend/src/domain)
   ├── services.js — access control, validation, cases, evidence, entities, relationships, reports, admin, audit
   ├── risk.js     — deterministic, explainable risk rules (pure)
   └── seedData.js — synthetic demo data
   │ only through
Repository interface
   ├── repositories/memory.js — in RAM (STORAGE=memory, tests, browser mock)
   └── repositories/sql.js    — Sequelize over DATABASE_URL (default SQLite)
```

One source of business rules: the same `domain/` code runs in the backend and in the frontend mock, so mock mode and real mode cannot drift apart. Crypto (scrypt, tokens) is injected, so the domain has no Node-only imports.

## Access rules (checked in `services.js` for every call)

| Who | Own case | Another investigator's case | /admin |
|---|---|---|---|
| Investigator | read + write (content locked when closed/archived) | 404 — existence not revealed | 403 |
| Admin | read + write | read only (writes → 403) | yes |

## Data model

| Table | Fields |
|---|---|
| users | id, email (unique), name, role (investigator/admin), passwordHash (scrypt), disabled, createdAt |
| sessions | token (PK), userId → users, expiresAt (7 days) |
| cases | id, ownerId → users, title, description, status (open/in_review/closed/archived), tags (JSON, ≤10), notes, createdAt, updatedAt |
| evidence | id, caseId → cases, type, content, source, observedOn, amount, verification (unverified/confirmed/disputed), createdAt |
| entities | id, caseId → cases, type, label, note |
| relationships | id, caseId → cases, sourceId → entities, targetId → entities, type |
| relationship_evidence | relationshipId → relationships, evidenceId → evidence |
| reports | id, caseId → cases, createdBy → users, createdAt, snapshot (JSON, immutable) |
| audit_events | id, actorId → users, action, resourceType, resourceId, caseId, at |

Times are UTC milliseconds in storage and ISO strings in the API. Deleting an entity deletes its relationships; deleting evidence deletes its join rows.

## Risk engine

`backend/src/domain/risk.js` — eight weighted rules (see `_docs/plan.md` §4), each returning the evidence/entities that triggered it. Score capped at 100; levels low < 30 ≤ medium < 60 ≤ high. Computed on read, so it always reflects the current case; reports store the result in their snapshot.

## Cross-cutting (v1.1)

- **Config** — `backend/src/config.js` validates `PORT`, `STORAGE`, `DATABASE_URL`; bad values stop the start with a clear message.
- **Migrations** — `sql.js` `migrate()` adds missing columns on start, so an older database keeps its data.
- **HTTP** — security headers + CSP, 100 KB JSON limit, 415 for non-JSON bodies, request log (method, path, status, ms — never bodies or tokens), `GET /health` without auth.
- **Shutdown** — SIGINT/SIGTERM stop accepting requests and close the database.
- **Login limit** — 5 failures per email in 15 minutes (in memory, see `_docs/threat-model.md`).
- **Export** — `GET /cases/{id}/export` (JSON, `retrace-case/1`) and `/evidence.csv` (UTF-8 with BOM).

Decisions and their reasons: `_docs/decisions.md`.
