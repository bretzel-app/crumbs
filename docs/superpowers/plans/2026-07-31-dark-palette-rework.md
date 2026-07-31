# Dark Theme Palette Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark theme's palette with a systematically generated one, and decouple the colour-picker swatch from the note card surface so the twelve colours are distinguishable.

**Architecture:** Purely a colour-data and CSS-variable change. `NOTE_COLORS_DARK` in `src/lib/utils/colors.ts` gets new values; a new `NOTE_CHIPS_DARK` map plus `getNoteChip()` serves the picker only. The `[data-theme="dark"]` block in `src/app.css` is rewritten. Consumers (`NoteCard`, `NoteEditor`, the public share page) already resolve colour through `getNoteColor()` and need no changes — only `ColorPicker.svelte` switches functions.

**Tech Stack:** SvelteKit + Svelte 5 runes, Tailwind CSS v4, Vitest (unit), Playwright (e2e), pnpm.

**Spec:** `docs/superpowers/specs/2026-07-31-dark-palette-design.md`

## Global Constraints

- Light mode must not change. Any diff touching `NOTE_COLORS` (the light map) or `:root` colour values other than the new `--accent-check` is out of scope.
- Never hardcode Tailwind colours (`text-gray-500`, `bg-red-600`). Always reference CSS variables. (Project rule, `CLAUDE.md`.)
- Run `pnpm check` before every commit — not just tests. (Project rule.)
- Run `pnpm build` before `pnpm test:e2e` locally, or e2e tests run against a stale bundle.
- Conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Exact dark palette values are given verbatim in each task. Do not re-derive or "improve" them — they were generated to hold WCAG AA against `--text` and `--text-muted` on all twelve surfaces, and hand-tweaking breaks that.

---

### Task 1: New dark note-card colours

**Files:**
- Modify: `src/lib/utils/colors.ts:18-31` (the `NOTE_COLORS_DARK` map)
- Test: `src/lib/utils/colors.test.ts`
- Modify: `tests/e2e/public-sharing.spec.ts` (asserted dark `fog` value)
- Modify: `tests/e2e/dark-mode.spec.ts:84` (stale comment)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `NOTE_COLORS_DARK` with the values below. `getNoteColor(color: NoteColor, isDark: boolean): string` keeps its existing signature. Task 2 relies on `getNoteColor` being unchanged; Task 2's chip values must differ from every value here.

- [ ] **Step 1: Write the failing invariant tests**

Add to `src/lib/utils/colors.test.ts`. These assert the *properties* that broke, not the hex strings — a hex-only test would have passed happily on the old broken palette.

```ts
/** WCAG relative luminance. */
function relativeLuminance(hex: string): number {
	const n = parseInt(hex.slice(1), 16);
	const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
	const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)];
	return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe('dark note colours', () => {
	// Must track [data-theme="dark"] in src/app.css.
	const DARK_TEXT = '#ece3d3';
	const DARK_TEXT_MUTED = '#b3a695';

	it('keeps body text above the AA threshold on every dark card', () => {
		for (const [name, { bg }] of Object.entries(NOTE_COLORS_DARK)) {
			expect(contrastRatio(bg, DARK_TEXT), `${name} (${bg})`).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('keeps muted text above the AA threshold on every dark card', () => {
		// This is the invariant the old palette broke: muted/struck-through text
		// became unreadable on the lighter surfaces.
		for (const [name, { bg }] of Object.entries(NOTE_COLORS_DARK)) {
			expect(contrastRatio(bg, DARK_TEXT_MUTED), `${name} (${bg})`).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('holds the twelve surfaces within a narrow lightness band so they read as a family', () => {
		const luminances = Object.values(NOTE_COLORS_DARK).map((c) => relativeLuminance(c.bg));
		expect(Math.max(...luminances) - Math.min(...luminances)).toBeLessThan(0.03);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit colors`
Expected: FAIL. Only the two hex-pinning assertions fail (they still pin the old values). The AA
tests are forward guards, not regressions of the old palette — the old palette actually clears
both AA thresholds. The distinguishability test is the one that would fail on the old palette
(its closest pair, `fog`/`storm`, sits at RGB distance 7.5).

- [ ] **Step 3: Replace the dark palette**

