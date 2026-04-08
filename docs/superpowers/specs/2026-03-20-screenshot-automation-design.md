# Screenshot Automation for Landing Page

## Overview

A Playwright-based script that seeds the Crumbs app with bretzel-themed demo data, captures 10 screenshots (7 desktop + 3 mobile) for the landing page, and commits them. Triggered manually via a GitHub Actions workflow.

## Architecture

```
scripts/
  screenshots.ts          # Main orchestrator: seed + capture
  fixtures/
    bretzel-pixel.ts      # Generates a pixel-art bretzel PNG programmatically
```

Single script (`scripts/screenshots.ts`) that:
1. Spawns the preview server as a child process (`pnpm preview --port 4173`), same approach as `playwright.config.ts` uses for e2e tests. The app uses `@sveltejs/adapter-node`, so `vite preview` import won't work — must spawn via CLI.
2. Deletes any existing screenshot DB to start fresh
3. Seeds data via API calls (setup admin, login, create notes/users/keys)
4. Navigates to each view and captures screenshots at specific viewports
5. Saves PNGs directly to `website/assets/`
6. Kills the preview server in `finally` block

## Seed Data — Bretzel Universe

### Users

| User | Email | Role | Purpose |
|------|-------|------|---------|
| Bretzel Admin | admin@bretzel.app | admin | Main user, owns all notes |
| Alice Chen | alice@bretzel.app | user | Collaborator for sharing screenshot |

### Tags

Passed explicitly in the `tags` array of each `POST /api/notes` request body: `baking`, `bretzel`, `dev`, `devops`, `homelab`, `personal`, `reading`, `weekend`. Tags are NOT auto-parsed from hashtags in content — they must be provided as a separate field.

### Notes

| # | Title | Color | Mode | Tags | Pinned | Special |
|---|-------|-------|------|------|--------|---------|
| 1 | Bretzel Ingredients | sand | checklist | #baking, #bretzel | yes | Checklist items (see below) |
| 2 | Self-Hosting Stack | fog | rich text | #homelab, #devops | no | Homelab list (see below) |
| 3 | Back to Retro Gaming | peach | rich text | #reading, #personal | no | Retro gaming note |
| 4 | The Best Software Is the Software You Own | coral | rich text | #personal, #bretzel | no | Self-hosting manifesto |
| 5 | Weekend Plans | mint | rich text | #personal, #weekend | no | Casual weekend plans |
| 6 | Ancient Flute Harmonica Discovered | chalk | rich text | #reading | no | Quirky news note |
| 7 | Baking code for the... | clay | checklist | #dev, #bretzel | no | Dev/baking crossover |

### Note Content Details

**Bretzel Ingredients** (checklist):
- [x] 500g bread flour
- [x] 300ml warm water
- [x] 10g salt
- [ ] 7g dry yeast
- [ ] 30g butter (softened)
- [ ] Baking soda for the bath
- [ ] Coarse salt for topping

**Self-Hosting Stack** (rich text — used for editor screenshot):
```
Current homelab setup:

**Crumbs** — notes (obviously)
**42** — holiday budget tracking
**Dokploy** — deployment platform
**Outline** — team wiki
**Navidrome** — music streaming
**Vaultwarden** — passwords
**Nextcloud** — files & calendar
**Plausible** — analytics

Everything below daily reverse proxy.
```

**The Best Software Is the Software You Own** (rich text):
```
Self-host everything. Trust no cloud.

The best software is the software you own.
Your data. Your server. Your rules.

If it can't run on your hardware, it's not really yours.
```

**Back to Retro Gaming** (rich text):
```
Games to replay this summer:

Chrono Trigger (SNES) — best RPG ever made
The Legend of Zelda: Link's Awakening (GB)
Castlevania: Symphony of the Night (PS1)
Advance Wars (GBA)
Final Fantasy Tactics (PS1)

The pixel art era was peak game design.
```

**Weekend Plans** (rich text):
```
Saturday:
- Farmer's market (get sourdough starter)
- Fix the Dokploy SSL cert renewal
- Bake a batch of bretzels

Sunday:
- Retro gaming marathon
- Update the self-hosting stack
- Plan next trip on 42
```

**Ancient Flute Harmonica Discovered** (rich text):
```
Archaeologists found a 40,000-year-old flute carved from vulture bone.

The oldest known musical instrument.
Imagine the first song ever played.
```

**Baking code for the...** (checklist):
```
- [x] Set up CI/CD pipeline
- [x] Write the CRDT sync logic
- [ ] Bake the docker image
- [ ] Deploy to the homelab
- [ ] Celebrate with a bretzel
```

### Image Attachments

