# Threat model

## Assets
Case content (evidence about real people), user accounts and passwords, session tokens, audit log integrity.

## Actors
Investigator (legitimate, sees own cases), admin, another investigator (curious), anonymous internet user, someone with the server file system.

## Threats and controls

| STRIDE | Threat | Control in place | Where |
|---|---|---|---|
| Spoofing | Guessing a password | scrypt hashes; 5 failed logins / 15 min per email, unknown emails counted the same | `crypto.js`, `services.login` (#39) |
| Spoofing | Stolen token | 7-day expiry; «sign out everywhere»; password change ends other sessions; disabled users lose sessions | `services`, #56–#58 |
| Tampering | Changing someone else's case | Ownership checked in the service for every write; admins read-only on others' cases | `writableCase()`, `api.test` access matrix |
| Tampering | Editing a closed case or a report | `case_locked`; reports are immutable snapshots | `services`, persistence tests |
| Repudiation | "I didn't delete that" | Audit log of every change with actor and time; no secrets in it | `addAudit`, #59 |
| Information disclosure | Reading another investigator's case | 404 for foreign cases (no id enumeration) | 13-probe access test |
| Information disclosure | Secrets in logs | Request log has method, path, status, time only; error log has method + path | `app.js` (#35) |
| Information disclosure | XSS stealing tokens | React escaping, no `dangerouslySetInnerHTML`; CSP `script-src 'self'` | #34 |
| Information disclosure | Clickjacking | `X-Frame-Options: DENY`, `frame-ancestors 'none'` | #34 |
| Denial of service | Huge bodies | 100 KB JSON limit; non-JSON bodies 415 | `app.js` (#41) |
| Elevation of privilege | Investigator calling admin endpoints | `requireAdmin` in services; last active admin cannot be demoted/disabled | `services.admin*` |

## Known gaps (accepted for the MVP)

- Login limit counters live in memory: reset on restart, not shared between instances.
- Tokens are stored in `localStorage` (readable by any script that bypasses CSP); an HttpOnly cookie would be stronger.
- No HTTPS in the app itself — must run behind a TLS proxy.
- Uniqueness of entities/relationships is checked in the service, so two simultaneous identical requests could both succeed.
- Evidence text is not encrypted at rest; protect the SQLite file with OS permissions.
- Demo accounts share a known password — never run with demo data in production (`NODE_ENV=production` skips the seed).
