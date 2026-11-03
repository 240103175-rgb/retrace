# Deployment

| Where | How | Files | Issue |
|---|---|---|---|
| Your machine | `docker compose up --build` → http://localhost:3200 | `Dockerfile`, `compose.yaml` | #106, #108 |
| Render (free) | Blueprint: the Dockerfile as a web service + managed PostgreSQL | `render.yaml` | #111 |
| Railway | Dockerfile build + Railway PostgreSQL (`DATABASE_URL=${{Postgres.DATABASE_URL}}`) | `railway.json` | #111 |
| AWS (free tier) | CloudFormation: one EC2 instance running `deploy/compose.prod.yaml` | `deploy/aws/` | #112 |
| Google Cloud (free tier) | Terraform: one e2-micro VM running the same compose file | `deploy/gcp/` | #113 |

**Vercel** is not used: it runs static sites and short serverless functions, not a long-running Express
server with PostgreSQL in Docker. Render and Railway run the same Docker image.

## Render

1. Render → New → **Blueprint** → this repository. Render creates `retrace` (Docker, free) and `retrace-db` (PostgreSQL, free).
2. Enter `ADMIN_PASSWORD` (12+ characters) when asked.
3. Copy the service's **Deploy Hook** URL to the GitHub secret `RENDER_DEPLOY_HOOK_URL`, and the service URL to the
   repository variable `RENDER_URL`.

From then on CI calls the hook after every commit to `main` that passes all tests, and checks `/api/v1/health`.
Free web services sleep after inactivity (first request takes ~1 minute); the free database expires after 30 days.

## Environment

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | `postgres://…` (add `?sslmode=require` for hosted databases that need TLS) or `sqlite:…` |
| `SEED_DEMO` | `true` inserts the synthetic demo data in production (public demo) |
| `ADMIN_PASSWORD` | password of `admin@retrace.test` instead of the documented demo one |
| `PORT` | default 3200 |

Moving existing SQLite data: `npm run db:migrate-to-postgres -w backend -- sqlite:data/retrace.db postgres://…` (#107).
