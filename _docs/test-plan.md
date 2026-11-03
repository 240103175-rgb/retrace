# Test plan

## Levels

| Level | Tool | Where | What |
|---|---|---|---|
| Risk rules | node:test | `backend/test/risk.test.js` | Every rule, link checks, thresholds, cap, determinism |
| Domain services | node:test | `backend/test/services.test.js` | Business rules on **both** repositories |
| API contract + access | node:test + Ajv | `backend/test/api.test.js` | Real HTTP; each response validated against `openapi.yml`; every operation called; 404/403 access matrix |
| Persistence | node:test | `backend/test/persistence.test.js` | Reopen keeps data; FK/unique enforced |
| Hardening (v1.1) | node:test | `backend/test/hardening.test.js` | Health, headers, request log, config, migrations, login limit, 415, pagination, request-body contract |
| Features (v1.1) | node:test | `backend/test/features.test.js` | Filters, duplicates, tags, notes, new rules, export, profile, disable, audit paging |
| Smoke | script | `backend/scripts/smoke.mjs` | A running server answers health, login, cases, risk (CI step) |
| Frontend | Vitest + Testing Library | `frontend/src/test` | Main flows on the mock, httpService, graph layout |
| Manual | Browser | below | Running app end to end |

`npm test` runs all automated levels; CI runs them on Node 22 and 24 with contract validation, backend line coverage (`npm run test:coverage -w backend`), the build and the smoke test. API requests in tests are also checked against the contract's request schemas.

## Manual session

`npm run build && npm start`, open http://localhost:3200.

1. Sign in as `aigerim@retrace.test`; wrong password; registration with a short password.
2. Case list: search, status filter, sort by risk; create a case (too short title first).
3. In a case: add evidence of each type, change verification, edit, delete; add entities; link them with evidence; self-link refused.
4. Graph: nodes and edges match; click a node.
5. Risk: rules, references, disclaimer; change evidence and see the score change.
6. Reports: generate, open, rename the case, report unchanged; print preview.
7. Close the case: content locked; reopen.
8. Paste the URL of Daniyar's case → «Не найдено».
9. Sign in as admin: stats, all cases (read-only), change a role, last admin protected, audit log.
10. Restart the server: data and session kept.
11. 375 px width on list, case, graph, admin.
12. v1.1: tags and notes, evidence filters, JSON/CSV export, profile (name, password, sign out everywhere), disable a user, audit filters and «Показать ещё», graph legend and focus, unsaved-changes warning, session expiry.

Every defect becomes a `user-test-bug` issue (`_docs/process.md`).
