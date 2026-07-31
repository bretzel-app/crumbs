# Dark Theme Palette Rework — Design Spec

**Date:** 2026-07-31
**Status:** Approved
**Supersedes the palette portion of:** `2026-03-20-dark-mode-design.md`

## Summary

The dark theme's colours were authored one at a time rather than as a set. The result: twelve note
colours that collapse into indistinguishable dark mud, a picker of twelve grey dots, sepia-tinted
surfaces, and a near-white editor outline that reads as glare. This spec replaces the dark palette
with a systematically generated one, and splits the picker swatch from the card surface — they are
different jobs and should not share a value.

Light mode is unchanged.

## Problems being fixed

1. **Note colours are indistinguishable.** `coral #4a2522`, `peach #4a3020` and `clay #302e28` differ
   by a few percent lightness with almost no chroma. Lightness wanders across the set (17%–19%) with
   no consistent relationship, so they don't read as a family.
2. **Several cards don't separate from the page.** `clay`, `chalk` and `default` sit within a few
   percent of `--bg-base`, so cards lose their edges.
3. **The picker is unreadable.** `ColorPicker.svelte` fills each swatch with the card background. A
   28px circle at 18% lightness cannot read as a colour — small patches lose apparent saturation, so
   twelve swatches become twelve grey dots.
4. **Surfaces are sepia.** `--bg-base #1a1715` / `--bg-surface #2a2520` are brown-tinted; combined
   with gold and cream on top, the UI reads dim rather than crisp.
5. **The editor frame glares.** `--border` mirrors light mode's near-black ink as near-white cream.
   The mirror is false: dark-on-light edges absorb, light-on-dark edges emit. At equal contrast the
   inverted border reads as a glowing rectangle, not as structure.

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Base surfaces | **Warm ink** — pull the brown out, keep a trace of warmth |
| 2 | Card lightness | **Deep tinted (~18%)** — colours identifiable, page still reads dark |
| 3 | Picker swatches | **Vivid mid-lightness chips**, decoupled from the card colour |
| 4 | Chip scope | **Dark mode only** — light mode keeps its pastel swatches |
| 5 | Chrome | **Quiet frame** — `--border` becomes warm mid-grey, not cream |

On (4): in light mode the pastels genuinely *are* the card colours, so they preview correctly there.
Only dark mode needs the split.

## 1. CSS variables (`src/app.css`)

Replace the `[data-theme="dark"]` block:

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
  --accent-check: #c8a44a;
}
```

Three of these are notable changes rather than tweaks:

- **`--primary` is no longer shared across themes.** `#C8860A` was chosen for parchment; on ink it
  reads mustard. Dark mode gets `#e0a030` (8.17:1 on the page).
- **`--border` becomes `#57514b`** instead of cream `#e8dcc8`. Frames the editor without glare; the
  hard offset shadow still carries the retro structure.
- **`--text-muted` lifts `#9a8e7e` → `#b3a695`.** Required for AA on the tinted cards. This is the
  widest-reaching change in the spec — every muted element in dark mode shifts slightly.

### Checkbox accent

`accent-color: var(--primary)` makes a long done-list shout in dark mode. Add a dedicated variable so
the checkbox can be dimmed independently of links and the brand:

```css
:root { --accent-check: var(--primary); }   /* light: unchanged */
html, body { accent-color: var(--accent-check); }
```

## 2. Note card colours (`src/lib/utils/colors.ts`)

Replace `NOTE_COLORS_DARK`. Every entry keeps its light counterpart's hue, holds lightness
near-constant against today's values (measured average change: +4.1 saturation points, −0.18
lightness points), and nudges two crowded hues apart (`blossom` and `storm` shift toward pink
and true blue respectively) so the twelve read as distinguishable siblings rather than a smudge.
The visible improvement in dark mode comes from the base surfaces, the picker chips, the
softened border, and the lifted gold — not from the card surfaces, which are close in chroma to
the previous dark values.

```ts
export const NOTE_COLORS_DARK: Record<NoteColor, { bg: string; label: string }> = {
  default: { bg: '#21201f', label: 'Default' },
  coral:   { bg: '#3f1f1c', label: 'Coral' },
  peach:   { bg: '#3f2b1c', label: 'Peach' },
  sand:    { bg: '#3c371b', label: 'Sand' },
  mint:    { bg: '#2a3d1d', label: 'Mint' },
  sage:    { bg: '#1f3d36', label: 'Sage' },
  fog:     { bg: '#253946', label: 'Fog' },
  storm:   { bg: '#1d283d', label: 'Storm' },
  dusk:    { bg: '#3d2843', label: 'Dusk' },
  blossom: { bg: '#3d2129', label: 'Blossom' },
  clay:    { bg: '#363126', label: 'Clay' },
  chalk:   { bg: '#303036', label: 'Chalk' }
};
```

