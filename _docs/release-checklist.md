# Release checklist

Before tagging a release, every line must be true:

- [ ] `npm test` passes locally; CI is green on Node 22 and 24 (contract, backend with coverage, frontend, build, smoke).
- [ ] `npm run validate:api` passes; `openapi.yml` `info.version` = release version; `/api/v1/health` reports it.
- [ ] No open issue labeled `mvp` or `user-test-bug`.
- [ ] A manual session per `_docs/test-plan.md` was run on this version; findings filed and closed.
- [ ] `CHANGELOG.md` has the release section; `_docs/development-log.md` updated.
- [ ] README, AGENTS.md, architecture and test plan describe the release.
- [ ] A v1.0 database opens without errors (migrations).
- [ ] `NODE_ENV=production` start: no demo data, no dev-only behaviour.
- [ ] PR to `main` reviewed and merged; tag `vX.Y.Z` on the merge commit.
