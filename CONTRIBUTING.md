# Contributing to Crumbs

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/bretzel-app/crumbs.git
cd crumbs

# Install dependencies (use Node.js 22, see .nvmrc)
pnpm install

# Start the dev server
pnpm dev
```

Open http://localhost:5173 and create the admin account on first visit.

Run `make help` to see all available commands.

## Project Structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design. Key directories:

- `src/routes/` — SvelteKit pages and API endpoints
- `src/lib/components/` — Svelte 5 components (runes, not stores)
- `src/lib/server/db/` — Drizzle ORM schema and database connection
- `src/lib/sync/` — Offline sync and CRDT logic
- `src/**/*.test.ts` — Vitest unit tests, next to the code they cover
- `tests/e2e/` — Playwright end-to-end tests

## Making Changes

1. **Fork and branch** — Create a feature branch from `main`
2. **Follow existing patterns** — Match the code style you see in the codebase
3. **Write tests** — Add unit tests for logic, E2E tests for user-facing features
4. **Run checks before pushing:**
   ```bash
   make check      # Type checking
   make lint        # Linting
   make test-unit   # Unit tests
   make test-e2e    # E2E tests
   ```
5. **Open a PR** — Target `main`, describe what and why

## Commit Messages

We use conventional-style commit messages:

```
feat: add tag autocomplete
fix: prevent duplicate notes on sync
docs: update deployment guide
chore: bump dependencies
```

Keep the subject line under 70 characters. Use the body for context when needed.

## Code Style

- **Svelte 5 runes** — Use `$state`, `$derived`, `$props`, `$effect` (not Svelte 4 stores)
- **TypeScript** — Strict mode, no `any` unless absolutely necessary
- **Tailwind CSS v4** — Use CSS variables from `src/app.css`, never hardcoded Tailwind colors
- **Design system** — Follow the Retro Parchment aesthetic described in `CLAUDE.md`

## Testing

- **Unit tests**: Pure logic (parsing, auth, sync). Run with `make test-unit`
- **E2E tests**: User workflows in the browser. Run with `make test-e2e`
- E2E tests use Gherkin-style Given/When/Then comments (see `CLAUDE.md` for conventions)

## Reporting Bugs

Use [GitHub Issues](https://github.com/bretzel-app/crumbs/issues) with the bug report template. Include:

- Steps to reproduce
- Expected vs actual behavior
- Browser/OS and Crumbs version

## Security Issues

**Do not open public issues for security vulnerabilities.** See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
