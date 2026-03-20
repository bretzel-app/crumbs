# Dark Mode / Theme Toggle — Design Spec

**Issue:** #26
**Date:** 2026-03-20
**Status:** Draft

## Summary

Add a dark variant of the retro parchment theme with a three-way toggle (system / light / dark) in Settings > Preferences. The dark theme preserves the retro 8-bit character — warm dark tones, not cold grays.

## Decisions

- **Toggle location:** Settings > Preferences only (no header icon)
- **UI pattern:** Segmented buttons (system / light / dark), matching existing `defaultNoteMode` toggle style
- **Implementation:** CSS `[data-theme="dark"]` attribute on `<html>`, variable overrides in `app.css`
- **Pixel grid texture:** Inverted to light dots (`#e8dcc8`) at 3% opacity in dark mode
- **Default:** `system` (follows `prefers-color-scheme`)
- **Light mode:** No `data-theme` attribute set (`:root` defaults apply). `data-theme="dark"` is only set for dark mode. This means no redundant `[data-theme="light"]` block is needed.

## 1. CSS Variable Overrides

Add `--grid-dot` to the existing `:root` block and add a `[data-theme="dark"]` block after it in `app.css`:

```css
:root {
  /* ...existing vars... */
  --grid-dot: #1a1a2e;  /* new — extracted from body::before */
}

[data-theme="dark"] {
  --bg-base: #1a1715;
  --bg-surface: #2a2520;
  --text: #e8dcc8;
  --text-muted: #9a8e7e;
  --border: #e8dcc8;
  --border-subtle: #3a3530;
  --destructive: #d4604e;
  --error-bg: #3a2020;
  --error-border: #5a3030;
  --error-text: #e8a090;
  --success-bg: #203020;
  --success-text: #90c880;
  --card-shadow: 2px 2px 0px var(--border-subtle);
  --card-shadow-hover: 3px 3px 0px var(--primary);
  --grid-dot: #e8dcc8;
}
```

`--primary` and `--primary-hover` remain unchanged — gold works on both backgrounds.

