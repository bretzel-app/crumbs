# Checklist Hyperlink Support

**Issue:** bretzel-app/crumbs#59
**Date:** 2026-04-08

## Summary

Add automatic URL detection and clickable hyperlinks to checklist items across all views — the interactive checklist editor, NoteCard previews, done section, and shared note view. Matches Google Keep's behavior where links are recognized immediately as you type.

## URL Detection Utility

New functions in `src/lib/utils/checklist.ts`:

### `linkifyText(text: string): string`

Takes plain text, HTML-escapes it, then wraps detected URLs in `<a>` tags.

- Detects `https://`, `http://`, and bare `www.` prefixes
- Output links have `target="_blank"`, `rel="noopener"`, and `class="checklist-link"`
- HTML-escapes the input **before** wrapping URLs to prevent XSS
- Returns safe HTML string suitable for `{@html ...}`

### `unlinkifyHtml(html: string): string`

Extracts plain text from HTML content (strips all tags). Used to get raw text back from contenteditable divs for serialization to the checklist data model.

## Active Items — `contenteditable` Replacing `<input type="text">`

In `Checklist.svelte`, replace each `<input type="text">` (line 279-288) with a `<div contenteditable="true">` that renders item text with linkified HTML via `{@html linkifyText(item.text)}`.

### Editing behavior

- On `input` event: extract plain text via `unlinkifyHtml()`, update `item.text`, re-render with `linkifyText()`
- Save and restore cursor position after re-linkification to avoid cursor jumping
- On `paste`: intercept and insert `text/plain` only (strip any HTML from clipboard)
- Prevent default on Enter (existing behavior — creates new item)
- All existing keyboard shortcuts preserved: Enter, Backspace (delete empty), Tab (indent), Shift+Tab (outdent), ArrowUp/ArrowDown (navigate)

### Link click behavior

- Clicking an `<a>` tag inside contenteditable prevents default navigation
- Instead, shows a `LinkPopover` component positioned near the clicked link
- The popover has a single "Open" button that opens the URL in a new tab

## Link Popover Component

New component: `src/lib/components/LinkPopover.svelte`

### Props

- `url: string` — the href to open
- `anchor: DOMRect` — bounding rect of the clicked link element
- `onClose: () => void` — callback to dismiss

### Appearance

- Small floating element positioned below the anchor link (or above if near viewport bottom)
- Contains a single "Open" button with the Lucide `external-link` icon
- Styled with the retro parchment theme:
  - `bg-[var(--bg-surface)]`
  - `border border-[var(--border-subtle)]`
  - Hard-offset shadow: `var(--card-shadow)`
  - `rounded-sm`

### Dismissal

- Click outside the popover
- Escape key
- Scrolling the checklist

## Read-Only Contexts

### NoteCard Preview (`src/lib/components/NoteCard.svelte`)

Line 145: change `{item.text}` to `{@html linkifyText(item.text)}`.

Links open directly in a new tab on click (no popover — this is a read-only preview).

### Shared Note View (`src/routes/(share)/s/[token]/+page.svelte`)

Line 83: change `{item.text}` to `{@html linkifyText(item.text)}`.

Links open directly in a new tab on click (no popover).

### Done Section in `Checklist.svelte`

Line 339: change `{item.text}` to `{@html linkifyText(item.text)}`.

Links open directly in a new tab on click (no popover — done items aren't being edited).

## Link Styling

Add to `src/app.css`:

```css
.checklist-link {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.checklist-link:hover {
  color: var(--primary-hover);
}
```

## Files Changed

| File | Change |
|---|---|
| `src/lib/utils/checklist.ts` | Add `linkifyText()` and `unlinkifyHtml()` |
| `src/lib/components/Checklist.svelte` | `contenteditable` for active items, linkified done section, link popover integration |
| `src/lib/components/LinkPopover.svelte` | New component — "Open" button popover |
| `src/lib/components/NoteCard.svelte` | `{@html linkifyText(item.text)}` in checklist preview |
| `src/routes/(share)/s/[token]/+page.svelte` | `{@html linkifyText(item.text)}` in shared checklist |
| `src/app.css` | `.checklist-link` styles |

## Testing

### Unit tests

- `linkifyText` — detects http/https/www URLs, escapes HTML entities, handles multiple URLs in one string, handles edge cases (URL at start/end, adjacent punctuation)
- `unlinkifyHtml` — strips tags, preserves text content

### E2E tests

- Type a URL in a checklist item, verify it becomes a clickable link
- Click a link, verify the popover appears with "Open" button
- Verify link popover dismisses on click-outside and Escape
- Verify links are clickable in NoteCard preview
- Verify links are clickable in done section
