# Architecture

## Overview

Crumbs follows a **local-first** architecture where the client (browser) is the primary data store and the server acts as a sync target and backup.

```
┌─────────────────────────────┐
│         Browser (PWA)        │
│  ┌───────────┐ ┌──────────┐ │
│  │  Svelte   │ │ IndexedDB│ │
│  │  Stores   │◄│  (idb)   │ │
│  └─────┬─────┘ └────┬─────┘ │
│        │             │       │
│  ┌─────▼─────────────▼─────┐ │
│  │      Sync Engine        │ │
│  │  (LWW CRDT + Queue)    │ │
│  └──────────┬──────────────┘ │
└─────────────┼────────────────┘
              │ HTTP (JSON)
┌─────────────▼────────────────┐
│         Server (Node.js)      │
│  ┌──────────┐ ┌────────────┐ │
│  │ SvelteKit│ │   SQLite   │ │
│  │   API    │◄│ (Drizzle)  │ │
│  └──────────┘ └────────────┘ │
└──────────────────────────────┘
```

## Data Flow

### Read Path
1. User opens app
2. Svelte stores read from IndexedDB (instant)
3. Background sync pulls latest from server
4. If newer data found, IDB is updated, stores react

### Write Path
1. User creates/edits note
2. Change written to IndexedDB immediately
3. Change added to sync queue
4. Background sync pushes queue to server
5. Server applies changes with LWW resolution

### Conflict Resolution (LWW)
For a single-user app with multiple devices:
- Each note has an `updatedAt` timestamp and `version` number
- When merging: newer timestamp wins
- If timestamps match: higher version wins
- If both match: local version is preferred

### Attachment Data Flow
1. User drops/picks image in NoteEditor
2. Client optimizes: resize ≤1920px, compress to WebP, generate 200px thumbnail
3. **Online**: POST optimized + thumbnail to `/api/notes/{id}/attachments` → server saves to `data/attachments/` + DB
4. **Offline**: store blobs in IDB `pendingAttachments` store → display via `URL.createObjectURL()` → on reconnect, sync pushes to server
5. **Display**: NoteCard uses `&thumb=1` URL (200px WebP), editor shows full-size
6. **SW Caching**: `CacheFirst` rule caches attachment URLs — previously-viewed images available offline

## Tech Stack Rationale

### SvelteKit
- Smallest bundle size of major frameworks
- Built-in SSR, routing, API routes
- Svelte 5 runes for reactive state
- Native service worker support via @vite-pwa/sveltekit

### SQLite + Drizzle
- Zero-config database (single file)
- WAL mode for concurrent reads
- Drizzle provides type-safe queries without ORM overhead
- Perfect for single-user self-hosted apps

### IndexedDB (idb)
- Browser-native storage (no size limits like localStorage)
- Async API doesn't block main thread
- `idb` library provides Promise-based wrapper
- Survives browser restarts

### Tailwind CSS 4
- Utility-first, tree-shakeable
- Built-in dark mode support (`dark:` variants)
- New v4 uses Vite plugin (faster builds)

### Argon2
- Current best practice for password hashing
- Memory-hard (resists GPU attacks)
- Winner of the Password Hashing Competition

## Database Schema

See `src/lib/server/db/schema.ts` for the complete Drizzle schema.

Key tables:
- `users` - Single user (password hash)
- `sessions` - Auth sessions (30-day TTL)
- `notes` - Core note data with version tracking
- `tags` - Unique tag names
- `note_tags` - Many-to-many note ↔ tag
- `attachments` - Image file metadata (path + thumbnailPath)
- `sync_log` - Sync operation history

## File Organization

```
src/lib/server/    # Server-only code (DB, auth, attachments)
src/lib/sync/      # Sync engine (shared types, server + client implementations)
src/lib/stores/    # Svelte reactive stores (notes, theme, auth, search)
src/lib/components/ # Svelte UI components
src/lib/utils/     # Pure utility functions (markdown, tags, colors)
src/lib/types/     # TypeScript type definitions
src/routes/api/    # REST API endpoints
src/routes/        # Page routes (SvelteKit file-based routing)
```
