# Tasks — v1.1 backlog

After the MVP (#1–#22) and the first test session (#30, #31). Each `###` becomes one issue labeled `mvp`; then this file is deleted.

## A. Backend hardening and operations

### Health endpoint
Goal: a public `GET /api/v1/health` tells whether the API is up and which storage it uses.

### Security headers
Goal: every response carries nosniff, frame-deny, referrer and content-security-policy headers.

### Request log without secrets
Goal: one log line per request (method, path, status, duration) that never contains tokens, passwords or query strings.

### Graceful shutdown
Goal: on SIGINT/SIGTERM the server stops accepting requests and closes the database before exiting.

### Configuration file and validation
Goal: `.env.example` documents every setting and invalid PORT/STORAGE values stop the server with a clear message.

### Schema migrations for new columns
Goal: an existing SQLite file from v1.0 gets the new v1.1 columns on start without losing data.

### Login attempt limit
Goal: after 5 failed logins for one email within 15 minutes, further attempts are refused for the rest of the window.

### Reset demo database command
Goal: `npm run db:reset` recreates the SQLite file with fresh demo data (refused in production).

### Reject non-JSON request bodies
Goal: POST/PATCH bodies that are not `application/json` get 415 instead of being silently ignored.

### Pagination for the audit log
Goal: an admin can page through the audit log with `offset`.

### Pagination for case lists
Goal: case lists accept `limit` and `offset`.

## B. Domain features

### Evidence search and filters
Goal: `GET /cases/{id}/evidence` filters by text, type and verification.

### Refuse duplicate entities
Goal: the same entity (type + label, ignoring case and spaces) cannot be added twice to a case.

### Refuse duplicate relationships
Goal: the same link (source, target, type) cannot be added twice.

### Case tags
Goal: cases carry up to 10 short tags and lists can be filtered by tag.

### Case notes
Goal: the investigator keeps free-text working notes on a case.

### Confirmed evidence needs a source
Goal: evidence can be marked confirmed only when its source is recorded.

### Risk rule: remote-access tools
Goal: asking to install AnyDesk/TeamViewer/RustDesk or to share the screen triggers a rule.

### Risk rule: fake prize
Goal: a prize or lottery win that requires paying a "tax" or "fee" triggers a rule.

### Risk score in the report list
Goal: each report in the list shows the score of its snapshot, so the trend is visible.

### Export a case as JSON
Goal: download the whole case (content, risk, report list) as one JSON file.

### Export evidence as CSV
Goal: download a case's evidence as a CSV that opens correctly in Excel.

### Change own name
Goal: a user changes the name shown in the app.

### Change own password
Goal: a user changes their password with the current one; other sessions are signed out.

### Sign out everywhere
Goal: a user ends all their sessions at once.

### Disable and enable users
Goal: an admin disables an account (no sign-in, sessions ended) and enables it again.

### Audit filters
Goal: an admin filters the audit log by person and action.

### Statistics: new cases in the last 7 days
Goal: the admin statistics show how many cases were opened in the last 7 days.

## C. Frontend

### Evidence search and filter UI
Goal: the evidence tab has a search field and type / verification filters.

### Tags UI and tag filter
Goal: tags can be edited on the case page and used as a filter in the case list.

### Case notes editor
Goal: the overview tab has a notes editor that saves.

### Export buttons
Goal: the case page offers «Экспорт JSON» and «Экспорт CSV».

### Profile page
Goal: a profile page to change name and password and to sign out everywhere.

### Admin: disable users UI
Goal: the admin users table can disable and enable accounts.

### Admin: audit filters and «Показать ещё»
Goal: the audit log in the admin page has filters and loads more on demand.

### Graph legend
Goal: the graph explains its colours and icons.

### Graph: focus on the selected node
Goal: selecting a node dims everything not connected to it.

### Risk tab: rules that did not trigger
Goal: the risk tab also lists the rules that were checked and did not trigger.

### Report list shows scores
Goal: the report list shows each report's score and level.

### Next steps for a new case
Goal: an empty case shows a short checklist of what to add.

### Accessible confirmation dialog
Goal: destructive actions use an in-app dialog instead of `window.confirm`.

### Page titles
Goal: the browser tab title names the current screen or case.

### Mobile: active tab stays visible
Goal: on a phone the selected case tab is scrolled into view.

### Character counters
Goal: long text fields show how many characters are left.

### Copy entity value
Goal: an entity's label (phone, card, link) can be copied with one click.

### Expired session handling
Goal: when the session expires mid-work the user is sent to sign in with a clear message.

### Unsaved changes warning
Goal: leaving a half-filled form asks for confirmation.

### Toast after creating a case
Goal: creating a case confirms it with a toast.

### Web app manifest
Goal: the app can be added to a phone home screen with the right name, icon and colours.

### Accessibility pass
Goal: icon buttons, the graph and forms are usable with a keyboard and a screen reader.

### Error boundary
Goal: an unexpected rendering error shows a recovery screen instead of a blank page.

## D. QA and documentation

### API smoke test in CI
Goal: CI starts the real server and runs a scripted investigation against it.

### Contract tests validate request bodies
Goal: the API tests also check that the requests they send match `openapi.yml`.

### Backend coverage report in CI
Goal: CI prints backend test coverage.

### API usage guide
Goal: `_docs/api.md` shows the main calls with curl.

### Decision log
Goal: `_docs/decisions.md` records the main technical decisions and alternatives.

### Development log
Goal: `_docs/development-log.md` summarises each iteration, what was found and fixed.

### Threat model
Goal: `_docs/threat-model.md` lists assets, threats and the controls in place.

### User guide
Goal: `_docs/user-guide.md` (Russian) explains how to run an investigation in the app.

### Changelog
Goal: `CHANGELOG.md` lists v1.0 and v1.1 changes.

### Issue and pull request templates
Goal: GitHub offers the task, bug and PR templates from `_docs/task-template.md`.

### Release checklist
Goal: `_docs/release-checklist.md` lists what must be true before a release.

### Architecture and test plan for v1.1
Goal: `_docs/architecture.md` and `_docs/test-plan.md` describe v1.1.

## E. Testing

### Second user testing session (v1.1)
Goal: v1.1 is clicked through end to end; every defect becomes a `user-test-bug`.
