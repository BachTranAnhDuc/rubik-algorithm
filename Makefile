# rubik-algorithm — top-level Makefile
# Convention: each target ends with `## description`; `help` extracts those.

SHELL       := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PNPM    ?= pnpm
COMPOSE ?= docker compose

# -- Help -------------------------------------------------------------------
.PHONY: help
help: ## Show available targets
	@awk 'BEGIN { FS = ":.*?## " } /^[a-zA-Z0-9_.\-]+:.*?## / \
	      { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# -- Workspace --------------------------------------------------------------
.PHONY: install
install: ## Install all workspace dependencies
	$(PNPM) install

.PHONY: clean
clean: ## Remove build artifacts and node_modules
	$(PNPM) -r exec rm -rf dist .next .turbo .vitepress/dist
	rm -rf node_modules

# -- Local services ---------------------------------------------------------
.PHONY: services.up
services.up: ## Start Postgres + Redis (Docker Compose)
	$(COMPOSE) up -d postgres redis

.PHONY: services.down
services.down: ## Stop and remove all Compose services
	$(COMPOSE) down

.PHONY: services.logs
services.logs: ## Tail Compose service logs
	$(COMPOSE) logs -f postgres redis

# -- Dev --------------------------------------------------------------------
.PHONY: dev
dev: services.up ## Bring up services and run all apps in dev (web + api + docs)
	$(PNPM) -w turbo run dev

.PHONY: stop
stop: services.down ## Alias for services.down

.PHONY: dev.web
dev.web: services.up ## Run only the web app in dev
	$(PNPM) --filter @rubik/web dev

.PHONY: dev.api
dev.api: services.up ## Run only the api in dev
	$(PNPM) --filter @rubik/api start:dev

.PHONY: dev.docs
dev.docs: ## Run only the docs site in dev (no backing services needed)
	$(PNPM) --filter @rubik/docs dev

# -- Database ---------------------------------------------------------------
.PHONY: db.migrate
db.migrate: ## Create + apply a new migration locally (prisma migrate dev)
	$(PNPM) --filter @rubik/api exec prisma migrate dev

.PHONY: db.deploy
db.deploy: ## Apply pending migrations (CI/prod)
	$(PNPM) --filter @rubik/api exec prisma migrate deploy

.PHONY: db.reset
db.reset: ## Drop, recreate, and reseed the local DB (destructive)
	$(PNPM) --filter @rubik/api exec prisma migrate reset --force

.PHONY: db.seed
db.seed: ## Run the YAML → DB seed pipeline
	$(PNPM) --filter @rubik/api exec prisma db seed

.PHONY: db.studio
db.studio: ## Open Prisma Studio
	$(PNPM) --filter @rubik/api exec prisma studio

.PHONY: db.format
db.format: ## Canonicalize prisma/schema.prisma
	$(PNPM) --filter @rubik/api exec prisma format

# -- Content ----------------------------------------------------------------
.PHONY: content.validate
content.validate: ## Validate content/ YAML (no DB writes)
	$(PNPM) --filter @rubik/api exec tsx prisma/seed.ts --validate-only

.PHONY: content.diff
content.diff: ## Show DB ⇄ YAML drift
	$(PNPM) --filter @rubik/api exec tsx prisma/seed.ts --dry-run

.PHONY: content.seed
content.seed: db.seed ## Alias for db.seed

.PHONY: content.lint
content.lint: ## Lint content YAML (whitespace, ordering, slug-name parity)
	$(PNPM) --filter @rubik/api tsx scripts/content-lint.ts

# -- Quality ----------------------------------------------------------------
.PHONY: lint
lint: ## Lint all packages
	$(PNPM) -w turbo run lint

.PHONY: typecheck
typecheck: ## TypeScript typecheck across the monorepo
	$(PNPM) -w turbo run typecheck

.PHONY: test
test: ## Run unit + integration tests
	$(PNPM) -w turbo run test

.PHONY: e2e
e2e: ## Run Playwright e2e tests against the running stack
	$(PNPM) --filter @rubik/web exec playwright test

.PHONY: format
format: ## Run prettier across the monorepo
	$(PNPM) -w prettier --write .

# -- Build ------------------------------------------------------------------
.PHONY: build
build: ## Build all apps and packages
	$(PNPM) -w turbo run build

.PHONY: docs.build
docs.build: ## Build the VitePress docs site
	$(PNPM) --filter @rubik/docs build

# -- Docker -----------------------------------------------------------------
.PHONY: docker.api
docker.api: ## Build the production api Docker image locally
	docker build -f apps/api/Dockerfile -t rubik-api:local .

# -- OpenAPI ----------------------------------------------------------------
.PHONY: openapi.emit
openapi.emit: ## Emit apps/api/openapi.json from current controllers
	$(PNPM) --filter @rubik/api openapi:emit
