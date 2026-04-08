# Public Note Sharing — Design Spec

**Issue**: [#7 — Public links and shared notes](https://github.com/bretzel-app/crumbs/issues/7)
**Date**: 2026-03-20

## Overview

Allow sharing individual notes via a public URL that anyone can view without authentication. Read-only sharing via unguessable tokens. Integrates into the existing ShareDialog alongside collaborator management.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Share UI location | Inside existing ShareDialog | One "Share" entry point for all sharing (public + collaborators) |
| Expiry | Deferred to future version | Simpler v1; active/revoked toggle only |
| Rate limiting | In-memory per-IP | Lightweight, resets on restart; token entropy handles enumeration |
| Architecture | Separated shares-service | Follows collaborators-service pattern; clean module boundary |
| Sharing icon | Globe (public) or Users (collaborators) | Single icon slot; tooltip shows combined sharing state |

## Schema

New `sharedNotes` table in `src/lib/server/db/schema.ts`:

```typescript
export const sharedNotes = sqliteTable('shared_notes', {
  noteId: text('note_id').primaryKey().references(() => notes.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // NULL = no expiry, reserved for future use
});
```

- `noteId` as primary key — one share per note, no separate `id` needed
- `integer` timestamps with `mode: 'timestamp'` — matches all other tables in the schema
- `createdAt` set in service layer (`new Date()`), not via SQL default
- CASCADE delete — deleting the note removes the share
- Token: `nanoid(21)` — ~128 bits of entropy
- No update to `deleteUser()` needed — shares cascade through notes (foreign keys enabled via `PRAGMA foreign_keys = ON` in db connection)

## Types

Add to `src/lib/types/index.ts`:

```typescript
export interface NoteShare {
  noteId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date | null;
}
```

Extend the `Note` interface:

```typescript
export interface Note {
  // ...existing fields
  shareToken?: string; // populated during hydration if a public share exists
}
```

## Service Layer

New file: `src/lib/server/shares-service.ts`

| Function | Params | Returns | Description |
|---|---|---|---|
| `createShare` | `db, noteId, userId` | `{ token }` | Verify ownership, generate nanoid(21), insert row, return token. If share already exists, return existing token. |
| `revokeShare` | `db, noteId, userId` | `void` | Verify ownership, delete share row |
| `getShareByNoteId` | `db, noteId` | `NoteShare \| null` | Return share if exists (for ShareDialog) |
| `getSharedNote` | `db, token` | `SharedNoteData \| null` | Public — fetch note by token, return null if trashed or not found |
| `fetchSharesForNotes` | `db, noteIds` | `Map<string, string>` | Batch fetch — returns Map of noteId → token for hydration (only token needed for NoteCard indicator) |

`SharedNoteData` type (returned to public viewers):

```typescript
interface SharedNoteData {
  title: string;
  content: string;
  checklistMode: boolean;
  color: NoteColor;
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
}
```

## API Endpoints

### `POST /api/notes/[id]/share`

- **Auth**: Required (owner only)
- **Body**: None
- **Response**: `{ token: string, url: string }`
- **Behavior**: Creates share or returns existing one. URL constructed from request origin + `/s/${token}`

### `DELETE /api/notes/[id]/share`

- **Auth**: Required (owner only)
- **Response**: `204 No Content`
- **Behavior**: Deletes share row. Link immediately returns 404.

### `GET /api/shared/[token]`

- **Auth**: None (public)
- **Rate limit**: 60 requests/min per IP (in-memory)
- **Response**: `SharedNoteData` JSON
- **Error cases**:
  - Invalid/unknown token → 404
  - Note is trashed → 404
  - Rate limited → 429

### `GET /api/shared/[token]/attachment/[attachmentId]`

- **Auth**: None (public)
- **Rate limit**: Same as above
- **Response**: Image binary (proxied from attachment storage)
- **Behavior**: Verify attachment belongs to the shared note, then serve

## Routes

```
src/routes/
  (share)/
    +layout.svelte       # Minimal layout: parchment bg, centered, no app chrome
    s/[token]/
      +page.server.ts    # Load shared note by token via shares-service
      +page.svelte       # Read-only note renderer
```

### Auth Middleware

Add `/s/` and `/api/shared` to `PUBLIC_PATHS` in `src/hooks.server.ts`. Both are needed — `/s/` for the public page route, `/api/shared` for the public API endpoints.

### Public Page Design

- Parchment background (`--bg-base`)
- Centered content card (`--bg-surface`, `--border-subtle`, `--card-shadow`)
- Note title in JetBrains Mono
- Rendered markdown content or checklist (read-only)
- Inline images from attachments
- No tags, no edit controls, no sidebar, no navigation
- Footer: "POWERED BY CRUMBS" in Press Start 2P pixel font, links to project

## UI Components

### ShareDialog Changes

Add a "Public link" section **above** the existing collaborators section:

**Inactive state:**
- Globe icon + "Public link" label + toggle switch (off)
- Subtitle: "Anyone with the link can view this note (read-only)"

**Active state:**
- Globe icon + "Public link" label + toggle switch (on, gold)
- URL input (readonly) + "Copy" button
- Subtitle: "Toggle off to revoke access. The link will return a 404."
- Border highlight in `--primary` gold

Toggle on → calls `POST /api/notes/[id]/share`, displays URL
Toggle off → calls `DELETE /api/notes/[id]/share`, hides URL
Copy button → clipboard API, brief "Copied!" feedback

### NoteCard Share Indicator

Single icon slot in top-right of NoteCard (replaces showing both icons):

| State | Icon | Color |
|---|---|---|
| Public link active | `Globe` (Lucide) | `--primary` gold |
| Collaborators only | `Users` (Lucide) | `--text-muted` |
| Both | `Globe` (Lucide) | `--primary` gold |
| Neither | No icon | — |

**Hover tooltip** shows combined sharing info regardless of which icon is displayed:
- "Shared publicly via link" (if public share exists)
- "Shared with N collaborator(s)" (if collaborators exist)
- Both lines if both exist

### NoteEditor Share Button

Existing Share button behavior unchanged. The Globe/Users icon logic from NoteCard also applies to the editor toolbar button to indicate current sharing state.

## Rate Limiting

New file: `src/lib/server/ip-rate-limit.ts` — separate from the existing DB-backed `rate-limit.ts` (which is login-specific).

```typescript
// In-memory store: Map<IP, { count: number, windowStart: number }>
// 60 requests per minute per IP
// Applied to GET /api/shared/[token] and GET /api/shared/[token]/attachment/[id]
```

Resets on server restart. No database table needed.

## Hydration

`hydrateNotes()` in `notes-service.ts` must be updated to call `fetchSharesForNotes()` and populate `shareToken` on each note. This follows the existing pattern where `hydrateNotes` already batch-fetches tags, attachments, and collaborators.

## Security

- Tokens are unguessable: nanoid(21) = ~128 bits of entropy
- `/s/` and `/api/shared` routes bypass auth middleware — only these prefixes
- Trashed notes return 404 even if share token is valid
- Only note owners can create/revoke shares — collaborators cannot
- No user information exposed on public page (no username, no email, no tags)
- Rate limiting prevents brute-force enumeration
- Attachments served through share-specific route (validates attachment belongs to shared note)

## Out of Scope (v1)

- Expiry dates / auto-expire
- Password-protected shares
- Edit access through share links
- Share analytics / view counts
- Email notifications for share events
- E2EE interaction (no E2EE exists)

## Acceptance Criteria

- [ ] Share toggle in ShareDialog creates/revokes public link
- [ ] Unique nanoid(21) token generated per shared note
- [ ] Public `/s/[token]` route renders note without auth
- [ ] Copy link to clipboard with feedback
- [ ] Revoke share → link returns 404
- [ ] Globe indicator on NoteCard for publicly shared notes
- [ ] Combined tooltip showing all sharing state
- [ ] Trashed notes return 404 even if shared
- [ ] Minimal, parchment-styled public page with "Powered by Crumbs"
- [ ] In-memory rate limiting on public endpoints
- [ ] Attachments accessible on public page
