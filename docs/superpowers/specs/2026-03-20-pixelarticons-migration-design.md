# Icon Migration: Lucide → Pixelarticons + "Pinned" → "Favorites" Rename

**Date:** 2026-03-20
**Status:** Approved

## Summary

Replace Lucide icons with pixelarticons (via `@iconify/svelte`) across the app to match the retro parchment aesthetic. Keep Lucide only for 4 text-formatting letterform icons (Bold, Italic, Strikethrough, Underline). Additionally, rename the user-facing "pinned" concept to "favorites" with a heart icon, while keeping the `pinned` database column unchanged.

## Motivation

The current Lucide icons have smooth, modern strokes that clash with the 8-bit retro parchment design system. Pixelarticons are drawn on a strict 24×24 pixel grid with no anti-aliasing — a natural fit for the `Press Start 2P` pixel font and hard-offset shadow aesthetic already in use.

## Technical Approach

### Icon Library

- **Package:** `@iconify/svelte` (v5.2.1, already installed) + `@iconify-json/pixelarticons` (v1.2.4, already installed)
- **Usage:** `<Icon icon="pixelarticons:icon-name" width={size} class="..." />`
- **Tree-shaking:** Iconify handles this automatically — only icons used in code are bundled

### Icon Mapping

56 icons migrated to pixelarticons, 4 kept as Lucide:

#### Navigation & UI
| Lucide | Pixelarticons |
|--------|--------------|
| Menu | `menu` |
| Search | `search` |
| X / XIcon | `close` |
| Plus | `plus` |
| Check | `check` |
| ArrowLeft | `arrow-left` |
| ChevronRight | `chevron-right` |
| ChevronDown | `chevron-down` |
| Settings | `settings-cog` |
| ExternalLink | `external-link` |

#### Notes & Content
| Lucide | Pixelarticons | Notes |
|--------|--------------|-------|
| StickyNote | `sticky-note` | |
| Archive | `archive` | |
| ArchiveRestore | `archive` | Context makes it clear |
| Trash2 | `trash` | |
| Bookmark | `heart` | Renamed to "favorite" |
| Clock | `clock` | |
| History | `timeline` | |
| FileText | `file-text` | |
| FileCode | `script` | |
| ImageIcon | `image` | |
| Palette | `colors-swatch` | |
| GripVertical | `drag-and-drop` | |
| Star | `pin` | Used in ImageUpload for "featured image" toggle — not related to favorites |
| SquareCheck | `checkbox-on` | |
| Type | `art-text` | |

#### Text Formatting (toolbar)
| Lucide | Pixelarticons | Notes |
|--------|--------------|-------|
| **Bold** | **Keep Lucide** | Letterform |
| **Italic** | **Keep Lucide** | Letterform |
| **Strikethrough** | **Keep Lucide** | Letterform |
| **Underline** | **Keep Lucide** | Letterform |
| Code | `braces` | |
| CodeXml | `braces` | |
| Heading | `heading` | |
| Link | `link` | |
| TextQuote | `quote-text-inline` | |
| List | `list` | |
| ListOrdered | `bulletlist` | |
| ListChecks | `checklist` | |
| AlignLeft | `text-align-left` | |
| AlignCenter | `text-align-center` | |
| AlignRight | `text-align-right` | |
| AlignJustify | `text-align-justify` | |
| Table2 | `table` | |
| Minus | `minus` | |
| RemoveFormatting | `remove-box` | |
| CornerDownLeft | `corner-down-left` | |
| BetweenHorizontalEnd | `add-row` | |
| BetweenVerticalEnd | `add-col` | |

#### Undo/Redo
| Lucide | Pixelarticons |
|--------|--------------|
| Undo2 | `undo` |
| Redo2 | `redo` |
| RotateCcw | `undo` |
| RefreshCw | `reload` |

#### Sync Status
| Lucide | Pixelarticons | Notes |
|--------|--------------|-------|
| CloudCheck | `cloud-done` | |
| CloudSync | `sync` | |
| CloudOff | `cloud` | Color conveys offline state |
| CloudAlert | `cloud` | Color conveys error state |

