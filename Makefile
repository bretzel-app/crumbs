.PHONY: help dev build preview check test test-unit test-e2e \
	test-unit-coverage test-e2e-coverage lint \
	db-push db-generate db-migrate db-studio docs-api \
	install docker-build docker-up docker-down docker-logs clean \
	release release-patch release-minor release-major

help: ## List all targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## Start dev server
	pnpm dev

build: ## Production build
	pnpm build

preview: ## Preview production build
	pnpm preview

check: ## Svelte type checking
	pnpm check

test: ## Run all tests (unit + e2e)
	pnpm test

test-unit: ## Run unit tests only
	pnpm test:unit

test-e2e: ## Run e2e tests only
	pnpm test:e2e

test-unit-coverage: ## Run unit tests with coverage
	pnpm test:unit:coverage

test-e2e-coverage: ## Run e2e tests with coverage
	VITE_COVERAGE=true pnpm build && pnpm test:e2e && npx nyc report

lint: ## Run linter
	pnpm lint

db-push: ## Push schema to DB
	pnpm db:push

db-generate: ## Generate migrations
	pnpm db:generate

db-migrate: ## Run migrations
	pnpm db:migrate

db-studio: ## Open Drizzle Studio
	pnpm db:studio

docs-api: ## Regenerate API docs from OpenAPI spec
	pnpm docs:api

install: ## Install dependencies
	pnpm install

docker-build: ## Build Docker image
	docker build -t crumbs .

docker-up: ## Start containers
	docker compose up -d

docker-down: ## Stop containers
	docker compose down

docker-logs: ## Tail container logs
	docker compose logs -f

clean: ## Remove build artifacts and test DBs
	rm -rf build .svelte-kit node_modules/.vite
	rm -f data/test-crumbs.db

release: ## Auto-bump version from commits, tag, and push
	bash scripts/release.sh $(BUMP)

release-patch: ## Bump patch version, tag, and push
	bash scripts/release.sh patch

release-minor: ## Bump minor version, tag, and push
	bash scripts/release.sh minor

release-major: ## Bump major version, tag, and push
	bash scripts/release.sh major
