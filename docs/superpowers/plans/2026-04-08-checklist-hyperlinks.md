# Checklist Hyperlinks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect URLs in checklist items and render them as clickable hyperlinks across all views (editor, done section, card preview, shared view), with a link popover in the editor matching Google Keep's UX.

**Architecture:** A `linkifyText()` utility HTML-escapes text then wraps detected URLs in `<a>` tags. Active checklist items switch from `<input type="text">` to `contenteditable` divs to render inline links. A `LinkPopover` component appears on link click in the editor. Read-only views (done section, NoteCard, shared view) use `{@html linkifyText()}` with direct click-to-open.

**Tech Stack:** Svelte 5, TypeScript, Vitest, Playwright, Lucide icons

**Spec:** `docs/superpowers/specs/2026-04-08-checklist-hyperlinks-design.md`

---

### Task 1: `linkifyText` and `unlinkifyHtml` utilities

**Files:**
- Modify: `src/lib/utils/checklist.ts` (append new functions after line 153)
- Test: `src/lib/utils/checklist.test.ts` (append new describe blocks)

- [ ] **Step 1: Write failing tests for `linkifyText`**

Add to `src/lib/utils/checklist.test.ts`:

```typescript
import { linkifyText, unlinkifyHtml } from '$lib/utils/checklist.js';

describe('linkifyText', () => {
	it('converts https URLs to anchor tags', () => {
		expect(linkifyText('visit https://example.com today')).toBe(
			'visit <a href="https://example.com" target="_blank" rel="noopener" class="checklist-link">https://example.com</a> today'
		);
	});

	it('converts http URLs to anchor tags', () => {
		expect(linkifyText('go to http://example.com')).toBe(
			'go to <a href="http://example.com" target="_blank" rel="noopener" class="checklist-link">http://example.com</a>'
		);
	});

	it('converts bare www URLs with https href', () => {
		expect(linkifyText('check www.example.com')).toBe(
			'check <a href="https://www.example.com" target="_blank" rel="noopener" class="checklist-link">www.example.com</a>'
		);
	});

	it('handles multiple URLs in one string', () => {
		const result = linkifyText('see https://a.com and https://b.com');
		expect(result).toContain('href="https://a.com"');
		expect(result).toContain('href="https://b.com"');
	});

	it('returns plain text unchanged when no URLs present', () => {
		expect(linkifyText('just some text')).toBe('just some text');
	});

	it('HTML-escapes user content to prevent XSS', () => {
		expect(linkifyText('<script>alert("xss")</script>')).toBe(
			'&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
		);
	});

	it('HTML-escapes text around URLs', () => {
		expect(linkifyText('<b>bold</b> https://example.com')).toContain('&lt;b&gt;bold&lt;/b&gt;');
		expect(linkifyText('<b>bold</b> https://example.com')).toContain('href="https://example.com"');
	});

	it('handles URL at start of string', () => {
		expect(linkifyText('https://example.com is great')).toContain('href="https://example.com"');
	});

	it('handles URL at end of string', () => {
		expect(linkifyText('visit https://example.com')).toContain('href="https://example.com"');
	});

	it('does not linkify partial matches without protocol or www', () => {
		expect(linkifyText('example.com is not linked')).toBe('example.com is not linked');
	});

	it('handles URLs with paths and query strings', () => {
		const url = 'https://example.com/path?q=1&b=2';
		const result = linkifyText(url);
		expect(result).toContain('href="https://example.com/path?q=1&amp;b=2"');
	});

	it('strips trailing punctuation from URLs', () => {
		expect(linkifyText('see https://example.com.')).toBe(
			'see <a href="https://example.com" target="_blank" rel="noopener" class="checklist-link">https://example.com</a>.'
		);
	});

	it('returns empty string for empty input', () => {
		expect(linkifyText('')).toBe('');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/utils/checklist.test.ts`
Expected: FAIL — `linkifyText` is not exported from checklist.ts

- [ ] **Step 3: Implement `linkifyText`**

Add to `src/lib/utils/checklist.ts` after the `serializeChecklist` function:

