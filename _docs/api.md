# API guide

The full contract is `openapi.yml` (OpenAPI 3.1). This page shows the main calls with `curl`. Every example below was run against `npm start` with the demo data (see `_docs/development-log.md`).

- Base URL: `http://localhost:3200/api/v1`
- Auth: `Authorization: Bearer <token>` from `/auth/login` (sessions last 7 days).
- Non-ASCII query values (Cyrillic search) must be URL-encoded — use `curl -G --data-urlencode`.
- Bodies are JSON (`Content-Type: application/json`); other types get **415**.
- Errors: `{"error": {"code": "...", "message": "..."}}` — codes are listed in `openapi.yml` (`Error.code`).
- Another investigator's case answers **404**; an admin changing someone else's case gets **403**; closed/archived cases answer **409 `case_locked`**.

## Set up

```bash
B=http://localhost:3200/api/v1
curl -s $B/health
# {"status":"ok","storage":"sql:sqlite","version":"1.1.0"}

TOKEN=$(curl -s -X POST $B/auth/login -H 'content-type: application/json' \
  -d '{"email":"aigerim@retrace.test","password":"demo-password"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
H="Authorization: Bearer $TOKEN"
```

## Cases

```bash
curl -s -G $B/cases --data-urlencode q=вакансия -d sort=risk -d limit=10 -H "$H"
CASE=$(curl -s -X POST $B/cases -H "$H" -H 'content-type: application/json' \
  -d '{"title":"Звонок о «выигрыше»","description":"Попросили оплатить налог"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -s -X PATCH $B/cases/$CASE -H "$H" -H 'content-type: application/json' -d '{"tags":["лотерея"],"notes":"Перезвонить"}'
```

## Evidence, entities, relationships

```bash
EV=$(curl -s -X POST $B/cases/$CASE/evidence -H "$H" -H 'content-type: application/json' \
  -d '{"type":"message","content":"Вы выиграли iPhone, оплатите налог 5 000 ₸","source":"WhatsApp","verification":"confirmed"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -s -G $B/cases/$CASE/evidence --data-urlencode q=налог -d type=message -H "$H"

A=$(curl -s -X POST $B/cases/$CASE/entities -H "$H" -H 'content-type: application/json' -d '{"type":"phone","label":"+7 777 000 00 01"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
W=$(curl -s -X POST $B/cases/$CASE/entities -H "$H" -H 'content-type: application/json' -d '{"type":"card","label":"5169 **** **** 0001"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -s -X POST $B/cases/$CASE/relationships -H "$H" -H 'content-type: application/json' \
  -d "{\"sourceId\":$A,\"targetId\":$W,\"type\":\"owns\",\"evidenceIds\":[$EV]}"
```

## Graph, risk, reports, export

```bash
curl -s $B/cases/$CASE/graph -H "$H"
curl -s $B/cases/$CASE/risk -H "$H"          # fake_prize + personal_payment → 30, "medium"
curl -s -X POST $B/cases/$CASE/reports -H "$H"
curl -s $B/cases/$CASE/export -H "$H" -o case.json
curl -s $B/cases/$CASE/evidence.csv -H "$H" -o evidence.csv
```

## Account

```bash
curl -s -X PATCH $B/me -H "$H" -H 'content-type: application/json' -d '{"name":"Айгерим Н."}'
curl -s -X POST $B/auth/logout-all -H "$H"   # 204, every session ends
```

## Admin (as `admin@retrace.test`)

```bash
curl -s $B/admin/stats -H "$ADMIN"
curl -s "$B/admin/audit-events?action=evidence.&limit=20&offset=0" -H "$ADMIN"
curl -s -X PATCH $B/admin/users/2 -H "$ADMIN" -H 'content-type: application/json' -d '{"disabled":true}'
```
