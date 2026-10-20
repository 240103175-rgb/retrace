# Decision log

Each entry: context → decision → alternatives considered → consequences.

## 2026-10-20 — One web app instead of Expo + separate admin
- **Context:** the brainstorm plan suggested Expo (mobile) + React (admin) + FastAPI; one developer, 1–2 day deadline.
- **Decision:** one mobile-first React web app with an admin section; Node.js + Express backend.
- **Alternatives:** Expo + React + FastAPI (two UI codebases, two languages); Next.js full-stack (harder to keep the course's mock → contract → backend order visible).
- **Consequences:** one language end to end; the native app is #28 (`post-mvp`).

## 2026-10-20 — The frontend mock runs the real domain code
- **Context:** iteration 1 needs a working UI before the API exists; duplicating rules in TypeScript would drift.
- **Decision:** `backend/src/domain` is pure JS with injected crypto; `mockService` runs it over the in-memory repository in the browser.
- **Alternatives:** hand-written TS mock (two copies of the rules); MSW request mocks (still needs the rules somewhere).
- **Consequences:** mock and real mode behave identically; domain code must not import Node-only modules.

## 2026-10-20 — Deterministic, explainable risk rules
- **Context:** a score must never look like proof; results must be testable.
- **Decision:** weighted rules in `risk.js`, every triggered rule lists the evidence/entities behind it; score capped at 100.
- **Alternatives:** ML/LLM scoring (not explainable, not reproducible in tests).
- **Consequences:** easy to test boundaries; new patterns need new rules (v1.1 added `remote_access`, `fake_prize`).

## 2026-10-20 — 404 (not 403) for another investigator's case
- **Context:** returning 403 confirms that a case id exists.
- **Decision:** foreign cases answer 404; admins may read (200) but get 403 on writes.
- **Alternatives:** 403 everywhere.
- **Consequences:** no id enumeration; covered by the 13-probe access test.

## 2026-10-20 — SQLite through Sequelize, migrations by hand
- **Context:** course requires SQLite + a DBMS-agnostic ORM; v1.1 added columns to existing databases.
- **Decision:** Sequelize models, `DATABASE_URL`; `migrate()` adds missing columns with `queryInterface` on start.
- **Alternatives:** raw `node:sqlite` (not agnostic); Prisma (code generation + engines); Umzug migrations (more machinery than three columns need).
- **Consequences:** a v1.0 database opens in v1.1 without data loss (#38); bigger schema changes will need real migrations.

## 2026-10-20 — Uniqueness checked in the service
- **Context:** duplicates (entities, relationships) and data integrity.
- **Decision:** foreign keys on; uniqueness of entities/relationships checked in the service (labels are normalised, which a plain unique index cannot do).
- **Consequences:** two concurrent identical requests could still race; acceptable for a single-investigator case (noted in the threat model).

## 2026-10-20 — CSV export with a UTF-8 BOM
- **Context:** Excel on Windows opens UTF-8 CSV without BOM as mojibake for Cyrillic.
- **Decision:** prepend `﻿`, RFC 4180 quoting.
- **Consequences:** some tools show the BOM as a character; acceptable for the main audience.

## 2026-10-20 — In-process login attempt limit
- **Context:** password guessing (#39); the app runs as a single instance.
- **Decision:** counter per email in memory, 5 failures / 15 minutes, unknown emails counted too.
- **Alternatives:** limit in the database or Redis.
- **Consequences:** counters reset on restart and are not shared between instances — documented in the threat model.
