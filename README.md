[![CI](https://github.com/bretzel-app/crumbs/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/bretzel-app/crumbs/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/release/bretzel-app/crumbs)](https://github.com/bretzel-app/crumbs/releases)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-blue.svg)](https://github.com/bretzel-app/crumbs/pkgs/container/crumbs)

<p align="center">
  <img src="static/favicon-96x96.png" alt="Crumbs logo" width="96" height="96">
</p>

# Crumbs by Bretzel

A self-hostable, offline-first note-taking app inspired by Google Keep. Part of the [Bretzel](https://bretzel.app) app universe.

## Quick Start

### Docker (Recommended)

```bash
docker compose up -d
```

Open http://localhost:3000 and set your password on first visit.

### Development

```bash
pnpm install
pnpm dev
```

Run `make help` to see all available commands, or use pnpm directly:

```bash
pnpm test          # Unit + E2E tests
pnpm check         # Type checking
pnpm build         # Production build
```

## Features

- Rich notes with Markdown, checklists, image attachments, and 12 color themes
- Organize with #tags, pinning, archive, and trash
- Full-text search across titles, content, and tags
- PWA — installable, works offline via IndexedDB + LWW CRDT sync
- MCP server — let AI assistants (Claude Code, etc.) manage your notes
- Single-user password auth (Argon2) + API keys for MCP access
- Docker deployment with a single command

See [docs/FEATURES.md](docs/FEATURES.md) for detailed feature documentation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit 2 (Svelte 5 runes) |
| Language | TypeScript (strict) |
| UI | Tailwind CSS 4 |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Client DB | IndexedDB (idb) |
| Sync | LWW CRDTs |
| Auth | Argon2 + session cookies |
| Testing | Vitest + Playwright |
| Container | Docker (multi-stage) |
| CI/CD | GitHub Actions |

## Documentation

| Document | Description |
|----------|-------------|
| [Features](docs/FEATURES.md) | Detailed feature list and behavior |
| [Architecture](docs/ARCHITECTURE.md) | Local-first sync design, tech rationale, DB schema |
| [Deployment](docs/DEPLOYMENT.md) | Docker, Node.js, reverse proxy, backups, env vars |
| [API](docs/API.md) | REST API reference (auto-generated) |
| [Contributing](CONTRIBUTING.md) | How to contribute |
| [Security](SECURITY.md) | Vulnerability reporting policy |
| [Changelog](CHANGELOG.md) | Release history |

## CI/CD

- **CI** — lint, type check, unit tests, E2E tests, Docker build on every push/PR
- **Release** — builds and pushes Docker image on `v*` tags

Configure registry via GitHub Secrets: `REGISTRY_URL`, `REGISTRY_USER`, `REGISTRY_TOKEN`.

## License

[MIT](LICENSE)
