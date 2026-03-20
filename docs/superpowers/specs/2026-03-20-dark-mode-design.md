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

## 1. CSS Variable Overrides

Add to `app.css` after `:root`:

```css
:root {
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
  --card-shadow: 2px 2px 0px #111010;
  --card-shadow-hover: 3px 3px 0px var(--primary);
  --grid-dot: #e8dcc8;
}
```

`--primary` and `--primary-hover` remain unchanged — gold works on both backgrounds.

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

Files to modify:
- `src/lib/types/preferences.ts` — add `theme` field and default
- `src/lib/stores/preferences.svelte.ts` — no changes needed (generic key-value system)

## 3. FOUC Prevention

Add a blocking `<script>` in `app.html` `<head>` before `%sveltekit.head%`:

```html
<script>
  (function() {
    try {
      var p = JSON.parse(localStorage.getItem('crumbs-preferences') || '{}');
      var t = p.theme || 'system';
      if (t === 'system') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (t === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.querySelector('meta[name="theme-color"]').content = '#1a1715';
      }
    } catch(e) {}
  })();
</script>
```

This runs synchronously before first paint.

## 4. Reactive Theme Application

Create `src/lib/utils/theme.ts` with a function `applyTheme(theme: 'system' | 'light' | 'dark')` that:

1. Resolves `'system'` to actual preference via `matchMedia`
2. Sets/removes `data-theme="dark"` on `document.documentElement`
3. Updates `<meta name="theme-color">` content (`#f0e6d3` for light, `#1a1715` for dark)

Call this from an `$effect` in the `(app)/+layout.svelte` that watches `preferences.theme`. Also register a `matchMedia` listener for `prefers-color-scheme` changes when in system mode (clean up on destroy).

The `(auth)` layout group also needs the theme applied — either duplicate the effect or place it in the root `+layout.svelte`.

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

Export a helper `getNoteColor(color, isDark)` that returns the correct bg hex.

Components that apply note card colors (`NoteCard.svelte`, `NoteEditor.svelte`, `ColorPicker.svelte`) need to use this helper instead of directly reading `NOTE_COLORS[color].bg`. They detect dark mode by checking `document.documentElement.dataset.theme === 'dark'` or by receiving it as a prop/derived value.

Preferred approach: expose a reactive `isDarkMode` derived value from the theme utility so components can import and use it.

## 6. Settings UI

Add a "Theme" section to `src/routes/(app)/settings/preferences/+page.svelte`:

```svelte
<!-- Theme -->
<div class="space-y-2">
  <span class="block text-sm font-medium text-[var(--text)]">Theme</span>
  <div class="flex gap-1" role="group" aria-label="Theme">
    {#each ['system', 'light', 'dark'] as option}
      <button
        onclick={() => updatePreference('theme', option)}
        class="rounded-sm border px-4 py-2 text-sm transition-colors ..."
      >
        {option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
      </button>
    {/each}
  </div>
</div>
```

Place it as the first preference (before "Default note mode") since it's the most visually impactful setting.

## 7. Landing Page

The static landing page (`website/index.html`) is separate from the app. It should respect `prefers-color-scheme` with a CSS media query — no toggle needed. Add `@media (prefers-color-scheme: dark)` overrides in `website/styles.css`.

## 8. Prose / Typography Overrides

The `.prose` overrides in `app.css` already use CSS variables, so they'll automatically adapt. No changes needed.

The TipTap editor styles (table borders, selected cells, task lists) also use CSS variables. No changes needed.

## 9. Color Picker in Dark Mode

The `ColorPicker` component shows circular swatches. In dark mode, these should display the dark color variants. The component needs to read `isDarkMode` and use `NOTE_COLORS_DARK` when active.

## 10. Testing

### Unit tests
- `theme.ts` — test `applyTheme` sets correct attribute and meta tag
- `colors.ts` — test `getNoteColor` returns correct color for light/dark

### E2E tests
- Theme toggle in preferences persists and applies
- System preference detection (use Playwright's `page.emulateMedia({ colorScheme: 'dark' })`)
- No FOUC on page reload in dark mode
- Note cards render with correct dark colors

## Out of Scope

- Header quick-toggle icon
- Per-note theme override
- Custom color theme builder
- Dark mode for public shared note pages (can be added later)
