# Pixelarticons Migration + Favorites Rename — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Lucide icons with pixelarticons via @iconify/svelte across the app (except 4 formatting letterforms), and rename user-facing "pinned" to "favorites" with a heart icon.

**Architecture:** Each component file gets its Lucide imports replaced with a single `Icon` import from `@iconify/svelte`. The `size` prop becomes `width`, and the icon name becomes a `pixelarticons:name` string. The 4 formatting letterforms (Bold, Italic, Strikethrough, Underline) stay as Lucide. The favorites rename touches stores, components, MCP server, and one e2e test.

**Tech Stack:** `@iconify/svelte` v5.2.1, `@iconify-json/pixelarticons` v1.2.4 (both already installed), `lucide-svelte` (kept for 4 icons)

**Spec:** `docs/superpowers/specs/2026-03-20-pixelarticons-migration-design.md`

---

## File Structure

No new files created. All changes are modifications to existing files:

**Icon migration (16 files):** Replace Lucide imports with `@iconify/svelte` Icon component.
**Favorites rename (4 source files + 1 test file):** Rename stores, functions, labels, test IDs.

---

### Task 1: Favorites Rename — Stores

**Files:**
- Modify: `src/lib/stores/notes.ts:38-44,234-236`

- [ ] **Step 1: Rename store exports and function**

In `src/lib/stores/notes.ts`, make these changes:

```typescript
// Line 38-44: Rename stores
export const favoriteNotes = derived(filteredNotes, ($notes) =>
	sortNotes($notes.filter((n) => n.pinned))
);

export const unfavoritedNotes = derived(filteredNotes, ($notes) =>
	sortNotes($notes.filter((n) => !n.pinned))
);

// Line 234-236: Rename function
export async function toggleFavorite(id: string, currentPinned: boolean): Promise<Note | null> {
	return updateNote(id, { pinned: !currentPinned });
}
```

Note: The `pinned` field in updateNote stays — it's the DB column name.

- [ ] **Step 2: Verify no type errors**

