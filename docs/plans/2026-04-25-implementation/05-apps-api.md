# Plan 05 — `apps/api`

**Depends on:** 01, 02, 03.
**Produces:** the NestJS REST API with Prisma, auth, all v1 modules, OpenAPI emit, container-ready.
**Reference:** §18 (full), §21 (Prisma).

## Goal

A running api at `localhost:3001` that talks to the Compose Postgres + Redis, serves the catalog endpoints, accepts Google OAuth login, and emits a clean `openapi.json` for the docs site to consume.

## Deliverables

Top-level shape per §18.2:

```
apps/api/
├── prisma/{schema.prisma, migrations/, seed.ts}
├── src/{main.ts, app.module.ts, common/, infra/, modules/}
├── test/{integration/, contract/, fixtures/, helpers/}
├── Dockerfile                          multi-stage per §23.4
├── nest-cli.json, tsconfig*.json, package.json
└── openapi.json                        emitted at build
```

Modules: `auth`, `users`, `catalog/{puzzles,methods,sets,cases}`, `scramble`, `search`, `me`, `health`.

## Steps

1. Scaffold with `nest new --skip-git --package-manager pnpm`. Set name `@rubik/api`.
2. Add libs from §18.1 (Express adapter, config + zod env, nestjs-zod, swagger, jwt + passport-jwt, google-auth-library, throttler, terminus, cache-manager + redis-yet, nestjs-pino, OTel, Sentry, helmet, compression, schedule).
3. Set up `infra/`: config (zod env), prisma module, cache, logger (pino), throttler (Redis), telemetry. Most are `@Global()`.
4. Set up `common/`: ZodValidationPipe global, JwtAuthGuard global with `@Public` opt-out, `@CurrentUser` decorator, AllExceptionsFilter, LoggingInterceptor.
5. Author `prisma/schema.prisma` per §21.2.
6. `prisma migrate dev` against Compose Postgres → applies tables.
7. Add raw-SQL FTS migration per §21.3 (tsvector + pg_trgm indexes).
8. Implement modules in order: `health` → `auth` (Google verify → JWT mint, refresh rotation) → `users` → `catalog/*` → `scramble` (uses cube-core) → `search` (FTS + trigram via `$queryRaw`) → `me`.
9. Wire `@nestjs/swagger` + `nestjs-zod`; expose Swagger UI at `/v1/docs` in non-prod; add `openapi:emit` script that writes `openapi.json`.
10. Implement `prisma/seed.ts` skeleton (validation + upsert framework only; full content lands in Plan 06).
11. Author integration tests with Testcontainers Postgres for each module; contract test snapshotting OpenAPI shape.
12. Author the multi-stage Dockerfile per §23.4.

## Done when

- [ ] `make dev.api` boots cleanly against Compose; `/healthz` and `/readyz` 200.
- [ ] `pnpm --filter @rubik/api test` all green (unit + integration).
- [ ] Swagger UI loads at `http://localhost:3001/v1/docs`.
- [ ] `make openapi.emit` writes `apps/api/openapi.json`.
- [ ] Auth flow round-trips: a valid Google ID token → app JWT pair → authenticated `/v1/me` call.
- [ ] `make docker.api` builds; image runs and passes `/readyz`.
- [ ] Prisma Studio (`make db.studio`) opens on the migrated schema.

## Out of scope

- Real content seeding — Plan 06.
- Frontend — Plan 07.
- Trainer / solver endpoints — v2.
