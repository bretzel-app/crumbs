# CLAUDE.md

## Project overview

Crumbs by Bretzel — self-hostable note-taking app. Single-user, offline-first PWA with CRDT-based sync.

## Tech stack

- **Framework**: SvelteKit with Svelte 5 (runes: `$state`, `$derived`, `$props`, `$effect`)
- **Adapter**: `@sveltejs/adapter-node` (builds to `build/`, runs via `node build`)
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`)
- **Database**: SQLite via better-sqlite3 + Drizzle ORM (WAL mode, schema at `src/lib/server/db/schema.ts`)
- **Auth**: Single-user password auth with Argon2 hashing, session cookies (30-day expiry)
- **PWA**: `@vite-pwa/sveltekit` for service worker and offline caching
- **Package manager**: pnpm

## Design system: Retro Parchment

The UI follows a **parchment + 8-bit retro** aesthetic. All design decisions must preserve this character.

### Color palette

All colors are CSS variables in `src/app.css`. Never use hardcoded Tailwind colors (e.g. `text-gray-500`, `bg-red-600`) — always reference CSS variables:

| Variable | Value | Usage |
|---|---|---|
| `--bg-base` | `#f0e6d3` | Page background (warm parchment) |
| `--bg-surface` | `#faf5eb` | Cards, panels, inputs |
| `--primary` | `#C8860A` | Brand gold — links, active states, accents |
| `--primary-hover` | `#E8A020` | Gold hover state |
| `--text` | `#1a1a2e` | Primary text (near-black) |
| `--text-muted` | `#6b6272` | Secondary text, placeholders |
| `--border` | `#1a1a2e` | Strong borders (editor, login card) |
| `--border-subtle` | `#d4cabb` | Default card borders, dividers |
| `--destructive` | `#a63d2f` | Delete actions, error icons |
| `--error-bg/border/text` | warm reds | Error states (themed, not clinical red) |
| `--success-bg/text` | warm greens | Success states |
| `--card-shadow` | `2px 2px 0px` | Hard-offset retro shadow (no blur) |
| `--card-shadow-hover` | `3px 3px 0px` | Hover shadow in primary gold |

Note colors for cards are defined in `src/lib/utils/colors.ts`.

### Typography

- **Body**: `JetBrains Mono` (monospace) — the hacker/dev aesthetic
- **Brand / empty states**: `Press Start 2P` (pixel font) — the 8-bit accent
- These two fonts are intentional. Do not replace them or add others.

### Visual rules

- **Shadows**: Always hard-offset (`2px 2px 0px`) with zero blur. Never use `shadow-sm`, `shadow-md` etc. — they look too modern.
- **Corners**: `rounded-sm` everywhere. Sharp, not rounded. Exception: color picker circles use `rounded-full`.
- **Borders**: Default card borders use `--border-subtle`. `--border` is for strong emphasis (editor, login card). Hover borders use `--primary`.
- **Animations**: Crisp and fast (150ms `ease-out`). No spring physics, no bounce. The retro feel comes from snappy transitions.
- **Background texture**: A subtle 4px pixel grid overlay at 3% opacity (defined in `body::before`).
- **Checkboxes**: Use `accent-color: var(--primary)` globally — gold checkboxes match the theme.
- **Icons**: Lucide icons throughout. Keep at 16-20px size.
- **Hover actions**: Never use `hidden group-hover:block` for action buttons — they're invisible on mobile (no hover). Use the opacity pattern instead: `max-md:opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100`. This keeps actions always visible on touch devices and hover-revealed on desktop.

### Layout groups

- `(auth)` — Login/setup pages: minimal centered layout, no app chrome
- `(app)` — Main app: header, sidebar, footer, toast notifications

## Project structure

```
src/
  routes/
    +layout.svelte     # Root layout (imports CSS only)
    (auth)/            # Layout group: login/setup (minimal, no app chrome)
      +layout.svelte   # Centered parchment background
      login/           # Login page
      setup/           # First-time password setup
    (app)/             # Layout group: main app (header, sidebar, footer)
      +layout.svelte   # App shell with Header, Sidebar, Toast
      +page.svelte     # Main notes view
    api/auth/          # Login, logout, setup endpoints
    api/notes/         # CRUD + attachments
    api/search/        # Full-text search
    api/sync/          # Offline sync
    api/tags/          # Tag management
  lib/
    components/        # Svelte components (NoteCard, NoteEditor, TagChip, etc.)
    stores/            # Svelte stores (notes.ts, theme.ts)
    server/db/         # Drizzle schema + connection (schema.ts, index.ts)
    server/            # Auth logic, attachment handling
    sync/              # Client sync (idb.ts), CRDT merge (crdt.ts), server sync
    types/             # TypeScript interfaces (Note, Attachment, Tag, etc.)
    utils/             # Colors, markdown, tags, debounce
  hooks.server.ts      # Auth middleware (redirects unauthenticated users)
tests/
  unit/                # Vitest unit tests
  e2e/                 # Playwright e2e tests (Gherkin-style)
    helpers/fixtures.ts  # Shared authenticatedPage fixture
```

## Commands

A `Makefile` wraps all common tasks for tool-agnostic usage. Run `make help` to list targets.

