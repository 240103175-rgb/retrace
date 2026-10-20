# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Issues refer to https://github.com/240103175-rgb/retrace/issues.

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
