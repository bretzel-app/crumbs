# Accessibility audit — RGAA 4.1

**Date:** 2026-09-17 · **Build audited:** `main` at `7bf06ed` (before #91) · **Status:** findings open, fixes in progress on `feat/a11y-audit`

RGAA 4.1 (Référentiel général d'amélioration de l'accessibilité) is the French application of WCAG 2.1 level AA: 106 criteria in 13 topics. This document records what was tested, what failed, what passed, and what has not been tested. It is **not** a compliance declaration: roughly a third of RGAA can be verified by tooling and scripted checks, and the remainder needs a manual pass with assistive technology (see [Not tested](#not-tested)).

## Method

| Layer | Tool | What it covers |
|---|---|---|
| Automated rules | axe-core 4.13 via `@axe-core/playwright`, rule tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` | Contrast, names and roles, form labels, language, nesting, scroll regions, ARIA validity |
| Scripted checks | `tests/e2e/accessibility.spec.ts` | Page titles, landmarks, skip link, keyboard reach, visible focus, Escape handling, card action naming |
| Manual reading | Source review of the components the scans pointed at | Root causes and fix proposals |

Screens scanned, each in **light and dark** theme: notes grid seeded with all 12 note colours plus checklist, tagged and code notes; open editor; editor with colour picker; share dialog; editor on a checklist note; archive; trash; tag view; search results; settings (profile, preferences, MCP, users, about); login; public share page.

The spec doubles as the CI gate: every scan asserts zero violations and writes its raw axe output to `test-results/a11y/<screen>-<theme>.json`. Run it alone with:

```
pnpm playwright test accessibility.spec.ts
```

## Findings

Severity: **Blocking** = prevents a group of users from completing a core task · **Major** = criterion fails on most screens · **Minor** = localised failure.

Counts are raw axe node counts across all scans; the grid repeats every card, so one root cause shows up as hundreds of nodes.

### F1 · Icon buttons have no accessible name — Blocking

- **RGAA 11.9** (button label relevance), **RGAA 7.1** (script compatibility with assistive tech) · WCAG 4.1.2
- **Where:** card actions (pin, archive, trash, restore, delete) on every card; editor footer (colour picker, image, share, archive, overflow menu); new-checklist button. 574 nodes on 7 screens, both themes.
- **Evidence:** axe `button-name`: "Element does not have inner text that is visible to screen readers; aria-label attribute does not exist or is empty".
- **Root cause:** `src/lib/utils/tooltip.ts` was introduced as a drop-in replacement for the `title` attribute. It renders a visual tooltip but sets no `aria-label`, so every icon-only button that adopted it lost its name for screen readers.
- **Fix:** the tooltip action sets `aria-label` from its text when the element has no accessible name of its own. One change repairs every instance.

### F2 · Insufficient text contrast — Blocking (light theme), Minor (dark theme)

- **RGAA 3.2** (text contrast), **RGAA 3.3** (UI component contrast) · WCAG 1.4.3, 1.4.11
- **Where and how far off** (AA requires 4.5:1 for body text, 3:1 for large text and component boundaries):

| Element | Colours | Ratio | Screens |
|---|---|---|---|
| Brand title "Crumbs" (18px) | `#C8860A` on `#faf5eb` | 2.81 | all app screens, login |
| Active sidebar item | `#C8860A` on gold wash `#f3e4c9` | 2.43 | all app screens |
| Active settings tab | `#C8860A` on `#ead8b5` | 2.18 | all settings tabs |
| Links inside note previews | `#C8860A` on each note colour | 1.46 (peach) to 2.81 (default) | notes, archive, trash, search, editor |
| Note preview body text | muted `#6b6272` on coral / peach / storm / dusk / sage / fog | 3.25 / 2.77 / 3.44 / 3.38 / 3.93 / 4.45 | same |
| Primary buttons (login, save, invite, tag filter) | white on `#C8860A` | 3.05 | login, settings, tag |
| Primary buttons, dark theme | white on `#e0a030` | 2.27 | login, settings, tag |

- **What passes:** in dark mode every note colour passes for both `--text` (worst 9.3:1 on mint) and `--text-muted` (worst 4.9:1 on mint). The code-block palette added in #91 passes by construction (unit-tested). The only dark-theme failure is white text on gold buttons.
- **Root cause:** the brand gold `--primary` is used for text, not only for accents, and it is too light on parchment. `--text-muted` was tuned for `--bg-surface` and never checked against the coloured cards.
- **Fix (needs design sign-off, see below):**
  1. Add `--primary-text`, a darker gold for text and icons on light chrome (`#7d5306` is already in use as the code keyword colour; it reaches 6.2:1 on `--bg-surface`, 5.5:1 on `--bg-base`, 5.4:1 on the sidebar's active wash and 4.8:1 on the settings tab wash). Dark theme keeps `#e0a030`, which passes on every dark surface (worst 5.2:1 on mint). Brand title, sidebar and settings active states switch to it. `--primary` stays for borders, shadows, washes and the checkbox accent.
  2. Links inside note content use `--text` with an underline instead of gold. No gold passes on the coral, peach, sage, storm or dusk cards (`#7d5306` bottoms out at 3.2:1 on peach), and the underline keeps links identifiable without relying on colour (RGAA 3.1).
  3. Primary buttons use ink text (`--text`) on gold in both themes: 5.6:1 light, 7.5:1 dark.
  4. Note preview body text uses `--text` instead of `--text-muted`. It is the note's content, not secondary information, and `--text` passes on every card colour (worst 8.2:1 on peach).

### F3 · Note cards nest interactive controls and expose two tab stops per card — Blocking

- **RGAA 7.1**, **RGAA 12.8** (tab order), **RGAA 7.3** (keyboard operability) · WCAG 4.1.2, 2.1.1, 2.4.3
- **Where:** every card on notes, archive, trash, tag and search screens. 182 axe `nested-interactive` nodes.
- **Evidence:** the card is `<article role="button" tabindex="0">` and contains the action `<button>`s, which is invalid: a button cannot contain buttons, and screen readers flatten the card's content into the button's name ("A11y coral Body text on the coral card…"). On the main grid each card is additionally wrapped by a `svelte-dnd-action` item that has its own `tabindex="0"` and `role="listitem"`, with `outline-none`. Tabbing stops on that wrapper first, with no visible focus, and pressing **Enter** there starts keyboard drag mode instead of opening the note. The scripted "Enter opens the note" scenario failed for this reason.
- **Fix (needs sign-off):** make the card a plain `<article>` and make its title a `<button>` that opens the note. Mouse users keep click-anywhere via the article's click handler; keyboard and screen-reader users get one clean button with the note title as its name, followed by the named action buttons. Set the drag zone's `zoneItemTabIndex: -1` so the wrapper is no longer a tab stop; keyboard reordering was unusable anyway without a visible focus and is not required by RGAA 4.1.

### F4 · Focus is not visible — Major

- **RGAA 10.7** · WCAG 2.4.7
- **Where:** cards and drag wrappers use `outline-none` with no replacement; there is no `:focus-visible` style anywhere in `src/app.css`. Buttons and inputs keep the browser default ring, which is inconsistent with the design and disappears where `outline-none` is set (inputs rely on a 1px border colour change to gold, which itself fails contrast).
- **Fix:** a global `:focus-visible` rule in the retro idiom (2px hard outline in `--primary-text`, 2px offset, no blur), and removal of `outline-none` where nothing replaces it.

### F5 · Checklist checkboxes have no label — Major

- **RGAA 11.1** (each field has a label) · WCAG 1.3.1, 4.1.2
- **Where:** checklist item checkboxes in the editor (`checklist-checkbox`, `checklist-done-checkbox`) and the read-only checkboxes in card previews. 28 nodes.
- **Fix:** associate each checkbox with its item text (`aria-labelledby` pointing at the text span, or wrap both in a `<label>`). Preview checkboxes are decorative duplicates of the text and can be `aria-hidden` instead.

### F6 · The note content editor has no name — Major

- **RGAA 11.1** · WCAG 4.1.2
- **Where:** the TipTap `contenteditable` (`role="textbox"`) and the checklist item `contenteditable` inputs. 6 nodes.
- **Fix:** `aria-label="Note content"` on the ProseMirror root via `editorProps.attributes`; checklist inputs labelled by their position or "Checklist item".

### F7 · Role select on the users page has no label — Minor

- **RGAA 11.1** · WCAG 1.3.1, 4.1.2
- **Where:** `/settings/users`, the role `<select>` in the create-user form. 2 nodes.
- **Fix:** a visible `<label for>`.

### F8 · Scrollable code blocks cannot be reached by keyboard — Minor

- **RGAA 7.3** · WCAG 2.1.1
- **Where:** `<pre>` elements with `overflow-x: auto` in the editor and share page (12 nodes). After #91, card previews clip instead of scroll and drop out of this finding.
- **Fix:** `tabindex="0"` on rendered and editor code blocks so the region can be scrolled with arrow keys.

### F9 · Settings tabs share one page title — Minor

- **RGAA 8.5, 8.6** (page title present and relevant) · WCAG 2.4.2
- **Where:** profile, preferences, MCP, users and about all render `Settings - Crumbs`. Other routes are distinct (`Archive - Crumbs`, `Trash - Crumbs`, `#tag - Crumbs`).
- **Fix:** per-tab titles (`Profile settings - Crumbs`, …).

### F10 · No skip link — Minor

- **RGAA 12.7** (skip link to main content) · WCAG 2.4.1
- **Where:** the first Tab stop on every app page is the sidebar toggle; header and sidebar (up to a dozen stops) precede the content on every page. Landmarks exist (`header`, `nav`, `main`, `footer`), which satisfies **RGAA 12.6**, but RGAA 12.7 additionally requires a skip link when blocks repeat across pages.
- **Fix:** a visually hidden "Skip to content" link as the first focusable element, revealed on focus, targeting `main`.

## Passed

Verified by the scans or scripted checks, on every screen unless noted:

- **8.3 / 8.4** document language declared and valid.
- **8.5** every page has a title; **8.6** titles are relevant outside settings (F9).
- **9.2 / 12.6** header, navigation, main and footer landmarks present.
- **1.1** no image without a text alternative on the audited screens (thumbnails carry the attachment filename).
- **6.1** no link without a name.
- **3.2** in dark mode for all note colours, body and muted text; code-block palette in both themes.
- **11.1** on login, profile, preferences and MCP forms apart from F6 and F7.
- axe reported no ARIA misuse (`aria-*` validity and allowed roles) and no duplicate ids.

## Not tested

These need a person with assistive technology or a manual protocol. They are listed so nobody reads the passes above as a compliance claim.

- **Screen reader behaviour** (NVDA + Firefox, VoiceOver + Safari): announcement of toasts and sync status (**7.x**, WCAG 4.1.3 status messages), reading order of the editor, dialog focus trapping and restoration in the share dialog and image lightbox (**7.3**, **12.9**).
- **Setup page** (`/setup`): redirects once an account exists, so the scans cannot reach it. It shares components with the login page, which was scanned.
- **Information by colour alone** (**3.1**): note colours, tag chips, collaborator indicators.
- **Reflow and zoom** at 320px width and 200% (**10.11**, **10.4**), text spacing override (**10.12**), content on hover/focus (**10.13**) for the custom tooltip.
- **Forms**: error identification and correction guidance (**11.10**, **11.11**), autocomplete purposes (**11.13**).
- **Time limits and motion** (**13.1**, **13.8**): auto-save, session expiry, drag animations.
- **Alternative to drag and drop** for reordering: not required by RGAA 4.1 (WCAG 2.2 criterion), noted for the future.
- **Heading hierarchy relevance** (**9.1**) beyond the structural check.
- Mobile layouts and the installed PWA.

## Fix plan

Order reflects impact per change:

1. F1 tooltip `aria-label` (one file).
2. F2 colour tokens, F4 focus style (design sign-off first).
3. F3 card structure and drag wrapper tab index (sign-off first).
4. F5, F6, F7 labels; F8 `tabindex`; F9 titles; F10 skip link.
5. Re-run `accessibility.spec.ts` until green, then it stays in CI as the gate.