In `src/lib/utils/colors.ts`, replace the whole `NOTE_COLORS_DARK` map with these values exactly:

```ts
export const NOTE_COLORS_DARK: Record<NoteColor, { bg: string; label: string }> = {
	default: { bg: '#21201f', label: 'Default' },
	coral: { bg: '#3f1f1c', label: 'Coral' },
	peach: { bg: '#3f2b1c', label: 'Peach' },
	sand: { bg: '#3c371b', label: 'Sand' },
	mint: { bg: '#2a3d1d', label: 'Mint' },
	sage: { bg: '#1f3d36', label: 'Sage' },
	fog: { bg: '#253946', label: 'Fog' },
	storm: { bg: '#1d283d', label: 'Storm' },
	dusk: { bg: '#3d2843', label: 'Dusk' },
	blossom: { bg: '#3d2129', label: 'Blossom' },
	clay: { bg: '#363126', label: 'Clay' },
	chalk: { bg: '#303036', label: 'Chalk' }
};
```

Note for the implementer: `blossom` and `storm` intentionally shift hue relative to their light counterparts (toward pink and true blue). At higher chroma the original hues collided with `coral`/`peach` and `fog`. This is deliberate — see the spec.

- [ ] **Step 4: Update the two hex assertions that pin the old values**

In `src/lib/utils/colors.test.ts`, the existing `getNoteColor` tests assert old hexes. Change them:

```ts
	it('returns dark color when isDark is true', () => {
		expect(getNoteColor('default', true)).toBe('#21201f');
		expect(getNoteColor('coral', true)).toBe('#3f1f1c');
	});

	it('returns default color for unknown color name', () => {
		expect(getNoteColor('unknown' as any, false)).toBe('#faf5eb');
		expect(getNoteColor('unknown' as any, true)).toBe('#21201f');
	});
```

- [ ] **Step 5: Run the unit tests to verify they pass**

Run: `pnpm test:unit colors`
Expected: PASS, all tests in the file.

- [ ] **Step 6: Update the e2e test that asserts a dark note colour**

`tests/e2e/public-sharing.spec.ts` — the "Shared note follows a dark-mode visitor theme" scenario asserts dark `fog`. `#253946` is `rgb(37, 57, 70)`:

```ts
		await expect(publicPage.getByTestId('shared-note')).toHaveCSS(
			'background-color',
			'rgb(37, 57, 70)'
		);
```

In `tests/e2e/dark-mode.spec.ts:84`, the assertion itself is a negative one (`not.toBe` light default) and needs no change, but its comment names the old hex. Update it:

```ts
		// Dark default color is #21201f = rgb(33, 32, 31); NOT light default rgb(250, 245, 235)
```

- [ ] **Step 7: Verify types, then the full e2e suites that touch colour**

Run: `pnpm check`
Expected: 0 errors.

