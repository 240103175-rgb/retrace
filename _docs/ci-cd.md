# CI/CD (#114)

`.github/workflows/ci.yml` runs on every push and pull request.

```
unit (Node 22, 24) ─┐
postgres ───────────┤
mobile ─────────────┼─► publish image to GHCR ─► deploy-render ─► health check
infra ──────────────┤   (main only)              deploy-aws    ─► health check
stack ──────────────┘                            deploy-gcp    ─► health check
```

| Job | What it proves |
|---|---|
| unit | OpenAPI contract valid; backend tests with coverage (memory + SQLite, contract, access matrix); frontend tests; build; smoke test |
| postgres | service, feature, attachment, sharing, migration and API suites on PostgreSQL 16 |
| mobile | Expo app type-checks against the shared client, unit tests, iOS + Android bundles |
| infra | `cfn-lint` on the CloudFormation template, `terraform fmt`/`validate`, production compose file valid |
| stack | builds the Docker image, `docker compose up --wait` (app + PostgreSQL), non-root check, smoke, **integration tests**, **Playwright end-to-end tests** (one spec per feature, report uploaded as an artifact), restart and check that data survived |
| publish | main only, after all of the above: pushes `ghcr.io/240103175-rgb/retrace:latest` and `:sha-<commit>` |
| deploy-* | run only when their repository variables exist; each waits until `/api/v1/health` reports the commit just tested (`commit` field: Render's `RENDER_GIT_COMMIT`, or `GIT_COMMIT` baked into the GHCR image) and fails the run otherwise |

A failing test blocks publishing and every deployment. Deploy credentials: Render deploy hook (secret),
AWS through a GitHub OIDC role, Google Cloud through Workload Identity Federation — no long-lived cloud keys.

## Run the same locally

```bash
npm test                                  # unit
docker compose up --build -d --wait       # stack
npm run test:integration                  # integration against http://localhost:3200
npx playwright install chromium && npm run e2e
```