#### Users & Admin
| Lucide | Pixelarticons |
|--------|--------------|
| User | `user` |
| Users | `users` |
| UserPlus | `user-plus` |
| UserMinus | `user-minus` |
| Cpu | `cpu` |
| ShieldCheck | `shield` |
| SlidersHorizontal | `sliders` |
| Info | `info-box` |
| Key | `lock` |
| Copy | `copy` |
| Tag | `label` |

### "Pinned" → "Favorites" Rename

**Scope:** User-facing labels, function names, store names, MCP tool names, test IDs. The database column `pinned` stays unchanged to avoid a migration.

**Renames:**
| Current | New |
|---------|-----|
| `pinnedNotes` (store) | `favoriteNotes` |
| `unpinnedNotes` (store) | `unfavoritedNotes` |
| `togglePin()` | `toggleFavorite()` |
| `"Pinned"` label in NotesView | `"Favorites"` |
| `"Pin"` / `"Unpin"` tooltips in NoteCard | `"Favorite"` / `"Unfavorite"` |
| `pin_note` MCP tool | `favorite_note` |
| `pin-btn` / `pin-indicator` test IDs | `favorite-btn` / `favorite-indicator` |

**Not renamed (internal/DB):**
- `pinned` column in `notes` and `noteUserState` tables
- `pinned` field in TypeScript types (`Note`, `NoteUpdate`, `NoteChange`)
- `pinned` references in CRDT sync logic
- `pinned` in server-side sync overlay

## Files to Modify

### Icon migration (16 files)
1. `src/lib/components/Layout/Sidebar.svelte`
2. `src/lib/components/Layout/Header.svelte`
3. `src/lib/components/FormattingToolbar.svelte`
4. `src/lib/components/NoteCard.svelte`
5. `src/lib/components/NoteEditor.svelte`
6. `src/lib/components/NoteHistory.svelte`
7. `src/lib/components/SyncIndicator.svelte`
8. `src/lib/components/SearchBar.svelte`
9. `src/lib/components/ShareDialog.svelte`
10. `src/lib/components/Checklist.svelte`
11. `src/lib/components/CollaboratorPopover.svelte`
12. `src/lib/components/ImageLightbox.svelte`
13. `src/lib/components/ImageUpload.svelte`
14. `src/lib/components/NotesView.svelte`
15. `src/routes/(app)/settings/+layout.svelte`
16. `src/routes/(app)/settings/mcp/+page.svelte`

### Favorites rename (7 files)
1. `src/lib/stores/notes.ts` — store names + `toggleFavorite`
2. `src/lib/components/NoteCard.svelte` — tooltips, test IDs, icon
3. `src/lib/components/NotesView.svelte` — label, store imports
4. `src/lib/server/mcp/server.ts` — tool name + description
5. `docs/FEATURES.md` — update feature description
6. `tests/e2e/organization.spec.ts` — `pin-btn` test ID + `getByText('Pinned')` → `getByText('Favorites')` + scenario names/comments
7. Note: `tests/e2e/sharing.spec.ts` references `pinned` as a data field — does NOT need renaming (DB field stays `pinned`)

### Cleanup
- Remove `lucide-svelte` from `package.json` once only 4 icons remain — or keep it as a dependency for those 4. Decision: keep it, the 4 formatting icons are deeply integrated.

### Documentation
- Update `CLAUDE.md` "Icons" section to document pixelarticons usage
- Update `docs/FEATURES.md` if it mentions pinning

## Testing Strategy

- Run `pnpm check` after migration to catch type errors
- Run `pnpm test:unit` to verify sync/CRDT tests still pass (they use `pinned` field which is unchanged)
- Run `pnpm test:e2e` to verify UI still works — tests referencing `pin-btn`/`pin-indicator` will need updating
- Visual verification: icons render correctly at all sizes (12-20px)

## Rendering Note

Pixelarticons are designed for the 24×24 grid and render sharpest at multiples of 24px. At the sizes used in this app (12-20px), they will still look good because `@iconify/svelte` renders them as SVG (vector), but the pixel-art crispness is maximized at 24px. Consider using `image-rendering: pixelated` on icon SVGs if sub-24px rendering looks blurry, though SVG scaling typically handles this well.