**Two hues are deliberately nudged apart.** At low chroma, `coral`/`peach`/`blossom` are three
barely-different oranges and `fog`/`storm` are two barely-different blues — invisible in light mode,
but they collide once chroma rises. So in dark mode `blossom` moves toward pink (H344) and `storm`
toward true blue (H218). Their light-mode values are untouched, so the same note is a slightly
different hue in each theme. This is an accepted trade: distinguishable beats identical.

Measured on these values: body text ≥ 9.25:1, muted text ≥ 4.94:1, links ≥ 5.18:1 on every card.
All clear WCAG AA.

## 3. Picker chips (`src/lib/utils/colors.ts`)

New map, used only by the picker, only in dark mode:

```ts
export const NOTE_CHIPS_DARK: Record<NoteColor, string> = {
  default: '#8d857c', coral: '#d04f43', peach: '#cd7c42', sand:  '#c7b138',
  mint:    '#7bbd4c', sage:  '#47b89d', fog:   '#609abe', storm: '#547bc0',
  dusk:    '#a965bd', blossom: '#c05d78', clay: '#b5954a', chalk: '#c3c3c8'
};

/** Picker swatch colour: a vivid label, not the card surface. */
export function getNoteChip(color: NoteColor, isDark: boolean): string {
  if (!isDark) return getNoteColor(color, false);   // light mode: pastel == card
  return NOTE_CHIPS_DARK[color] ?? NOTE_CHIPS_DARK.default;
}
```

`default` and `chalk` stay deliberately neutral (grey and off-white) — they are the "no colour"
slots. Every chip clears 4:1 against the chrome; the closest pair (`fog`/`storm`) is separated by an
RGB distance of 33, which is comfortably tellable apart at 28px.

`ColorPicker.svelte` switches from `getNoteColor` to `getNoteChip`. Nothing else uses chips — cards,
the editor and the public share page keep calling `getNoteColor`.

## 4. Theme-colour meta tag

`#1a1715` is hardcoded in two places that must stay in sync with `--bg-base`:

- `src/app.html` (the FOUC script, `m.content = '#1a1715'`)
- `src/lib/utils/theme.svelte.ts` (`DARK_THEME_COLOR`)

Both become `#141312`.

## Files to modify

| File | Change |
|---|---|
| `src/app.css` | Rewrite `[data-theme="dark"]`; add `--accent-check` to `:root`; point `accent-color` at it |
| `src/lib/utils/colors.ts` | New `NOTE_COLORS_DARK`; add `NOTE_CHIPS_DARK` + `getNoteChip()` |
| `src/lib/components/ColorPicker.svelte` | Use `getNoteChip()` instead of `getNoteColor()` |
| `src/app.html` | Theme-colour `#1a1715` → `#141312` |
| `src/lib/utils/theme.svelte.ts` | `DARK_THEME_COLOR` → `#141312` |
| `src/lib/utils/colors.test.ts` | Update dark `default` assertions; add `getNoteChip` coverage |
| `src/lib/utils/theme.test.ts` | Update theme-colour assertion |
| `tests/e2e/dark-mode.spec.ts` | Update asserted dark default `rgb(42,37,32)` → `rgb(33,32,31)` |
| `tests/e2e/public-sharing.spec.ts` | Update asserted dark `fog` `rgb(34,46,58)` → `rgb(37,57,70)` |
| `CLAUDE.md` | Document the dark palette and the card-vs-chip distinction in the design system section |
| `docs/ARCHITECTURE.md` | Update the dark mode section for `getNoteChip` |

Nothing needs to change in `NoteCard`, `NoteEditor`, or the share page — they already resolve colour
through `getNoteColor`, so they inherit the new palette.

## Testing

**Unit (`colors.test.ts`)** — the palette is data, so test its invariants rather than its hex values:

- `getNoteChip(c, false)` equals `getNoteColor(c, false)` for all twelve (light mode is unchanged)
- `getNoteChip(c, true)` differs from `getNoteColor(c, true)` for all twelve (chip ≠ surface)
- unknown colour falls back to `default` in both maps
- every dark card holds ≥ 4.5:1 against `--text-muted #b3a695` — this is the invariant that broke
  before, so it gets asserted rather than eyeballed
- no two dark chips are within an RGB distance of 25 (guards the crowded-hue regression)

**E2E (`dark-mode.spec.ts`)** — extend the existing "note cards use dark colors" scenario to assert a
picker swatch is *not* the card background, which is the bug in user-visible terms.

**Manual** — the pixel-grid overlay and gold hover states want a real look on device; contrast maths
can't judge those.

## Out of scope

- Light mode, including its picker
- The 12-colour set itself (no colours added, removed, or renamed)
- Per-note custom colours
- `prefers-contrast` / high-contrast variants
