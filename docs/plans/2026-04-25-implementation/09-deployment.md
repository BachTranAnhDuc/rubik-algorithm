# Plan 09 — Deployment

**Depends on:** 05, 07, 08.
**Produces:** CI/CD pipelines, hosting set up on Vercel + Fly.io + Cloudflare Pages + Neon + Upstash, plus an oncall runbook.
**Reference:** §12, §16 (CI), §17 (docs deploy).

## Goal

Every PR gets a preview environment; merging to `main` deploys to prod with appropriate gating. Secrets live in the platforms, not the repo. Errors surface in Sentry; structured logs land in Grafana Loki.

## Deliverables

```
.github/workflows/
├── ci.yml                              install → lint → typecheck → test (with Postgres service)
├── e2e.yml                             Playwright on main + label-triggered PRs
├── content-validate.yml                fast YAML validation gate
├── deploy-api.yml                      build image, push, flyctl deploy
└── deploy-docs.yml                     gen:api, build, push to Cloudflare Pages

fly.toml                                api app config
apps/docs/cloudflare-pages.config       (or per-Pages dashboard)
docs/ops/runbook.md (already in Plan 08, expand here)
```

## Steps

1. **Vercel** — connect the repo; project root `apps/web`. Env vars per `.env.example`. Preview deploy on every PR.
2. **Fly.io** — `flyctl launch --no-deploy`; author `fly.toml` (regions, healthcheck on `/readyz`, autoscale on CPU). Set secrets via `flyctl secrets set`.
3. **Neon** — create project; capture pooled `DATABASE_URL` and direct `DIRECT_URL`; enable branching.
4. **Upstash Redis** — create DB; capture URL.
5. **Cloudflare Pages** — connect repo; build command `pnpm --filter @rubik/docs build`; output `apps/docs/.vitepress/dist`. Custom domain `docs.<your-domain>`.
6. **Sentry** — create projects for web and api; capture DSNs.
7. **GitHub Actions secrets** — add: `FLY_API_TOKEN`, `VERCEL_*`, `CLOUDFLARE_*`, Sentry DSNs, `GOOGLE_CLIENT_*`, JWT secrets, Neon URLs.
8. Author the workflows above. `ci.yml` uses Postgres + Redis service containers; matrix only when needed.
9. Configure branch protection on `main`: require ci.yml + content-validate.yml.
10. Add an explicit "deploy api" approval gate for prod.
11. Author `docs/ops/runbook.md`: how to roll back, common 5xx remediation, DB hot-restore from Neon backup.

## Done when

- [ ] PR opens → Vercel preview URL + Fly preview machine + Cloudflare Pages preview, all reachable.
- [ ] Merge to `main` → prod web on `<your-domain>`, api on `api.<your-domain>`, docs on `docs.<your-domain>`.
- [ ] `prisma migrate deploy` runs as a one-shot Fly machine before traffic flips.
- [ ] Sentry captures a deliberately-thrown test error in both web and api.
- [ ] Status of every workflow visible from the PR check list.
- [ ] Runbook covers at least: 5xx surge, DB connection saturation, Redis eviction, secret rotation.

## Out of scope

- Multi-region active-active — v1 is single region.
- Blue-green or canary deploys — v1 uses Fly's standard rolling deploy.
- Paid Sentry / Plausible features — start on free tiers.
