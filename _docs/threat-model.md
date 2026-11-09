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
| Tampering | Changing someone else's case | Ownership or editor membership checked in the service for every write; viewers and admins read-only; only the owner changes title, status and members | `writableCase()`, `sharing.test`, `api.test` access matrix |
| Tampering | Two people overwriting each other | `version` on cases, evidence, entities; stale PATCH → `edit_conflict` | `checkVersion()` (#27) |
| Tampering | Swapped or corrupted evidence file | SHA-256 stored at upload, checked against the client's hash, sent with downloads; type sniffed from bytes | `files.js` (#25) |
| Tampering | Editing a closed case or a report | `case_locked`; reports are immutable snapshots | `services`, persistence tests |
| Repudiation | "I didn't delete that" | Audit log of every change with actor and time; no secrets in it | `addAudit`, #59 |
| Information disclosure | Reading another investigator's case | 404 for foreign cases (no id enumeration) | 13-probe access test |
| Information disclosure | Secrets in logs | Request log has method, path, status, time only; error log has method + path | `app.js` (#35) |
| Information disclosure | XSS stealing tokens | React escaping, no `dangerouslySetInnerHTML`; CSP `script-src 'self' 'wasm-unsafe-eval'` (WebAssembly for in-browser OCR, no JavaScript `eval`) | #34 #146 |
| Information disclosure | Clickjacking | `X-Frame-Options: DENY`, `frame-ancestors 'none'` | #34 |
| Denial of service | Huge bodies | 100 KB JSON limit; non-JSON bodies 415 | `app.js` (#41) |
| Elevation of privilege | Investigator calling admin endpoints | `requireAdmin` in services; last active admin cannot be demoted/disabled | `services.admin*` |

## Public endpoints (v1.4)

| Threat | Control |
|---|---|
| Spam or flooding through the public report form | 5 reports per hour per client address (in memory), honeypot field, 2 MB file limit, consent required |
| Using the public check to label someone a scammer | Only a count; only cases with at least one **confirmed** piece of evidence; wording «подсказка, а не доказательство»; 30 checks per minute per address |
| Learning other investigators' cases through matches | Titles only for cases the user may read; everything else is a number |
| Data of one user shown to the next on a shared device (offline cache) | API cache cleared on every sign-in and sign-out; writes never cached; auth, public, file and export responses never cached |

Behind a proxy (Render, Caddy) set `TRUST_PROXY=1` so limits use the real client address. Counters reset on restart.

## Known gaps (accepted for the MVP)

- Sharing by email answers `user_not_found` for unknown emails, so a signed-in investigator can learn which emails have accounts. Accepted: only signed-in users, and only on their own cases.
- Attachments live in the database (max 2 MB × 10 per evidence); no virus scanning — downloads are always `attachment` + `nosniff`, never rendered inline.

- Login limit counters live in memory: reset on restart, not shared between instances.
- Tokens are stored in `localStorage` (readable by any script that bypasses CSP); an HttpOnly cookie would be stronger.
- No HTTPS in the app itself — must run behind a TLS proxy.
- Uniqueness of entities/relationships is checked in the service, so two simultaneous identical requests could both succeed.
- Evidence text is not encrypted at rest; protect the SQLite file with OS permissions.
- Demo accounts share a known password — never run with demo data in production (`NODE_ENV=production` skips the seed).
