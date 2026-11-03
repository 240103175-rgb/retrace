# End-to-end tests (Playwright)

One spec per feature; each spec has a GitHub issue labelled `e2e-test` (#115–#132).
Specs create their own investigators and data through the API, so they run in parallel and in any order.

```bash
npx playwright install chromium
npm start                    # or: docker compose up --build -d --wait
npm run e2e                  # BASE_URL=http://localhost:3200 by default
ADMIN_PASSWORD=… npm run e2e # when the stack was started with ADMIN_PASSWORD
```

| Spec | Issue | Feature |
|---|---|---|
| 01-auth | #115 | sign in, wrong password, register, sign out |
| 02-cases | #116 | create, search, status filter, sort by risk |
| 03-case-details | #117 | edit, status, locking |
| 04-evidence | #118 | add, edit, delete, filters, source rule |
| 05-attachments | #119 | files with SHA-256 |
| 06-entities | #120 | entities, duplicates, relationships |
| 07-suggestions | #121 | entity suggestions |
| 08-graph | #122 | graph |
| 09-risk | #123 | explainable risk |
| 10-summary | #124 | draft summary with citations |
| 11-reports | #125 | snapshot, fingerprint, PDF |
| 12-export | #126 | JSON and CSV |
| 13-collaboration | #127 | sharing, roles, conflicts |
| 14-profile | #128 | name, password, sign out everywhere |
| 15-admin | #129 | statistics, users, audit |
| 16-access | #130 | access control |
| 17-notes-tags | #131 | notes, tags, unsaved changes |
| 18-phone | #132 | phone layout |