```typescript
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)'"}\]]/g;

export function linkifyText(text: string): string {
	if (!text) return '';

	const matches: { index: number; match: string; href: string }[] = [];
	let m: RegExpExecArray | null;
	const regex = new RegExp(URL_REGEX.source, 'g');

	while ((m = regex.exec(text)) !== null) {
		const match = m[0];
		const href = match.startsWith('www.') ? `https://${match}` : match;
		matches.push({ index: m.index, match, href });
	}

	if (matches.length === 0) return escapeHtml(text);

	let result = '';
	let lastIndex = 0;
	for (const { index, match, href } of matches) {
		result += escapeHtml(text.slice(lastIndex, index));
		result += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="checklist-link">${escapeHtml(match)}</a>`;
		lastIndex = index + match.length;
	}
	result += escapeHtml(text.slice(lastIndex));
	return result;
}
```

- [ ] **Step 4: Run `linkifyText` tests to verify they pass**

Run: `pnpm vitest run src/lib/utils/checklist.test.ts`
Expected: All `linkifyText` tests PASS

- [ ] **Step 5: Write failing tests for `unlinkifyHtml`**

Add to `src/lib/utils/checklist.test.ts`:

```typescript
describe('unlinkifyHtml', () => {
	it('strips anchor tags and returns text content', () => {
		expect(unlinkifyHtml('visit <a href="https://example.com">https://example.com</a> today'))
			.toBe('visit https://example.com today');
	});

	it('returns plain text unchanged', () => {
		expect(unlinkifyHtml('just text')).toBe('just text');
	});

	it('handles multiple anchor tags', () => {
		expect(unlinkifyHtml('<a href="https://a.com">https://a.com</a> and <a href="https://b.com">https://b.com</a>'))
			.toBe('https://a.com and https://b.com');
	});

	it('returns empty string for empty input', () => {
		expect(unlinkifyHtml('')).toBe('');
	});

	it('handles div and br tags from contenteditable', () => {
		expect(unlinkifyHtml('line1<br>line2')).toBe('line1line2');
	});
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/utils/checklist.test.ts`
Expected: FAIL — `unlinkifyHtml` is not exported

- [ ] **Step 7: Implement `unlinkifyHtml`**

Add to `src/lib/utils/checklist.ts` after `linkifyText`:

```typescript
export function unlinkifyHtml(html: string): string {
	if (!html) return '';
	return html.replace(/<[^>]*>/g, '');
}
```

- [ ] **Step 8: Run all tests to verify they pass**

Run: `pnpm vitest run src/lib/utils/checklist.test.ts`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/utils/checklist.ts src/lib/utils/checklist.test.ts
git commit -m "feat: add linkifyText and unlinkifyHtml utilities for checklist hyperlinks"
```

---

### Task 2: CSS styles for checklist links

**Files:**
- Modify: `src/app.css` (add after line 207, before the tooltip section)

- [ ] **Step 1: Add checklist-link styles**

Add to `src/app.css` after the `.prose ul.task-list li p { margin: 0; }` block (line 207) and before the `/* Custom tooltips */` comment (line 209):

```css
/* Checklist link styles */
.checklist-link {
	color: var(--primary);
	text-decoration: underline;
	text-underline-offset: 2px;
}

.checklist-link:hover {
	color: var(--primary-hover);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app.css
git commit -m "style: add checklist-link CSS for hyperlink display"
```

---

### Task 3: LinkPopover component

**Files:**
- Create: `src/lib/components/LinkPopover.svelte`

- [ ] **Step 1: Create the LinkPopover component**

Create `src/lib/components/LinkPopover.svelte`:

```svelte
<script lang="ts">
	import ExternalLink from 'lucide-svelte/icons/external-link';
	import { onMount } from 'svelte';

	interface Props {
		url: string;
		anchor: DOMRect;
		onClose: () => void;
	}

	let { url, anchor, onClose }: Props = $props();

	let popoverEl: HTMLDivElement | undefined = $state();
	let top = $state(0);
	let left = $state(0);

	onMount(() => {
		if (!popoverEl) return;
		const rect = popoverEl.getBoundingClientRect();

		// Position below the anchor link, or above if near viewport bottom
		const spaceBelow = window.innerHeight - anchor.bottom;
		if (spaceBelow >= rect.height + 8) {
			top = anchor.bottom + 4;
		} else {
			top = anchor.top - rect.height - 4;
		}

		left = anchor.left;
		// Clamp to viewport
		if (left + rect.width > window.innerWidth - 8) {
			left = window.innerWidth - rect.width - 8;
		}
		if (left < 8) left = 8;
	});

	function handleClickOutside(e: MouseEvent) {
		if (popoverEl && !popoverEl.contains(e.target as Node)) {
			onClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	function openLink() {
		window.open(url, '_blank', 'noopener');
		onClose();
	}
</script>

<svelte:window onclick={handleClickOutside} onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={popoverEl}
	class="fixed z-50 flex items-center gap-1.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 shadow-[var(--card-shadow)]"
	style="top: {top}px; left: {left}px;"
	onclick={(e) => e.stopPropagation()}
	data-testid="link-popover"
>
	<button
		onclick={openLink}
		class="flex items-center gap-1 text-xs text-[var(--primary)] hover:text-[var(--primary-hover)]"
		data-testid="link-popover-open"
	>
		<ExternalLink class="h-3.5 w-3.5" />
		Open
	</button>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/LinkPopover.svelte
git commit -m "feat: add LinkPopover component for checklist hyperlinks"
```

---

### Task 4: Convert active checklist items to `contenteditable`

**Files:**
- Modify: `src/lib/components/Checklist.svelte`

This is the main change. Replace the `<input type="text">` with a `contenteditable` div and integrate the link popover.

- [ ] **Step 1: Add imports and link popover state**

In `src/lib/components/Checklist.svelte`, update the import line for checklist utilities (line 9) to include the new functions:

```typescript
import { type ChecklistItem, generateId, parseChecklist, serializeChecklist, toggleItemWithCascade, indentItem, outdentItem, linkifyText, unlinkifyHtml } from '$lib/utils/checklist.js';
```

Add the LinkPopover import after the existing component imports (after line 8):

```typescript
import LinkPopover from './LinkPopover.svelte';
```

Add link popover state after the `flipDurationMs` declaration (after line 21):

```typescript
let linkPopover = $state<{ url: string; anchor: DOMRect } | null>(null);
```

- [ ] **Step 2: Update `updateText` to accept contenteditable HTML**

The existing `updateText` function (line 88) accepts a plain text string from `<input>`. For contenteditable, the input event gives us innerHTML. Update `updateText` to extract plain text:

Replace the `updateText` function (lines 88-94):

```typescript
function updateText(id: string, innerHTML: string) {
	const item = items.find((i) => i.id === id);
	if (item) {
		item.text = unlinkifyHtml(innerHTML);
		emitChange();
	}
}
```

- [ ] **Step 3: Update `handleKeydown` for contenteditable behavior**

The Backspace check (line 132) currently checks `items[index].text === ''`. This still works because `updateText` now extracts plain text on every input event. However, `handleKeydown` also references `data-testid="checklist-input"` when querying for arrow key navigation (lines 136, 140). These selectors need to work with `[contenteditable]` divs instead of `<input>` elements.

Replace the `handleKeydown` function (lines 127-156):

```typescript
function handleKeydown(e: KeyboardEvent, id: string) {
	const index = items.findIndex((i) => i.id === id);
	if (e.key === 'Enter') {
		e.preventDefault();
		addItem(index);
	} else if (e.key === 'Backspace' && items[index].text === '' && items.length > 1) {
		e.preventDefault();
		removeItem(id);
		setTimeout(() => {
			const inputs = document.querySelectorAll<HTMLElement>('[data-testid="checklist-input"]');
			inputs[Math.max(0, index - 1)]?.focus();
		}, 0);
	} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
		const inputs = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="checklist-input"]'));
		const current = inputs.findIndex((el) => el.dataset.itemId === id);
		const target = e.key === 'ArrowUp' ? current - 1 : current + 1;
		if (target >= 0 && target < inputs.length) {
			e.preventDefault();
			inputs[target].focus();
		}
	} else if (e.key === 'Tab' && !e.shiftKey) {
		e.preventDefault();
		items = indentItem(id, items, activeItems);
		emitChange();
	} else if (e.key === 'Tab' && e.shiftKey) {
		e.preventDefault();
		items = outdentItem(id, items);
		emitChange();
	}
}
```

(The only changes: `HTMLInputElement` -> `HTMLElement` in the querySelectorAll calls, and `dataset.itemId` for the arrow key lookup.)

- [ ] **Step 4: Add link click handler and paste handler**

Add after the `handleKeydown` function (before the directional lock drag handle section):

```typescript
function handleLinkClick(e: MouseEvent) {
	const target = e.target as HTMLElement;
	const anchor = target.closest('a');
	if (anchor) {
		e.preventDefault();
		e.stopPropagation();
		linkPopover = { url: anchor.href, anchor: anchor.getBoundingClientRect() };
	}
}

function handlePaste(e: ClipboardEvent) {
	e.preventDefault();
	const text = e.clipboardData?.getData('text/plain') ?? '';
	const selection = window.getSelection();
	if (!selection?.rangeCount) return;
	const range = selection.getRangeAt(0);
	range.deleteContents();
	range.insertNode(document.createTextNode(text));
	range.collapse(false);
	selection.removeAllRanges();
	selection.addRange(range);
	(e.target as HTMLElement).dispatchEvent(new Event('input', { bubbles: true }));
}
```

- [ ] **Step 5: Update `addItem` focus to work with contenteditable**

Update the `addItem` function's focus logic (lines 108-110). Change `HTMLInputElement` to `HTMLElement`:

```typescript
setTimeout(() => {
	document.querySelector<HTMLElement>(`[data-item-id="${newId}"]`)?.focus();
}, 0);
```

- [ ] **Step 6: Replace `<input type="text">` with `contenteditable` div in the template**

Replace the `<input type="text" ...>` block (lines 279-288) with:

```svelte
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	contenteditable="true"
	oninput={(e) => updateText(item.id, (e.target as HTMLElement).innerHTML)}
	onkeydown={(e) => handleKeydown(e, item.id)}
	onclick={handleLinkClick}
	onpaste={handlePaste}
	class="flex-1 min-w-0 bg-transparent text-sm outline-none break-words {item.checked ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text)]'}"
	data-placeholder="List item"
	data-testid="checklist-input"
	data-item-id={item.id}
	role="textbox"
>{@html linkifyText(item.text)}</div>
```

Note: The `{@html ...}` must be on the same line as the opening `>` to avoid extra whitespace in contenteditable.

- [ ] **Step 7: Add empty-state placeholder CSS**

Add to `src/app.css` after the `.checklist-link:hover` rule:

```css
[data-placeholder]:empty::before {
	content: attr(data-placeholder);
	color: var(--text-muted);
	pointer-events: none;
}
```

- [ ] **Step 8: Add LinkPopover to the template**

Add at the end of the component template, just before the closing `</div>` (before line 355):

```svelte
{#if linkPopover}
	<LinkPopover url={linkPopover.url} anchor={linkPopover.anchor} onClose={() => (linkPopover = null)} />
{/if}
```

- [ ] **Step 9: Run type check**

Run: `pnpm check`
Expected: No type errors

- [ ] **Step 10: Commit**

```bash
git add src/lib/components/Checklist.svelte src/lib/components/LinkPopover.svelte src/app.css
git commit -m "feat: replace checklist text inputs with contenteditable for inline link rendering"
```

---

### Task 5: Linkify the done section in Checklist.svelte

**Files:**
- Modify: `src/lib/components/Checklist.svelte`

- [ ] **Step 1: Linkify done item text**

In `Checklist.svelte`, find the done item text span (line 339):

```svelte
<span class="flex-1 text-sm text-[var(--text-muted)] line-through">{item.text}</span>
```

Replace with:

```svelte
<span class="flex-1 text-sm text-[var(--text-muted)] line-through break-words min-w-0">{@html linkifyText(item.text)}</span>
```

- [ ] **Step 2: Linkify done parent label text**

Find the parent label span (line 327):

```svelte
<span class="text-sm text-[var(--text-muted)]">{group.parentLabel.text}</span>
```

Replace with:

```svelte
<span class="text-sm text-[var(--text-muted)] break-words min-w-0">{@html linkifyText(group.parentLabel.text)}</span>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/Checklist.svelte
git commit -m "feat: linkify URLs in checklist done section"
```

---

### Task 6: Linkify NoteCard checklist preview

**Files:**
- Modify: `src/lib/components/NoteCard.svelte`

- [ ] **Step 1: Add import**

Add `linkifyText` import to NoteCard.svelte. After the existing imports (e.g., after line 15):

```typescript
import { linkifyText } from '$lib/utils/checklist.js';
```

- [ ] **Step 2: Linkify checklist item text**

Find the checklist item text span (line 145):

```svelte
<span class="break-words min-w-0">{item.text}</span>
```

Replace with:

```svelte
<span class="break-words min-w-0">{@html linkifyText(item.text)}</span>
```

- [ ] **Step 3: Prevent link clicks from opening the note editor**

Links inside the NoteCard should open the URL instead of triggering `onEdit`. The card's `onclick` handler (line 73) currently opens the editor. Links need `e.stopPropagation()`.

Add a click handler on the checklist `<ul>` (line 134) to intercept link clicks:

Replace:
```svelte
<ul class="space-y-2 mb-6" data-testid="note-checklist-preview">
```

With:
```svelte
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<ul class="space-y-2 mb-6" data-testid="note-checklist-preview"
	onclick={(e) => { if ((e.target as HTMLElement).closest('a')) e.stopPropagation(); }}>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/NoteCard.svelte
git commit -m "feat: linkify URLs in NoteCard checklist preview"
```

---

### Task 7: Linkify shared note checklist view

**Files:**
- Modify: `src/routes/(share)/s/[token]/+page.svelte`

- [ ] **Step 1: Add import**

Add `linkifyText` import. After the existing imports (after line 4):

```typescript
import { linkifyText } from '$lib/utils/checklist.js';
```

- [ ] **Step 2: Linkify checklist item text**

Find the checklist item text span (line 83):

```svelte
<span class="break-words min-w-0">{item.text}</span>
```

Replace with:

```svelte
<span class="break-words min-w-0">{@html linkifyText(item.text)}</span>
```

- [ ] **Step 3: Commit**

```bash
git add "src/routes/(share)/s/[token]/+page.svelte"
git commit -m "feat: linkify URLs in shared note checklist view"
```

---

### Task 8: Update existing e2e tests for contenteditable

**Files:**
- Modify: `tests/e2e/checklist.spec.ts`

The existing tests use `.fill()` and `.toHaveValue()` on checklist inputs, which work with `<input>` but not `contenteditable`. These need to be updated.

- [ ] **Step 1: Update the `createChecklistNote` helper**

Replace the `createChecklistNote` function (lines 11-23):

```typescript
async function createChecklistNote(page: Page, title: string, items: string[]) {
	await page.getByTestId('new-note-btn').click();
	await page.getByTestId('note-title-input').fill(title);
	await toggleChecklistMode(page);
	for (let i = 0; i < items.length; i++) {
		await page.getByTestId('checklist-input').nth(i).focus();
		await page.keyboard.type(items[i]);
		if (i < items.length - 1) {
			await page.getByTestId('checklist-input').nth(i).press('Enter');
		}
	}
	await page.getByTestId('close-editor-btn').click();
	await expect(noteCard(page, title)).toBeVisible();
}
```

Key change: `.fill()` replaced with `.focus()` + `page.keyboard.type()` (contenteditable doesn't support `.fill()`).

- [ ] **Step 2: Update all `.fill()` calls on checklist inputs throughout the file**

Every `page.getByTestId('checklist-input')...fill('Text')` must change to:

```typescript
await page.getByTestId('checklist-input')...focus();
await page.keyboard.type('Text');
```

Affected tests and the specific changes:

**"Enter key adds a new checklist item" (line 98):**
```typescript
// Before:
await page.getByTestId('checklist-input').first().fill('First item');
// After:
await page.getByTestId('checklist-input').first().focus();
await page.keyboard.type('First item');
```

**"Backspace on empty item removes it" (line 137):**
```typescript
// Before:
await page.getByTestId('checklist-input').first().fill('First item');
// After:
await page.getByTestId('checklist-input').first().focus();
await page.keyboard.type('First item');
```

**"Completed items are separated into a done section" (lines 153-155):**
```typescript
// Before:
await page.getByTestId('checklist-input').first().fill('Done task');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).fill('Pending task');
// After:
await page.getByTestId('checklist-input').first().focus();
await page.keyboard.type('Done task');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).focus();
await page.keyboard.type('Pending task');
```

**"Arrow keys navigate between checklist items" (lines 174-178):**
```typescript
// Before:
await page.getByTestId('checklist-input').first().fill('First');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).fill('Second');
await page.getByTestId('checklist-input').nth(1).press('Enter');
await page.getByTestId('checklist-input').nth(2).fill('Third');
// After:
await page.getByTestId('checklist-input').first().focus();
await page.keyboard.type('First');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).focus();
await page.keyboard.type('Second');
await page.getByTestId('checklist-input').nth(1).press('Enter');
await page.getByTestId('checklist-input').nth(2).focus();
await page.keyboard.type('Third');
```

**"Tab indents / Shift+Tab outdents" (lines 197-199):**
```typescript
// Before:
await page.getByTestId('checklist-input').first().fill('Parent');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).fill('Child');
// After:
await page.getByTestId('checklist-input').first().focus();
await page.keyboard.type('Parent');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).focus();
await page.keyboard.type('Child');
```

**"Checking a parent checks all its children" (lines 218-223):**
```typescript
// Before:
await page.getByTestId('checklist-input').first().fill('Buy groceries');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).fill('Milk');
await page.getByTestId('checklist-input').nth(1).press('Tab');
await page.getByTestId('checklist-input').nth(1).press('Enter');
await page.getByTestId('checklist-input').nth(2).fill('Eggs');
// After:
await page.getByTestId('checklist-input').first().focus();
await page.keyboard.type('Buy groceries');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).focus();
await page.keyboard.type('Milk');
await page.getByTestId('checklist-input').nth(1).press('Tab');
await page.getByTestId('checklist-input').nth(1).press('Enter');
await page.getByTestId('checklist-input').nth(2).focus();
await page.keyboard.type('Eggs');
```

**"Checking a child shows read-only parent label" (lines 237-240):**
```typescript
// Before:
await page.getByTestId('checklist-input').first().fill('Groceries');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).fill('Milk');
// After:
await page.getByTestId('checklist-input').first().focus();
await page.keyboard.type('Groceries');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).focus();
await page.keyboard.type('Milk');
```

**"Unchecking a parent from done restores group" (lines 255-258):**
```typescript
// Before:
await page.getByTestId('checklist-input').first().fill('Shopping');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).fill('Milk');
// After:
await page.getByTestId('checklist-input').first().focus();
await page.keyboard.type('Shopping');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).focus();
await page.keyboard.type('Milk');
```

**"Enter on a child creates a sibling" (lines 291-294):**
```typescript
// Before:
await page.getByTestId('checklist-input').first().fill('Parent');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).fill('Child 1');
// After:
await page.getByTestId('checklist-input').first().focus();
await page.keyboard.type('Parent');
await page.getByTestId('checklist-input').first().press('Enter');
await page.getByTestId('checklist-input').nth(1).focus();
await page.keyboard.type('Child 1');
```

- [ ] **Step 3: Update all `.toHaveValue()` assertions on checklist inputs**

Replace `.toHaveValue('text')` with `.toHaveText('text')`:

**"Checklist item persists" (line 49):**
```typescript
// Before:
await expect(page.getByTestId('checklist-input').first()).toHaveValue('Buy milk');
// After:
await expect(page.getByTestId('checklist-input').first()).toHaveText('Buy milk');
```

**"Sequential check and uncheck" (line 91):**
```typescript
// Before:
await expect(page.getByTestId('checklist-input').first()).toHaveValue('Buy milk');
// After:
await expect(page.getByTestId('checklist-input').first()).toHaveText('Buy milk');
```

**"Enter key focuses new item" (line 130):**
```typescript
// Before:
await expect(page.getByTestId('checklist-input').nth(1)).toHaveValue('');
// After:
await expect(page.getByTestId('checklist-input').nth(1)).toHaveText('');
```

**"Completed items separated" (line 162):**
```typescript
// Before:
await expect(page.getByTestId('checklist-input').first()).toHaveValue('Pending task');
// After:
await expect(page.getByTestId('checklist-input').first()).toHaveText('Pending task');
```

**"Delete checked items" (line 344):**
```typescript
// Before:
await expect(page.getByTestId('checklist-input').first()).toHaveValue('Keep me');
// After:
await expect(page.getByTestId('checklist-input').first()).toHaveText('Keep me');
```

- [ ] **Step 4: Run all checklist e2e tests**

Run: `pnpm test:e2e --grep "Checklist"`
Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/checklist.spec.ts
git commit -m "test: update e2e tests for contenteditable checklist inputs"
```

