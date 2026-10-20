# Re:Trace — product specification

## 1. Goal

Re:Trace helps a person organise an investigation of a suspected online scam — a fake job offer, a "too good" marketplace deal, a phishing message — so that every conclusion can be traced back to the evidence behind it.

The user opens a **case**, records **evidence** (messages, links, accounts, payments, observations), extracts the **entities** involved (people, accounts, phones, links, cards, wallets), connects them with **relationships** backed by evidence, gets an **explainable risk assessment**, and produces a **report**.

> Re:Trace organises an investigation. It does **not** prove guilt, does not access other people's accounts and does not verify the truth of the data entered. A risk score is an indicator, never proof.

## 2. Users

| Role | Needs |
|---|---|
| **Investigator** | Create cases, add evidence and entities, link them, see why a case looks risky, export a report. Sees only their own cases. |
| **Admin** | See all cases and statistics, change user roles, read the audit log. |

## 3. MVP scope

### In scope
1. **Sign-in** — email + password, bearer token; roles investigator / admin; registration of a new investigator.
2. **Cases** — create, edit, change status (open → in review → closed, or archived), list with search, status filter and sorting.
3. **Evidence** — type (message, link, account, payment, observation), content, source, observed date, verification status (unverified / confirmed / disputed).
4. **Entities** — type (person, account, phone, link, card, wallet, organisation), label, note.
5. **Relationships** — source entity → target entity with a type (contacted, paid, owns, links to, same as) and the evidence that supports it.
6. **Graph** — the case's entities and relationships drawn as a graph; selecting a node shows its details and links.
7. **Risk assessment** — deterministic rules with fixed weights; every triggered rule lists the evidence or entities that triggered it; score 0–100 and level low / medium / high; a clear disclaimer.
8. **Reports** — a snapshot of the case (summary, evidence, entities, relationships, risk, limitations) saved at generation time; later edits do not change an existing report; printable.
9. **Admin** — all cases, statistics, users and roles, audit log.
10. **Audit** — every change records who, what, which resource, when; no passwords or tokens in the log.

### Out of scope (MVP)
Scanning other people's accounts, bank integrations, identity verification, AI extraction or summaries, file uploads, real-time collaboration, notifications, native mobile apps.

## 4. Business rules

- An investigator can read and change only their own cases; an admin can read all cases. Checked on the backend for every request.
- Archived and closed cases are read-only except for changing the status back to open.
- A relationship needs two different entities of the same case; supporting evidence must belong to the same case.
- Deleting an entity deletes its relationships; deleting evidence removes it from relationships' support lists.
- Risk rules (weights add up, capped at 100):

| Rule | Weight | Triggered by |
|---|---|---|
| `credential_request` | 25 | message evidence asking for a code, password, PIN or CVV |
| `urgent_payment` | 20 | message evidence combining urgency with payment / prepayment |
| `remote_access` | 20 | message or observation asking to install AnyDesk / TeamViewer / RustDesk or share the screen (v1.1) |
| `suspicious_link` | 20 | link evidence or link entity that is not HTTPS, uses an IP address, a URL shortener, punycode, or imitates a known brand domain |
| `personal_payment` | 15 | payment evidence or a card / wallet entity that receives money |
| `fake_prize` | 15 | message evidence combining a prize / lottery win with a tax, fee or payment (v1.1) |
| `hub_entity` | 10 | an entity connected to 3 or more other entities |
| `disputed_evidence` | 10 | evidence marked disputed |

  Level: low < 30 ≤ medium < 60 ≤ high. If no evidence is confirmed, the assessment says so ("based only on unverified evidence"). Absence of triggered rules is **not** shown as "safe".
- Confirmed evidence must record its source (v1.1).
- Entities are unique per case by type + label; relationships by source + target + type (v1.1).
- A report is an immutable snapshot.
- Passwords are stored as scrypt hashes; tokens expire after 7 days.
- Demo data is synthetic and labelled as such.

## 5. Data model

See `_docs/architecture.md`.

## 6. Technical approach

Built in the iteration order required by the course: React frontend on a `mockService` → `openapi.yml` → Express API with in-memory repositories → Sequelize ORM over SQLite → connect frontend and backend → real testing.

## 7. Success criteria

- The core path works on the real API: create case → add evidence → add entities → link them → see the explained risk → generate a report.
- Data survives a backend restart.
- An investigator can never read another investigator's case.
- Every `mvp` and `user-test-bug` issue is closed by QA after verification.