`--card-shadow` uses `var(--border-subtle)` in both modes for consistency — the dark `--border-subtle` (#3a3530) produces the right effect.

Update `body::before` to use the new variable:
```css
body::before {
  background-image: repeating-conic-gradient(var(--grid-dot) 0% 25%, transparent 0% 50%);
}
```

## 2. Theme Preference Storage

Extend the existing `UserPreferences` system:

- **Type change:** Add `theme: 'system' | 'light' | 'dark'` to `UserPreferences` interface
- **Default:** `'system'`
- **Storage:** Same key-value `userPreferences` table + localStorage cache — no schema migration needed
- **Do NOT add `theme` to `BOOLEAN_PREF_KEYS`** — it's a string enum, not a boolean

Files to modify:
- `src/lib/types/preferences.ts` — add `theme` field and default

The existing `fromServerRecord` in `preferences.svelte.ts` does not validate string values. The `applyTheme` function (Section 4) must guard against unexpected values and fall back to `'system'` if the value is not one of the three valid options.

## 3. FOUC Prevention

Add a blocking `<script>` in `app.html` `<head>`, **after** the `<meta name="theme-color">` tag and **before** `%sveltekit.head%`:

```html
<script>
  (function() {
    try {
      var p = JSON.parse(localStorage.getItem('crumbs-preferences') || '{}');
      var t = p.theme || 'system';
      if (t !== 'light' && t !== 'dark') t = 'system';
      if (t === 'system') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (t === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        var m = document.querySelector('meta[name="theme-color"]');
        if (m) m.content = '#1a1715';
      }
    } catch(e) {}
  })();
</script>
```

This runs synchronously before first paint. The script validates the theme value and null-checks the meta element.

## 4. Reactive Theme Application

Create `src/lib/utils/theme.svelte.ts` (`.svelte.ts` to enable Svelte 5 runes) with:

- `applyTheme(theme: 'system' | 'light' | 'dark')` — resolves system preference, sets/removes `data-theme="dark"` on `document.documentElement`, updates `<meta name="theme-color">`. Guards against unexpected values (falls back to `'system'`). All DOM/`matchMedia` access guarded with `browser` check from `$app/environment`.
- `isDarkMode` — a reactive `$state` boolean, updated by `applyTheme` and the `matchMedia` listener. Components import this to conditionally use dark color variants.

Place the theme `$effect` in the **root `+layout.svelte`** (not just `(app)` layout). This ensures both `(app)` and `(auth)` layout groups get the theme applied. The root layout currently only imports CSS — this adds a small `$effect` that watches `preferences.theme` and calls `applyTheme`. It also registers a `matchMedia('(prefers-color-scheme: dark)')` change listener when in system mode, cleaned up on destroy.

## 5. Note Card Dark Colors

Add a parallel `NOTE_COLORS_DARK` map in `src/lib/utils/colors.ts`:

| Color | Light | Dark |
|-------|-------|------|
| default | `#faf5eb` | `#2a2520` |
| coral | `#faafa8` | `#4a2522` |
| peach | `#f39f76` | `#4a3020` |
| sand | `#fff8b8` | `#3a3520` |
| mint | `#e2f6d3` | `#2a3a22` |
| sage | `#b4ddd3` | `#223a32` |
| fog | `#d4e4ed` | `#222e3a` |
| storm | `#aeccdc` | `#1e2a35` |
| dusk | `#d3bfdb` | `#352540` |
| blossom | `#f6e2dd` | `#3a2830` |
| clay | `#e9e3d4` | `#302e28` |
| chalk | `#efeff1` | `#2e2e30` |

Export a helper `getNoteColor(color: NoteColor, isDark: boolean): string` that returns the correct bg hex.

Components (`NoteCard.svelte`, `NoteEditor.svelte`, `ColorPicker.svelte`) import `isDarkMode` from `theme.svelte.ts` and pass it to `getNoteColor`. This is the single approach — do not use direct DOM inspection for dark mode detection.

## 6. Settings UI

Add a "Theme" section to `src/routes/(app)/settings/preferences/+page.svelte` as the **first** preference (before "Default note mode"):

```svelte
<!-- Theme -->
<div class="space-y-2">
  <span class="block text-sm font-medium text-[var(--text)]">Theme</span>
  <div class="flex gap-1" role="group" aria-label="Theme">
    {#each [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']] as [value, label]}
      <button
        onclick={() => updatePreference('theme', value)}
        class="rounded-sm border px-4 py-2 text-sm transition-colors ..."
        data-testid="pref-theme-{value}"
      >
        {label}
      </button>
    {/each}
  </div>
</div>
```

Test IDs: `pref-theme-system`, `pref-theme-light`, `pref-theme-dark`.

## 7. Landing Page

Out of scope for this spec. The landing page (`website/`) uses its own color system separate from `app.css`. Dark mode support for the landing page will be tracked separately.

## 8. Prose / Typography Overrides

The `.prose` overrides in `app.css` already use CSS variables, so they'll automatically adapt. No changes needed.

The TipTap editor styles (table borders, selected cells, task lists) also use CSS variables. No changes needed.

## 9. Color Picker in Dark Mode

The `ColorPicker` component shows circular swatches. In dark mode, these should display the dark color variants. The component imports `isDarkMode` from `theme.svelte.ts` and uses `getNoteColor(color, isDarkMode)` to get the correct swatch background.

## 10. Testing

### Unit tests
- `theme.svelte.ts` — test `applyTheme` sets correct attribute and meta tag, validates unknown values
- `colors.ts` — test `getNoteColor` returns correct color for light/dark

### E2E tests
- Theme toggle in preferences persists and applies (use `data-testid` selectors)
- System preference detection (use Playwright's `page.emulateMedia({ colorScheme: 'dark' })`)
- No FOUC on page reload in dark mode
- Note cards render with correct dark colors

## 11. PWA Manifest

The PWA manifest (`@vite-pwa/sveltekit`) contains a static `theme_color`. This cannot be dynamically changed. The manifest will keep the light theme color (`#f0e6d3`). The `<meta name="theme-color">` is updated dynamically by the FOUC script and `applyTheme`, which handles the browser chrome color. This is a known limitation of PWA manifests and is acceptable.

## Out of Scope

- Header quick-toggle icon
- Per-note theme override
- Custom color theme builder
- Dark mode for public shared note pages (can be added later)
- Dark mode for landing page (separate task)