| Make target | pnpm equivalent | Description |
|---|---|---|
| `make dev` | `pnpm dev` | Start dev server |
| `make build` | `pnpm build` | Production build |
| `make preview` | `pnpm preview` | Preview production build |
| `make check` | `pnpm check` | Svelte type checking |
| `make test` | `pnpm test` | Run all tests (unit + e2e) |
| `make test-unit` | `pnpm test:unit` | Run unit tests only |
| `make test-e2e` | `pnpm test:e2e` | Run e2e tests only |
| `make lint` | `pnpm lint` | Run linter |
| `make db-push` | `pnpm db:push` | Push schema to DB |
| `make db-generate` | `pnpm db:generate` | Generate migrations |
| `make db-migrate` | `pnpm db:migrate` | Run migrations |
| `make db-studio` | `pnpm db:studio` | Open Drizzle Studio |
| `make docs-api` | `pnpm docs:api` | Regenerate API docs from OpenAPI spec |
| `make install` | `pnpm install` | Install dependencies |
| `make docker-build` | — | Build Docker image |
| `make docker-up` | — | Start containers |
| `make docker-down` | — | Stop containers |
| `make docker-logs` | — | Tail container logs |
| `make clean` | — | Remove build artifacts + test DBs |
| `make release` | — | Auto-bump version from commits, tag, and push |
| `make release-patch` | — | Bump patch version, tag, and push |
| `make release-minor` | — | Bump minor version, tag, and push |
| `make release-major` | — | Bump major version, tag, and push |

## Git conventions

- **Conventional commits**: Use `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:` prefixes
- **Commit regularly**: Bundle related changes into logical commits after each step or feature slice — don't accumulate a large diff
- **Feature branches**: Use `feat/<name>` branches with worktrees for isolation
- **Rebase before PR**: Always `git rebase origin/main` (not merge) before pushing or creating a PR to keep a clean linear history and avoid merge conflicts in the PR

## CI/CD

GitHub Actions with two workflows:

**CI** (`.github/workflows/ci.yml`) — runs on push to `main`/`claude/**` and PRs to `main`:
1. **Lint & Type Check** — `pnpm check`
2. **Unit Tests** — `pnpm test:unit`
3. **Build** — `pnpm build` (depends on steps 1+2)
4. **E2E Tests** — Playwright with Chromium (depends on step 3, uploads report on failure)
5. **Docker Build** — validates the Docker image builds (depends on step 3)

**Bump & Release** (`.github/workflows/bump.yml`) — workflow_dispatch (primary release method):
- Runs `scripts/release.sh` to bump version in `package.json` + `docker-compose.yml`, tag, and push
- Runs full CI pipeline, then builds + pushes Docker image to `ghcr.io`
- Creates a GitHub Release with auto-generated notes

**Release** (`.github/workflows/release.yml`) — runs on `v*` tags (fallback for manual/local tag pushes):
- Same as above: CI pipeline, Docker build/push, GitHub Release

**Docker**: Multi-stage Dockerfile (node:22-slim), exposes port 3000, persists data to `/data` volume.

## Testing philosophy: BDD/TDD

Write tests first or alongside features. Tests serve as living documentation of expected behavior.

### Unit tests (Vitest)

- Location: `tests/unit/*.test.ts`
- Config: `vitest.config.ts` (node environment)
- Cover pure logic: markdown parsing, tag extraction, auth, search, sync

### E2E tests (Playwright)

- Location: `tests/e2e/*.spec.ts`
- Config: `playwright.config.ts` (Chromium only, builds + previews app on port 4173)
- Test database: `./data/test-crumbs.db` (cleaned via `global-setup.ts`)
- Auth fixture: `tests/e2e/helpers/fixtures.ts` provides `authenticatedPage` (handles setup/login race conditions across parallel workers)
- Auth tests use `test.describe.serial` because they depend on sequential database state

### Gherkin-style Given/When/Then

E2E tests follow Cucumber BDD conventions via comments. Follow the [Better Gherkin](https://cucumber.io/docs/bdd/better-gherkin) guidelines:

**Declarative, not imperative** — describe *what* the system does, not *how* the user interacts with the UI:
```
// Good: "When the user trashes the note"
// Bad:  "When the user hovers over the note card and clicks the trash button"
```

**Given describes state, not navigation:**
```
// Good: "Given a note titled 'Delete Me' exists"
// Bad:  "Given the user clicks the new note button and fills in the title"
```

**Collapse multi-step UI actions into a single intent:**
```
// Good: "When the user creates a note titled 'My Note' with content 'Hello'"
// Bad:  "When they click new note / And fill in the title / And fill in the content / And close the editor"
```

**Scenario names describe outcomes/behavior, not actions:**
```
// Good: "Scenario: Trashed note disappears from the main view"
// Bad:  "Scenario: User moves a note to trash"
```

**Resilience test** — ask: *"Will this comment need to change if the UI implementation changes?"* If yes, rewrite it to remove implementation details. The Playwright code underneath handles the *how*; the comments describe the *what*.

## Documentation

Keep docs in `docs/` up to date when making changes. If a feature, API endpoint, deployment config, or architectural decision changes, update the relevant doc file in the same commit or PR:

| Doc | Covers |
|-----|--------|
| `docs/FEATURES.md` | User-facing feature list |
| `docs/ARCHITECTURE.md` | System design, data flow, schema, tech stack |
| `docs/DEPLOYMENT.md` | Docker, env vars, reverse proxy, backups |
| `docs/openapi.yaml` | API spec (run `pnpm docs:api` to regenerate `docs/API.md`) |
