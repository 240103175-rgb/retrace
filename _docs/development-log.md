# Development log

How Re:Trace was built, in order. Commits and issues: https://github.com/240103175-rgb/retrace.

## v1.0 — MVP

| Step | What happened | Issues |
|---|---|---|
| Brainstorm | Idea chosen and narrowed in `chat-brainstorm.md`; stack simplified to one web app (see `decisions.md`) | — |
| Spec and process | `plan.md`, `process.md`, roles, design references; backlog written, then moved to GitHub issues | #1 |
| Iteration 1 | React UI on `mockService` running the real domain code in the browser | #2–#13 |
| Iteration 2 | `openapi.yml`, validated in CI | #14 |
| Iteration 3 | Express API on in-memory repositories; every response checked against the contract; access matrix | #15, #16 |
| Iteration 4 | Frontend switched to `httpService` | #17 |
| Iteration 5 | Sequelize over SQLite; persistence tests (reopen, FK, unique) | #18, #19 |
| CI and docs | GitHub Actions on Node 22/24; README, architecture, test plan | #20, #22 |
| Test session 1 | Running the app in a browser found two real bugs: cramped report list, unreadable graph labels at 375 px | #30, #31 |

## v1.1 — hardening and features

| Group | Scope | Issues |
|---|---|---|
| A — backend hardening | health, headers/CSP, request log, shutdown, config, migrations, login limit, db:reset, 415, pagination | #33–#43 |
| B — domain features | evidence filters, duplicates, tags, notes, source rule, two new risk rules, report scores, export, profile, disable users, audit filters, 7-day stats | #44–#60 |
| C — frontend | UI for group B plus graph legend/focus, confirm dialog, titles, counters, copy, session expiry, unsaved warning, manifest, a11y, error boundary | #61–#83 |
| D — quality and docs | smoke test, request-body contract checks, coverage, API guide, decisions, this log, threat model, user guide, changelog, templates, release checklist, doc refresh | #84–#95 |
| E — test session 2 | Browser session on v1.1; findings filed as `user-test-bug` | #96 + linked |

## Problems worth remembering

- Request log printed router-relative paths — the path is now captured from `originalUrl` when the request starts.
- 7-day statistics counted cases with a future `createdAt` — window is now `[now − 7 days, now]`.
- `fetch().text()` silently strips the CSV BOM — tests read raw bytes.
- A character counter inside a `<label>` changed the field's accessible name and broke tests — moved next to the label.
- Cyrillic in raw `curl` URLs returns 400 — `_docs/api.md` uses `--data-urlencode`.
- Several GitHub API calls failed intermittently — scripted with retries.

## Numbers (v1.1)

Backend tests run on both repositories; backend line coverage ≈ 99 %; every contract operation is called in tests; frontend tests cover the main flows and the v1.1 screens.
