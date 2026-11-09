# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Issues refer to https://github.com/240103175-rgb/retrace/issues.

## [1.4.0] — 2026-11-09

### Added
- Risk detection: cross-case matches with a new rule `seen_elsewhere` — other investigators' cases appear only as a count (#136);
  look-alike and misspelled domains of Kazakh brands plus risky TLDs (#138); admin-configurable rule weights and switches,
  audited (#140); Kazakh-language scam phrases (#142).
- Investigator work: visual timeline with gaps and payment totals (#144), similar cases (#148), comments and tasks (#150).
- For victims: a public report form with honeypot and rate limit that investigators take as cases (#152); a public
  «Is this a scam?» check that counts only cases with confirmed evidence (#154).
- Interface: complete Kazakh translation with a language switch (#156), light/dark/system theme (#158), installable app
  that opens recently viewed cases offline (#160).
- Playwright specs for every feature above (#137–#161).

### Not done
- Text recognition from screenshots (#146): needs the `tesseract.js` dependency, not installed yet.

## [1.3.0] — 2026-11-03

### Added
- One Dockerfile with the built frontend served by the API, non-root, with a health check (#106).
- Docker Compose with PostgreSQL 16, health-gated start and a named volume (#108); SQLite → PostgreSQL data migration script (#107).
- Integration tests against the composed stack, including a restart (#109); Playwright end-to-end tests, one spec per feature (#110, #115–#132).
- Deployment: Render Blueprint and Railway config (#111), AWS CloudFormation on the free tier with a budget alert and an OIDC deploy role (#112), Google Cloud Terraform on the always-free e2-micro with Workload Identity Federation (#113).
- CI/CD: all test jobs, then the image is published to GHCR and redeployed on every commit to `main`, with a health check (#114).
- `SEED_DEMO` and `ADMIN_PASSWORD` for a public demo without the documented admin password.

### Fixed
- Two quick changes to the case filters no longer bring back the previous search (#133), found by the end-to-end tests.

## [1.2.0] — 2026-10-21

### Added
- PostgreSQL profile tested in CI (#29), evidence files with SHA-256 checksums (#25), rule-based entity suggestions (#23),
  draft summary with citations (#24), branded PDF with a report fingerprint (#26), collaborative investigations with
  edit-conflict detection (#27), Expo mobile app sharing the web API client (#28).

### Fixed
- Case page hook order (#105).

## [1.1.0] — 2026-10-20

### Added
- Health endpoint (#33), security headers and CSP (#34), request log without secrets (#35), graceful shutdown (#36), `.env.example` and config validation (#37), schema migrations (#38), login attempt limit (#39), `npm run db:reset` (#40), 415 for non-JSON bodies (#41), pagination (#42, #43).
- Evidence search and filters (#44, #61), case tags (#47, #62) and notes (#48, #63), risk rules `remote_access` (#50) and `fake_prize` (#51), report scores (#52, #71), JSON and CSV export (#53, #54, #64), profile, password change and sign-out everywhere (#55–#57, #65), disabling users (#58, #66), audit filters and paging (#59, #67), 7-day statistics (#60).
- Graph legend, focus and text alternative (#68, #69, #82), not-triggered rules (#70), new-case checklist (#72), in-app confirmation dialog (#73), page titles (#74), mobile tab focus (#75), character counters (#76), copy button (#77), session-expiry handling (#78), unsaved-changes warning (#79), creation toast (#80), web manifest (#81), error boundary (#83).
- CI smoke test (#84), request-body contract checks (#85), backend coverage (#86); docs: API guide, decisions, development log, threat model, user guide, templates, release checklist (#87–#95).

### Changed
- Confirmed evidence requires a source (#49); duplicate entities and relationships are refused (#45, #46).

### Fixed
- Found in the v1.1 test session (#96): form errors now name the field (#97), switching case tabs asks before dropping an unsaved form (#98), sign-out no longer sends the next user to the previous user's page (#99), Russian plural forms (#100), re-adding an existing tag saves nothing (#101), profile reachable on phones (#102), no React Router warnings (#103).

## [1.0.0] — 2026-10-20

### Added
- MVP: sign-in and roles, cases, evidence, entities, relationships, graph, explainable risk, immutable reports, admin and audit (#1–#22), built in the order mockService → OpenAPI → in-memory API → SQLite via Sequelize → connect.

### Fixed
- Report list spacing (#30), unreadable graph labels on phones (#31).