Run: `pnpm build && pnpm test:e2e public-sharing dark-mode organization`
Expected: PASS. (`organization.spec.ts` exercises the picker but asserts no hex, so it should be unaffected — it is in the list to prove that.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/utils/colors.ts src/lib/utils/colors.test.ts tests/e2e/public-sharing.spec.ts tests/e2e/dark-mode.spec.ts
git commit -m "feat(theme): rebuild dark note colours as a consistent family"
```

---

### Task 2: Decouple picker swatches from card surfaces

**Files:**
- Modify: `src/lib/utils/colors.ts` (add `NOTE_CHIPS_DARK` and `getNoteChip`)
- Modify: `src/lib/components/ColorPicker.svelte:2,19`
- Test: `src/lib/utils/colors.test.ts`
- Test: `tests/e2e/dark-mode.spec.ts`

**Interfaces:**
- Consumes: `NOTE_COLORS_DARK` and `getNoteColor(color: NoteColor, isDark: boolean): string` from Task 1.
- Produces: `NOTE_CHIPS_DARK: Record<NoteColor, string>` and `getNoteChip(color: NoteColor, isDark: boolean): string`. No later task depends on these.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/utils/colors.test.ts`:

```ts
describe('getNoteChip', () => {
	it('returns the card colour in light mode, where pastels already are the cards', () => {
		for (const color of Object.keys(NOTE_COLORS) as NoteColor[]) {
			expect(getNoteChip(color, false)).toBe(getNoteColor(color, false));
		}
	});

	it('returns a distinct vivid chip in dark mode, not the card surface', () => {
		for (const color of Object.keys(NOTE_COLORS_DARK) as NoteColor[]) {
			expect(getNoteChip(color, true)).not.toBe(getNoteColor(color, true));
		}
	});

	it('falls back to default for an unknown colour', () => {
		expect(getNoteChip('unknown' as any, true)).toBe(NOTE_CHIPS_DARK.default);
	});

	it('has matching keys with the colour maps', () => {
		expect(Object.keys(NOTE_CHIPS_DARK).sort()).toEqual(Object.keys(NOTE_COLORS_DARK).sort());
	});

	it('keeps every pair of chips far enough apart to tell apart at 28px', () => {
		// The regression this guards: at low chroma coral/peach/blossom and
		// fog/storm collapse into each other.
		const entries = Object.entries(NOTE_CHIPS_DARK);
		for (let i = 0; i < entries.length; i++) {
			for (let j = i + 1; j < entries.length; j++) {
				const [[nameA, a], [nameB, b]] = [entries[i], entries[j]];
				const toRgb = (hex: string) => {
					const n = parseInt(hex.slice(1), 16);
					return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
				};
				const [ra, ga, ba] = toRgb(a);
				const [rb, gb, bb] = toRgb(b);
				const distance = Math.hypot(ra - rb, ga - gb, ba - bb);
				expect(distance, `${nameA} vs ${nameB}`).toBeGreaterThan(25);
			}
		}
	});
});
```

Extend the import at the top of the file:

```ts
import {
	getNoteColor,
	getNoteChip,
	NOTE_COLORS,
	NOTE_COLORS_DARK,
	NOTE_CHIPS_DARK
} from '$lib/utils/colors.js';
import type { NoteColor } from '$lib/types/index.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit colors`
Expected: FAIL — `getNoteChip is not a function` / `NOTE_CHIPS_DARK` undefined.

- [ ] **Step 3: Add the chip map and accessor**

Append to `src/lib/utils/colors.ts`, after `getNoteColor`:

```ts
/**
 * Picker swatches are labels, not surfaces. A 28px circle at card lightness
 * reads as a grey dot — small patches lose apparent saturation — so the dark
 * picker uses vivid mid-lightness chips that share the card's hue but not its
 * lightness. Light mode needs no equivalent: there the pastels are the cards.
 */
export const NOTE_CHIPS_DARK: Record<NoteColor, string> = {
	default: '#8d857c',
	coral: '#d04f43',
	peach: '#cd7c42',
	sand: '#c7b138',
	mint: '#7bbd4c',
	sage: '#47b89d',
	fog: '#609abe',
	storm: '#547bc0',
	dusk: '#a965bd',
	blossom: '#c05d78',
	clay: '#b5954a',
	chalk: '#c3c3c8'
};

export function getNoteChip(color: NoteColor, isDark: boolean): string {
	if (!isDark) return getNoteColor(color, false);
	return NOTE_CHIPS_DARK[color] ?? NOTE_CHIPS_DARK.default;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit colors`
Expected: PASS.

- [ ] **Step 5: Point the picker at the chips**

In `src/lib/components/ColorPicker.svelte`, change the import on line 2 and the style on line 19:

```svelte
	import { COLOR_OPTIONS, getNoteChip } from '$lib/utils/colors.js';
```

```svelte
			style="background-color: {getNoteChip(option.value, getIsDarkMode())}"
```

Leave everything else alone — the 2px `--border-subtle` ring stays, and it's what gives each swatch its boundary regardless of fill.

- [ ] **Step 6: Add the e2e scenario**

Append inside the `test.describe.serial('Dark mode', ...)` block in `tests/e2e/dark-mode.spec.ts`:

```ts
	test('Scenario: Colour picker swatches are identifiable in dark mode', async ({
		authenticatedPage: page
	}) => {
		// Given dark theme is active
		await page.goto('/settings/preferences');
		await page.waitForLoadState('networkidle');
		await page.getByTestId('pref-theme-dark').click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		// When the user opens the colour picker while editing a note
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Swatch Test');
		await page.getByTestId('color-picker-toggle').click();
		await expect(page.getByTestId('color-picker')).toBeVisible();

		// Then a swatch shows its vivid chip rather than the muted card surface
		await expect(page.getByTestId('color-coral')).toHaveCSS(
			'background-color',
			'rgb(208, 79, 67)'
		);

		await page.getByTestId('close-editor-btn').click();
	});
```

- [ ] **Step 7: Verify**

Run: `pnpm check`
Expected: 0 errors.

Run: `pnpm build && pnpm test:e2e dark-mode organization`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/utils/colors.ts src/lib/utils/colors.test.ts src/lib/components/ColorPicker.svelte tests/e2e/dark-mode.spec.ts
git commit -m "feat(theme): give the dark colour picker vivid identifiable chips"
```

---

### Task 3: New dark CSS variables and checkbox accent

**Files:**
- Modify: `src/app.css:6-24` (`:root` — add `--accent-check` only), `src/app.css:26-42` (the `[data-theme="dark"]` block), `src/app.css:44-48` (`accent-color`)

**Interfaces:**
- Consumes: nothing. The `--text`/`--text-muted` values here must match the constants asserted in Task 1's tests (`#ece3d3`, `#b3a695`).
- Produces: `--accent-check` custom property, available in both themes.

- [ ] **Step 1: Add `--accent-check` to `:root`**

In the `:root` block in `src/app.css`, after `--grid-dot`:

```css
	--grid-dot: #1a1a2e;
	--accent-check: var(--primary);
```

- [ ] **Step 2: Replace the dark block**

Replace the entire `[data-theme="dark"]` block with:

```css
[data-theme="dark"] {
	--bg-base: #141312;
	--bg-surface: #1e1c1b;
	--primary: #e0a030;
	--primary-hover: #f2b855;
	--text: #ece3d3;
	--text-muted: #b3a695;
	--border: #57514b;
	--border-subtle: #302d2b;
	--destructive: #e2705c;
	--error-bg: #3a2320;
	--error-border: #5c3a34;
	--error-text: #f0a898;
	--success-bg: #1f2e1f;
	--success-text: #8fc97a;
	--card-shadow: 2px 2px 0px var(--border-subtle);
	--card-shadow-hover: 3px 3px 0px var(--primary);
	--grid-dot: #ece3d3;
	/* Dimmed so a long done-list of gold checkboxes doesn't shout. */
	--accent-check: #c8a44a;
}
```

Two of these reverse earlier decisions on purpose: `--primary` is no longer shared with light mode (`#C8860A` reads mustard on ink), and `--border` is a warm mid-grey rather than the mirrored cream `#e8dcc8` (a bright 1px line on a dark background reads as glare, not structure).

- [ ] **Step 3: Point `accent-color` at the new variable**

In the `html, body` rule:

```css
html, body {
	font-family: 'JetBrains Mono', monospace;
	accent-color: var(--accent-check);
	overscroll-behavior-y: none;
}
```

- [ ] **Step 4: Verify light mode is untouched and dark mode renders**

Run: `pnpm check`
Expected: 0 errors.

Run: `pnpm build && pnpm test:e2e dark-mode public-sharing`
Expected: PASS. Task 1's e2e assertions cover the dark note colours; nothing asserts the chrome variables, so this step is proving no regression rather than proving the change.

Then look at it: `pnpm preview`, open the app, switch to dark in Settings → Preferences, and check the notes grid, the sidebar, an open editor, and a checklist with done items. Contrast maths can't judge the pixel-grid overlay or the gold hover states.

- [ ] **Step 5: Commit**

```bash
git add src/app.css
git commit -m "feat(theme): replace dark surfaces, borders and accents with the warm ink palette"
```

---

### Task 4: Sync the browser theme-colour with the new base

**Files:**
- Modify: `src/lib/utils/theme.svelte.ts:4`
- Modify: `src/app.html:21`
- Test: `src/lib/utils/theme.test.ts:40`

**Interfaces:**
- Consumes: `--bg-base` `#141312` from Task 3. These two hardcoded copies must equal it.
- Produces: nothing.

- [ ] **Step 1: Update the failing test first**

In `src/lib/utils/theme.test.ts`:

```ts
	it('updates meta theme-color for dark mode', () => {
		applyTheme('dark');
		const meta = document.querySelector('meta[name="theme-color"]');
		expect(meta?.getAttribute('content')).toBe('#141312');
	});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:unit theme`
Expected: FAIL — received `#1a1715`.

- [ ] **Step 3: Update both hardcoded copies**

`src/lib/utils/theme.svelte.ts` line 4:

```ts
const DARK_THEME_COLOR = '#141312';
```

`src/app.html` line 21, inside the FOUC script:

```js
            if (m) m.content = '#141312';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:unit theme`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `pnpm check && pnpm test:unit`
Expected: 0 errors, all unit tests pass.

```bash
git add src/lib/utils/theme.svelte.ts src/app.html src/lib/utils/theme.test.ts
git commit -m "fix(theme): sync browser theme-colour with the new dark base"
```

---

### Task 5: Document the palette

**Files:**
- Modify: `CLAUDE.md` (the "Design system: Retro Parchment" section)
- Modify: `docs/ARCHITECTURE.md:155-165` (the dark mode section)

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: nothing.

- [ ] **Step 1: Document the dark palette in `CLAUDE.md`**

The colour table there lists only light values, which is why the dark palette drifted in the first place. After the existing table and the note about `src/lib/utils/colors.ts`, add:

```markdown
### Dark theme

Dark mode overrides every colour variable in `[data-theme="dark"]` (`src/app.css`). It is not a
mechanical inversion of light mode — two differences are deliberate:

- **`--primary` differs per theme.** `#C8860A` on parchment, `#e0a030` on ink. The light gold reads
  mustard on a dark background.
- **`--border` is a warm mid-grey (`#57514b`), not mirrored cream.** A bright 1px line on a dark
  background reads as glare rather than structure; the hard offset shadow carries the retro framing.

Note colours have two representations, and they are not interchangeable:

| Map | Function | Used by | Role |
|---|---|---|---|
| `NOTE_COLORS` / `NOTE_COLORS_DARK` | `getNoteColor(color, isDark)` | Cards, editor, share page | Quiet **surface** you read text on |
| `NOTE_CHIPS_DARK` | `getNoteChip(color, isDark)` | `ColorPicker` only | Vivid **label** you identify at a glance |

A dark card sits at ~18% lightness, where a 28px picker circle would read as a grey dot — small
patches lose apparent saturation. Never fill a picker swatch with `getNoteColor()`. In light mode
`getNoteChip()` returns the pastel card colour, because there the pastels *are* the cards.

When changing any dark note colour, keep the invariants asserted in `src/lib/utils/colors.test.ts`:
AA contrast against both `--text` and `--text-muted` on every surface, a narrow lightness band across
the twelve, and no two chips closer than an RGB distance of 25.

`--bg-base` is duplicated as a literal in `src/app.html` (FOUC script) and
`src/lib/utils/theme.svelte.ts` (`DARK_THEME_COLOR`) for the browser theme-colour. Update all three
together.
```

- [ ] **Step 2: Update `docs/ARCHITECTURE.md`**

In the dark mode section, the line describing note colours currently mentions only `getNoteColor()`. Replace it with:

```markdown
- **Note card colors**: `getNoteColor()` in `src/lib/utils/colors.ts` accepts a `dark` boolean and
  returns the appropriate surface variant per theme. Picker swatches use `getNoteChip()` instead —
  in dark mode the card surfaces are too dark to be identifiable as small circles, so the picker
  draws from a separate vivid `NOTE_CHIPS_DARK` map.
```

- [ ] **Step 3: Verify the docs match the code**

Re-read both edited sections against `src/lib/utils/colors.ts` and `src/app.css`. Every function name, map name, file path and hex value must exist as written. No verification command can catch a wrong hex in prose — check it by eye.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/ARCHITECTURE.md
git commit -m "docs: document the dark palette and the card-vs-chip distinction"
```

---

## Final verification

- [ ] `pnpm check` — 0 errors
- [ ] `pnpm test:unit` — all pass
- [ ] `pnpm build && pnpm test:e2e` — full suite passes
- [ ] Manual pass in dark mode: notes grid, sidebar, header, open editor, checklist with done items, colour picker, a public share link, an error state (e.g. a failed login), and light mode unchanged