Run: `pnpm check 2>&1 | head -30`
Expected: Errors in files that still reference old names (NoteCard, NotesView) — that's expected, we fix those next.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/notes.ts
git commit -m "refactor: rename pinned stores to favorites"
```

---

### Task 2: Favorites Rename — NoteCard Component

**Files:**
- Modify: `src/lib/components/NoteCard.svelte:4,110-118,170-178`

- [ ] **Step 1: Update import**

Change line 4:
```typescript
import { toggleFavorite, trashNote, archiveNote, unarchiveNote, restoreNote, deleteNote, leaveNote, currentFilter } from '$lib/stores/notes.js';
```

- [ ] **Step 2: Update favorite indicator (lines 110-118)**

Replace the pinned indicator block:
```svelte
{#if note.pinned}
	<button
		onclick={stop(() => toggleFavorite(note.id, note.pinned))}
		class="rounded-sm p-1 text-[var(--primary)] hover:bg-[var(--border)]/10"
		title="Unfavorite"
		data-testid="favorite-indicator"
	>
		<Bookmark class="h-4 w-4 fill-[var(--primary)]" />
	</button>
{/if}
```

- [ ] **Step 3: Update favorite button (lines 170-178)**

Replace the pin button block:
```svelte
{#if !note.pinned}
	<button
		onclick={stop(() => toggleFavorite(note.id, note.pinned))}
		class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
		title="Favorite"
		data-testid="favorite-btn"
	>
		<Bookmark class="h-4 w-4" />
	</button>
{/if}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/NoteCard.svelte
git commit -m "refactor: rename pin to favorite in NoteCard"
```

---

### Task 3: Favorites Rename — NotesView Component

**Files:**
- Modify: `src/lib/components/NotesView.svelte:5,89-104`

- [ ] **Step 1: Update imports (line 5)**

```typescript
import { favoriteNotes, unfavoritedNotes, selectedTag, currentFilter, notes, notesLoaded, loadNotes, updateSortOrders } from '$lib/stores/notes.js';
```

- [ ] **Step 2: Update template references**

Replace all `$pinnedNotes` with `$favoriteNotes`, `$unpinnedNotes` with `$unfavoritedNotes`, and label `"Pinned"` with `"Favorites"`:

Line 89: `{#if $favoriteNotes.length > 0}`
Line 91: `<NoteGrid notes={$favoriteNotes} label="Favorites" onEdit={openEditor} draggable dndType="pinned-notes" onReorder={handleReorder} />`
Line 96: `notes={$unfavoritedNotes}`
Line 97: `label={$favoriteNotes.length > 0 ? 'Others' : ''}`
Line 104: `{#if $notesLoaded && $favoriteNotes.length === 0 && $unfavoritedNotes.length === 0}`

Note: Keep `dndType="pinned-notes"` unchanged — it's an internal DnD identifier, not user-facing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/NotesView.svelte
git commit -m "refactor: rename pinned to favorites in NotesView"
```

---

### Task 4: Favorites Rename — MCP Server

**Files:**
- Modify: `src/lib/server/mcp/server.ts:241-265`

- [ ] **Step 1: Rename MCP tool**

Replace the `pin_note` tool definition (lines 241-265):
```typescript
server.tool(
	'favorite_note',
	'Favorite or unfavorite a note',
	{
		id: z.string().describe('Note ID'),
		pinned: z.boolean().describe('Whether to favorite (true) or unfavorite (false)')
	},
	async ({ id, pinned }: { id: string; pinned: boolean }) => {
		const result = updateNote(db, userId, id, { pinned });
		if (!result) {
			return {
				content: [{ type: 'text' as const, text: 'Note not found' }],
				isError: true
			};
		}
		return {
			content: [
				{
					type: 'text' as const,
					text: `Note "${result.title}" ${pinned ? 'favorited' : 'unfavorited'}`
				}
			]
		};
	}
);
```

Note: The `pinned` parameter name stays since it maps to the DB column.

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/mcp/server.ts
git commit -m "refactor: rename pin_note MCP tool to favorite_note"
```

---

### Task 5: Favorites Rename — E2E Test

**Files:**
- Modify: `tests/e2e/organization.spec.ts:4-15`

- [ ] **Step 1: Update test scenario**

Replace lines 4-15:
```typescript
test('Scenario: Favorited note appears under the Favorites section', async ({ authenticatedPage: page }) => {
	// Given a note titled "Favorite Me" exists
	await createNote(page, 'Favorite Me');

	// When the user favorites the note
	const favCard = noteCard(page, 'Favorite Me');
	await favCard.hover();
	await favCard.getByTestId('favorite-btn').first().click({ force: true });

	// Then the "Favorites" section is visible
	await expect(page.getByText('Favorites')).toBeVisible();
});
```

- [ ] **Step 2: Run check to verify favorites rename is complete**

Run: `pnpm check 2>&1 | head -20`
Expected: PASS (no errors related to old pin names)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/organization.spec.ts
git commit -m "test: update pin test to favorites"
```

---

### Task 6: Icon Migration — Header + SearchBar

**Files:**
- Modify: `src/lib/components/Layout/Header.svelte:2-5`
- Modify: `src/lib/components/SearchBar.svelte:4-6`

- [ ] **Step 1: Migrate Header.svelte**

Replace imports (lines 2-5):
```typescript
import SearchBar from '../SearchBar.svelte';
import SyncIndicator from '../SyncIndicator.svelte';
import Icon from '@iconify/svelte';
```

Replace icon usage in template:
- `<Menu class="h-6 w-6 text-[var(--text)]" />` → `<Icon icon="pixelarticons:menu" class="h-6 w-6 text-[var(--text)]" />`
- `<Search class="h-5 w-5 text-[var(--text)]" />` → `<Icon icon="pixelarticons:search" class="h-5 w-5 text-[var(--text)]" />`

- [ ] **Step 2: Migrate SearchBar.svelte**

Replace imports (lines 4-6):
```typescript
import Icon from '@iconify/svelte';
```

Replace icon usage:
- `<Search .../>` → `<Icon icon="pixelarticons:search" .../>`
- `<X .../>` → `<Icon icon="pixelarticons:close" .../>`
- `<ArrowLeft .../>` → `<Icon icon="pixelarticons:arrow-left" .../>`

Match existing `class` attributes exactly — just change the component and add the `icon` prop.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/Layout/Header.svelte src/lib/components/SearchBar.svelte
git commit -m "feat: migrate Header and SearchBar to pixelarticons"
```

---

### Task 7: Icon Migration — Sidebar

**Files:**
- Modify: `src/lib/components/Layout/Sidebar.svelte:2-4,19-23,47,65,81`

- [ ] **Step 1: Replace imports and nav items**

Replace the import (line 4):
```typescript
import Icon from '@iconify/svelte';
```

Replace navItems array (lines 19-23):
```typescript
const navItems = [
	{ href: '/', label: 'Crumbs', icon: 'pixelarticons:sticky-note', match: (p: string) => p === '/' },
	{ href: '/archive', label: 'Archive', icon: 'pixelarticons:archive', match: (p: string) => p === '/archive' },
	{ href: '/trash', label: 'Trash', icon: 'pixelarticons:trash', match: (p: string) => p === '/trash' }
];
```

- [ ] **Step 2: Update template icon usage**

Line 47: `<item.icon size={20} />` → `<Icon icon={item.icon} width={20} />`
Line 65: `<Tag size={16} />` → `<Icon icon="pixelarticons:label" width={16} />`
Line 81: `<Settings size={20} />` → `<Icon icon="pixelarticons:settings-cog" width={20} />`

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/Layout/Sidebar.svelte
git commit -m "feat: migrate Sidebar to pixelarticons"
```

---

### Task 8: Icon Migration — NoteCard

**Files:**
- Modify: `src/lib/components/NoteCard.svelte:5-13,117,159,167,177,187,196,206,215`

- [ ] **Step 1: Replace imports**

Replace lines 5-13:
```typescript
import Icon from '@iconify/svelte';
```

Remove all individual Lucide imports (Undo2, Trash2, Bookmark, Archive, ArchiveRestore, UserMinus).

- [ ] **Step 2: Replace all icon usages in template**

- `<Bookmark class="h-4 w-4 fill-[var(--primary)]" />` (favorite indicator) → `<Icon icon="pixelarticons:heart" class="h-4 w-4 fill-[var(--primary)]" />`
- `<Bookmark class="h-4 w-4" />` (favorite button) → `<Icon icon="pixelarticons:heart" class="h-4 w-4" />`
- `<Undo2 class="h-4 w-4" />` (restore) → `<Icon icon="pixelarticons:undo" class="h-4 w-4" />`
- `<Trash2 class="h-4 w-4 text-[var(--destructive)]" />` → `<Icon icon="pixelarticons:trash" class="h-4 w-4 text-[var(--destructive)]" />`
- `<Trash2 class="h-4 w-4" />` → `<Icon icon="pixelarticons:trash" class="h-4 w-4" />`
- `<Archive class="h-4 w-4" />` → `<Icon icon="pixelarticons:archive" class="h-4 w-4" />`
- `<ArchiveRestore class="h-4 w-4" />` → `<Icon icon="pixelarticons:archive" class="h-4 w-4" />`
- `<UserMinus class="h-4 w-4" />` → `<Icon icon="pixelarticons:user-minus" class="h-4 w-4" />`

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/NoteCard.svelte
git commit -m "feat: migrate NoteCard to pixelarticons"
```

---

### Task 9: Icon Migration — NoteEditor

**Files:**
- Modify: `src/lib/components/NoteEditor.svelte:16-24`

- [ ] **Step 1: Replace imports**

Replace lines 16-24:
```typescript
import Icon from '@iconify/svelte';
```

- [ ] **Step 2: Replace all icon usages**

Search the file for each Lucide component and replace:
- `<Palette .../>` → `<Icon icon="pixelarticons:colors-swatch" .../>`
- `<SquareCheck .../>` → `<Icon icon="pixelarticons:checkbox-on" .../>`
- `<ImageIcon .../>` → `<Icon icon="pixelarticons:image" .../>`
- `<Type .../>` → `<Icon icon="pixelarticons:art-text" .../>`
- `<FileCode .../>` → `<Icon icon="pixelarticons:script" .../>`
- `<FileText .../>` → `<Icon icon="pixelarticons:file-text" .../>`
- `<UserPlus .../>` → `<Icon icon="pixelarticons:user-plus" .../>`
- `<Users .../>` → `<Icon icon="pixelarticons:users" .../>`
- `<History .../>` → `<Icon icon="pixelarticons:timeline" .../>`

For each, keep the existing `size` prop but rename to `width`. Keep `class` as-is.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/NoteEditor.svelte
git commit -m "feat: migrate NoteEditor to pixelarticons"
```

---

### Task 10: Icon Migration — FormattingToolbar

This is the largest file. Bold, Italic, Strikethrough, Underline stay as Lucide. Everything else migrates.

**Files:**
- Modify: `src/lib/components/FormattingToolbar.svelte:2-31,131-482`

- [ ] **Step 1: Replace imports**

Replace the import block (lines 3-31):
```typescript
import {
	Bold,
	Italic,
	Strikethrough,
	Underline
} from 'lucide-svelte';
import Icon from '@iconify/svelte';
```

- [ ] **Step 2: Replace icon usages in template**

Replace every non-B/I/S/U icon. The pattern: `<IconName size={iconSize} />` → `<Icon icon="pixelarticons:name" width={iconSize} />`. Full mapping:

- `<Undo2 size={iconSize} />` → `<Icon icon="pixelarticons:undo" width={iconSize} />`
- `<Redo2 size={iconSize} />` → `<Icon icon="pixelarticons:redo" width={iconSize} />`
- `<Heading size={iconSize} />` → `<Icon icon="pixelarticons:heading" width={iconSize} />`
- `<List size={iconSize} />` (appears 3x) → `<Icon icon="pixelarticons:list" width={iconSize} />`
- `<ListOrdered size={iconSize} />` → `<Icon icon="pixelarticons:bulletlist" width={iconSize} />`
- `<ListChecks size={iconSize} />` → `<Icon icon="pixelarticons:checklist" width={iconSize} />`
- `<Link size={iconSize} />` → `<Icon icon="pixelarticons:link" width={iconSize} />`
- `<CornerDownLeft size={16} />` → `<Icon icon="pixelarticons:corner-down-left" width={16} />`
- `<ExternalLink size={16} />` → `<Icon icon="pixelarticons:external-link" width={16} />`
- `<Trash2 size={16} />` → `<Icon icon="pixelarticons:trash" width={16} />`
- `<Table2 size={iconSize} />` (appears 2x) → `<Icon icon="pixelarticons:table" width={iconSize} />`
- `<ChevronDown size={chevronSize} />` (appears 4x) → `<Icon icon="pixelarticons:chevron-down" width={chevronSize} />`
- `<BetweenHorizontalEnd size={iconSize} />` → `<Icon icon="pixelarticons:add-row" width={iconSize} />`
- `<BetweenVerticalEnd size={iconSize} />` → `<Icon icon="pixelarticons:add-col" width={iconSize} />`
- `<Minus size={iconSize} />` (appears 3x) → `<Icon icon="pixelarticons:minus" width={iconSize} />`
- `<RemoveFormatting size={iconSize} />` → `<Icon icon="pixelarticons:remove-box" width={iconSize} />`
- `<Code size={iconSize} />` → `<Icon icon="pixelarticons:braces" width={iconSize} />`
- `<TextQuote size={iconSize} />` → `<Icon icon="pixelarticons:quote-text-inline" width={iconSize} />`
- `<CodeXml size={iconSize} />` → `<Icon icon="pixelarticons:braces" width={iconSize} />`
- `<AlignLeft size={iconSize} />` (2x) → `<Icon icon="pixelarticons:text-align-left" width={iconSize} />`
- `<AlignCenter size={iconSize} />` (2x) → `<Icon icon="pixelarticons:text-align-center" width={iconSize} />`
- `<AlignRight size={iconSize} />` (2x) → `<Icon icon="pixelarticons:text-align-right" width={iconSize} />`
- `<AlignJustify size={iconSize} />` (2x) → `<Icon icon="pixelarticons:text-align-justify" width={iconSize} />`

Leave these unchanged: `<Bold size={iconSize} />`, `<Italic size={iconSize} />`, `<Strikethrough size={iconSize} />`, `<Underline size={iconSize} />`

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/FormattingToolbar.svelte
git commit -m "feat: migrate FormattingToolbar to pixelarticons (keep B/I/S/U as Lucide)"
```

---

### Task 11: Icon Migration — SyncIndicator

**Files:**
- Modify: `src/lib/components/SyncIndicator.svelte:4-7,54-61`

- [ ] **Step 1: Replace imports**

Replace lines 4-7:
```typescript
import Icon from '@iconify/svelte';
```

- [ ] **Step 2: Replace icon usages**

Replace the status icon block (lines 53-61):
```svelte
{#if displayStatus === 'synced'}
	<Icon icon="pixelarticons:cloud-done" class="h-5 w-5 text-[var(--primary)]" />
{:else if displayStatus === 'syncing'}
	<Icon icon="pixelarticons:sync" class="h-5 w-5 text-[var(--primary)] opacity-60" />
{:else if displayStatus === 'offline'}
	<Icon icon="pixelarticons:cloud" class="h-5 w-5 text-[var(--text-muted)]" />
{:else}
	<Icon icon="pixelarticons:cloud" class="h-5 w-5 text-[var(--destructive)]" />
{/if}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/SyncIndicator.svelte
git commit -m "feat: migrate SyncIndicator to pixelarticons"
```

---

### Task 12: Icon Migration — Remaining Small Components

**Files:**
- Modify: `src/lib/components/NoteHistory.svelte:3-5`
- Modify: `src/lib/components/ShareDialog.svelte:3-5`
- Modify: `src/lib/components/Checklist.svelte:2-5`
- Modify: `src/lib/components/CollaboratorPopover.svelte:3`
- Modify: `src/lib/components/ImageLightbox.svelte:2`
- Modify: `src/lib/components/ImageUpload.svelte:2-4`
- Modify: `src/lib/components/NotesView.svelte:8`

- [ ] **Step 1: Migrate NoteHistory.svelte**

Replace imports:
```typescript
import Icon from '@iconify/svelte';
```
Replace usages:
- `<X .../>` → `<Icon icon="pixelarticons:close" .../>`
- `<RotateCcw .../>` → `<Icon icon="pixelarticons:undo" .../>`
- `<Clock .../>` → `<Icon icon="pixelarticons:clock" .../>`

- [ ] **Step 2: Migrate ShareDialog.svelte**

Replace imports:
```typescript
import Icon from '@iconify/svelte';
```
Replace usages:
- `<X .../>` → `<Icon icon="pixelarticons:close" .../>`
- `<UserMinus .../>` → `<Icon icon="pixelarticons:user-minus" .../>`
- `<Search .../>` → `<Icon icon="pixelarticons:search" .../>`

- [ ] **Step 3: Migrate Checklist.svelte**

Replace imports:
```typescript
import Icon from '@iconify/svelte';
```
Replace usages:
- `<XIcon .../>` → `<Icon icon="pixelarticons:close" .../>`
- `<Plus .../>` → `<Icon icon="pixelarticons:plus" .../>`
- `<GripVertical .../>` → `<Icon icon="pixelarticons:drag-and-drop" .../>`
- `<ChevronRight .../>` → `<Icon icon="pixelarticons:chevron-right" .../>`

- [ ] **Step 4: Migrate CollaboratorPopover.svelte**

Replace import:
```typescript
import Icon from '@iconify/svelte';
```
Replace: `<Users .../>` → `<Icon icon="pixelarticons:users" .../>`

- [ ] **Step 5: Migrate ImageLightbox.svelte**

Replace import:
```typescript
import Icon from '@iconify/svelte';
```
Replace: `<XIcon .../>` → `<Icon icon="pixelarticons:close" .../>`

- [ ] **Step 6: Migrate ImageUpload.svelte**

Replace imports:
```typescript
import Icon from '@iconify/svelte';
```
Replace usages:
- `<XIcon .../>` → `<Icon icon="pixelarticons:close" .../>`
- `<Star .../>` → `<Icon icon="pixelarticons:pin" .../>`
- `<RefreshCw .../>` → `<Icon icon="pixelarticons:reload" .../>`

- [ ] **Step 7: Migrate NotesView.svelte (Plus icon)**

Replace import (line 8):
```typescript
import Icon from '@iconify/svelte';
```
Replace usages:
- `<Plus class="h-4 w-4" />` → `<Icon icon="pixelarticons:plus" class="h-4 w-4" />`
- `<Plus class="h-5 w-5" />` → `<Icon icon="pixelarticons:plus" class="h-5 w-5" />`

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/NoteHistory.svelte src/lib/components/ShareDialog.svelte src/lib/components/Checklist.svelte src/lib/components/CollaboratorPopover.svelte src/lib/components/ImageLightbox.svelte src/lib/components/ImageUpload.svelte src/lib/components/NotesView.svelte
git commit -m "feat: migrate remaining components to pixelarticons"
```

---

### Task 13: Icon Migration — Settings Pages

**Files:**
- Modify: `src/routes/(app)/settings/+layout.svelte:3`
- Modify: `src/routes/(app)/settings/mcp/+page.svelte:2`

- [ ] **Step 1: Migrate settings layout**

Replace import (line 3):
```typescript
import Icon from '@iconify/svelte';
```

Replace usages:
- `<SlidersHorizontal size={16} />` → `<Icon icon="pixelarticons:sliders" width={16} />`
- `<User size={16} />` → `<Icon icon="pixelarticons:user" width={16} />`
- `<Cpu size={16} />` → `<Icon icon="pixelarticons:cpu" width={16} />`
- `<ShieldCheck size={16} />` → `<Icon icon="pixelarticons:shield" width={16} />`
- `<Info size={16} />` → `<Icon icon="pixelarticons:info-box" width={16} />`

- [ ] **Step 2: Migrate MCP settings page**

Replace import (line 2):
```typescript
import Icon from '@iconify/svelte';
```

Replace usages:
- `<Key .../>` → `<Icon icon="pixelarticons:lock" .../>`
- `<Copy .../>` → `<Icon icon="pixelarticons:copy" .../>`
- `<Trash2 .../>` → `<Icon icon="pixelarticons:trash" .../>`
- `<Plus .../>` → `<Icon icon="pixelarticons:plus" .../>`
- `<Check .../>` → `<Icon icon="pixelarticons:check" .../>`

- [ ] **Step 3: Commit**

```bash
git add src/routes/(app)/settings/+layout.svelte src/routes/(app)/settings/mcp/+page.svelte
git commit -m "feat: migrate settings pages to pixelarticons"
```

---

### Task 14: Update docs/FEATURES.md

**Files:**
- Modify: `docs/FEATURES.md:67-70,141`

- [ ] **Step 1: Rename "Pin Notes" section to "Favorite Notes"**

Replace lines 67-70:
```markdown
### Favorite Notes
- Favorite important notes to always appear at top
- Favorites section separated from other notes
- Toggle favorite from note card hover actions
```

- [ ] **Step 2: Update MCP tools description**

Line 141: replace `pin` with `favorite` in the tools list:
```markdown
- 14 tools: list, get, create, update, trash, restore, archive, unarchive, delete, search notes; list tags; favorite, reorder notes; upload images
```

- [ ] **Step 3: Commit**

```bash
git add docs/FEATURES.md
git commit -m "docs: rename pin to favorites in FEATURES.md"
```

---

### Task 15: Verification

- [ ] **Step 1: Run type check**

Run: `pnpm check`
Expected: PASS with no errors

- [ ] **Step 2: Run unit tests**

Run: `pnpm test:unit`
Expected: All tests pass (DB/CRDT tests use `pinned` field which is unchanged)

- [ ] **Step 3: Run e2e tests**

Run: `pnpm test:e2e`
Expected: All tests pass including the updated organization spec

- [ ] **Step 4: Update CLAUDE.md icons section**

Add to the "Visual rules" section in CLAUDE.md after the "Icons" line:

```markdown
- **Icons**: Pixelarticons via `@iconify/svelte` — use `<Icon icon="pixelarticons:name" width={size} class="..." />`. Exception: Bold, Italic, Strikethrough, Underline stay as Lucide (`lucide-svelte`). See full mapping in `docs/superpowers/specs/2026-03-20-pixelarticons-migration-design.md`.
```

- [ ] **Step 5: Commit docs update**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with pixelarticons icon usage"
```