**Pixel-art bretzel image** (`scripts/fixtures/bretzel-pixel.ts`):
- Generated programmatically as a PNG using raw pixel data (no external dependencies)
- ~64x64 pixel grid, bretzel shape in warm browns (#C8860A gold, #8B6914 dark, #F0E6D3 parchment bg)
- Attached as featured image to "Bretzel Ingredients" note
- Also create a second smaller image attached to the same note (e.g. a pixel-art salt shaker or oven) for visual variety

### Version History

Send 4-5 `PATCH /api/notes/:id` calls to "Self-Hosting Stack" with varying content. Version history entries are created as a side-effect of each PATCH — there is no explicit "create version" endpoint. Each version adds or changes a tool in the stack, so the diff is meaningful when viewed in the history panel.

### API Keys

Create via API after seeding:
| Name | Purpose |
|------|---------|
| Claude Code | For MCP integration screenshot |
| N8N | For automation screenshot |

## Screenshot Capture Plan

### Desktop (1280x800)

| # | Filename | View | Capture Steps |
|---|----------|------|---------------|
| 1 | screenshot-grid.png | Home grid | Navigate to `/`, wait for notes to render, ensure sidebar is expanded with tags visible |
| 2 | screenshot-editor.png | Note editor | Click "Self-Hosting Stack" note, wait for editor to open with content and toolbar visible |
| 3 | screenshot-checklist.png | Checklist mode | Click "Bretzel Ingredients" note, wait for checklist items with checkboxes visible |
| 4 | screenshot-sharing.png | Share dialog | Open a note, click share button, wait for ShareDialog with "Alice Chen" listed as collaborator |
| 5 | screenshot-history.png | Version history | Open "Self-Hosting Stack", click history button, select a middle version in the list, wait for preview panel |
| 6 | screenshot-attachments.png | Attachments | Open "Bretzel Ingredients" note (has featured bretzel image), ensure image thumbnails and featured strip visible |
| 7 | screenshot-api.png | Settings > API/MCP | Navigate to `/settings/mcp`, wait for API keys list ("Claude Code", "N8N") and MCP config JSON block |

### Mobile (390x844)

| # | Filename | View | Capture Steps |
|---|----------|------|---------------|
| 1 | screenshot-mobile-grid.png | Home grid | Navigate to `/`, wait for notes in mobile layout (no sidebar, tags as horizontal pills) |
| 2 | screenshot-mobile-editor.png | Note editor | Open "Self-Hosting Stack" note, wait for mobile editor |
| 3 | screenshot-mobile-checklist.png | Checklist | Open "Bretzel Ingredients" note, wait for mobile checklist view |

### Capture Settings
- Format: PNG
- Full page: false (viewport only)
- Animations disabled via `page.emulateMedia({ reducedMotion: 'reduce' })` to avoid capturing mid-animation
- Wait for `networkidle` after each navigation before capturing

## GitHub Actions Workflow

**File**: `.github/workflows/screenshots.yml`

```yaml
name: Screenshots

on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  screenshots:
    name: Capture Landing Page Screenshots
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers and system deps
        run: pnpm exec playwright install --with-deps chromium

      - name: Build app
        run: pnpm build
        env:
          DATABASE_URL: ./data/screenshots.db

      - name: Capture screenshots
        run: pnpm exec tsx scripts/screenshots.ts
        env:
          DATABASE_URL: ./data/screenshots.db

      - name: Commit screenshots
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add website/assets/screenshot-*.png
          git diff --cached --quiet && echo "No screenshot changes" && exit 0
          git commit -m "chore: update landing page screenshots [skip ci]"
          git push origin main
```

## Script Structure

```typescript
// scripts/screenshots.ts

import { chromium, type Page } from 'playwright';
import { spawn, type ChildProcess } from 'child_process';
import { generateBretzelPixelArt } from './fixtures/bretzel-pixel';

const BASE = 'http://localhost:4173';
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };
const OUTPUT = 'website/assets';

async function main() {
  // 1. Start preview server (spawn child process, wait for port 4173)
  const server = await startPreviewServer();

  // 2. Launch browser
  const browser = await chromium.launch();

  try {
    // 3. Seed data (desktop context — API calls work at any viewport)
    const seedContext = await browser.newContext({ viewport: DESKTOP });
    const seedPage = await seedContext.newPage();
    await seed(seedPage);

    // 4. Desktop screenshots
    await captureDesktop(seedPage);
    await seedContext.close();

    // 5. Mobile screenshots
    const mobileContext = await browser.newContext({ viewport: MOBILE });
    const mobilePage = await mobileContext.newPage();
    await login(mobilePage);
    await captureMobile(mobilePage);
    await mobileContext.close();
  } finally {
    await browser.close();
    server.close();
  }
}

async function seed(page: Page) {
  // Setup admin via POST /api/auth/setup
  // Login via POST /api/auth/login (sets session cookie on page context)
  // Create notes via POST /api/notes (with content, color, tags:string[], pinned, checklistMode)
  //   → capture note IDs from responses for later use
  // Create collaborator user via POST /api/admin/users
  //   → capture alice.id (numeric) from response
  // Share a note via POST /api/notes/:id/collaborators { userId: alice.id }
  // Create version history: PATCH /api/notes/:id × 4-5 with varying content
  // Upload pixel-art bretzel image via POST /api/notes/:id/attachments (multipart form)
  // Create API keys via POST /api/settings/api-keys { name: "Claude Code" } and { name: "N8N" }
}

async function captureDesktop(page: Page) {
  // D1: Grid view
  // D2: Editor (Self-Hosting Stack)
  // D3: Checklist (Bretzel Ingredients)
  // D4: Sharing dialog
  // D5: Version history
  // D6: Attachments
  // D7: API/MCP settings
}

async function captureMobile(page: Page) {
  // M1: Grid view
  // M2: Editor
  // M3: Checklist
}
```

## Landing Page Updates

After the screenshots are generated, `website/index.html` needs updating:
- Add new screenshot entries for: checklist, sharing, history, attachments, API
- Update alt text and labels
- Hero image stays as `screenshot-grid.png`
- Mobile section adds checklist screenshot, replaces sidebar screenshot

## Dependencies

No new dependencies. Uses:
- `playwright` (already in devDependencies for e2e tests)
- `tsx` (already in devDependencies for other scripts)
- Node.js built-in `fs`, `path`, `Buffer` for pixel-art PNG generation
- SvelteKit's preview server (spawned as child process via `pnpm preview`)

## Open Questions

None — all decisions resolved during brainstorming.