---

### Task 9: E2E tests for checklist hyperlinks

**Files:**
- Modify: `tests/e2e/checklist.spec.ts`

- [ ] **Step 1: Write e2e tests for hyperlink behavior**

Add to `tests/e2e/checklist.spec.ts` inside the existing `test.describe('Checklist', ...)` block, after the last test:

```typescript
test('Scenario: URL typed in a checklist item becomes a clickable link', async ({ authenticatedPage: page }) => {
	// Given a new checklist note
	await page.getByTestId('new-note-btn').click();
	await toggleChecklistMode(page);

	// When the user types a URL
	await page.getByTestId('checklist-input').first().focus();
	await page.keyboard.type('check https://example.com today');

	// Then the URL is rendered as a link
	const link = page.getByTestId('checklist-input').first().locator('a');
	await expect(link).toBeVisible();
	await expect(link).toHaveAttribute('href', 'https://example.com');
});

test('Scenario: Clicking a link in a checklist item shows the link popover', async ({ authenticatedPage: page }) => {
	// Given a checklist item with a URL
	await page.getByTestId('new-note-btn').click();
	await toggleChecklistMode(page);
	await page.getByTestId('checklist-input').first().focus();
	await page.keyboard.type('https://example.com');

	// When the user clicks the link
	await page.getByTestId('checklist-input').first().locator('a').click();

	// Then the link popover appears with an Open button
	await expect(page.getByTestId('link-popover')).toBeVisible();
	await expect(page.getByTestId('link-popover-open')).toBeVisible();
});

test('Scenario: Link popover dismisses on Escape', async ({ authenticatedPage: page }) => {
	// Given a link popover is open
	await page.getByTestId('new-note-btn').click();
	await toggleChecklistMode(page);
	await page.getByTestId('checklist-input').first().focus();
	await page.keyboard.type('https://example.com');
	await page.getByTestId('checklist-input').first().locator('a').click();
	await expect(page.getByTestId('link-popover')).toBeVisible();

	// When the user presses Escape
	await page.keyboard.press('Escape');

	// Then the popover is dismissed
	await expect(page.getByTestId('link-popover')).not.toBeVisible();
});

test('Scenario: Links in done section are clickable', async ({ authenticatedPage: page }) => {
	// Given a checklist item with a URL is checked
	await page.getByTestId('new-note-btn').click();
	await toggleChecklistMode(page);
	await page.getByTestId('checklist-input').first().focus();
	await page.keyboard.type('https://example.com');
	await page.getByTestId('checklist-checkbox').first().click();

	// Then the done section shows the URL as a link
	await expect(page.getByTestId('checklist-done-section').locator('a.checklist-link')).toBeVisible();
});

test('Scenario: Links in NoteCard preview are rendered', async ({ authenticatedPage: page }) => {
	// Given a checklist note with a URL
	await page.getByTestId('new-note-btn').click();
	await page.getByTestId('note-title-input').fill('Link Note');
	await toggleChecklistMode(page);
	await page.getByTestId('checklist-input').first().focus();
	await page.keyboard.type('visit https://example.com');
	await page.getByTestId('close-editor-btn').click();

	// Then the NoteCard preview shows the URL as a link
	const card = noteCard(page, 'Link Note');
	await expect(card.locator('a.checklist-link')).toBeVisible();
	await expect(card.locator('a.checklist-link')).toHaveAttribute('href', 'https://example.com');
});
```

- [ ] **Step 2: Run e2e tests**

Run: `pnpm test:e2e --grep "Checklist"`
Expected: All checklist tests PASS (both existing and new)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/checklist.spec.ts
git commit -m "test: add e2e tests for checklist hyperlink support"
```

---

### Task 10: Full verification

- [ ] **Step 1: Run unit tests**

Run: `pnpm vitest run`
Expected: All unit tests PASS

- [ ] **Step 2: Run type check**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 3: Run full e2e test suite**

Run: `pnpm test:e2e`
Expected: All tests PASS

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: No lint errors
