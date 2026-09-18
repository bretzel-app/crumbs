import { test, expect, noteCard } from './helpers/fixtures.js';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Browser, Page } from '@playwright/test';

/**
 * Automated accessibility gate. RGAA 4.1 is the French application of
 * WCAG 2.1 AA, so the scans run axe-core's WCAG 2.x A/AA rule set over every
 * screen in both themes, and the structural scenarios cover the RGAA
 * criteria that tooling can prove (page titles, landmarks, keyboard reach,
 * visible focus). Tooling covers roughly a third of RGAA; the rest needs a
 * manual pass with assistive technology and is documented in
 * docs/ACCESSIBILITY.md.
 *
 * Each scan also writes its raw violations to test-results/a11y/ so a
 * failing run doubles as the audit's evidence.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const REPORT_DIR = 'test-results/a11y';
const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

const COLORS = ['default', 'coral', 'peach', 'sand', 'mint', 'sage', 'fog', 'storm', 'dusk', 'blossom', 'clay', 'chalk'];

async function scan(page: Page, name: string, theme: Theme) {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	mkdirSync(REPORT_DIR, { recursive: true });
	writeFileSync(`${REPORT_DIR}/${name}-${theme}.json`, JSON.stringify(results.violations, null, 2));
	const summary = results.violations
		.map(
			(v) =>
				`${v.id} [${v.impact}] x${v.nodes.length}: ${v.help}\n` +
				v.nodes
					.slice(0, 4)
					.map((n) => `    ${n.target.join(' ')} — ${n.failureSummary?.split('\n').slice(1).join('; ')}`)
					.join('\n')
		)
		.join('\n');
	expect(results.violations, `axe violations on "${name}" in ${theme} mode:\n${summary}`).toEqual([]);
}

/** Seed one note per colour plus checklist, tagged, code, archived and trashed notes. */
async function seedNotes(page: Page) {
	const existing = await (await page.request.get('/api/notes')).json();
	if (Array.isArray(existing) && existing.some((n) => n.title === 'A11y coral')) return;
	for (const color of COLORS) {
		await page.request.post('/api/notes', {
			data: { title: `A11y ${color}`, content: `Body text on the ${color} card with a [link](https://example.com) and *emphasis*.`, color }
		});
	}
	await page.request.post('/api/notes', {
		data: { title: 'A11y checklist', content: '- [ ] Open item\n- [x] Done item', checklistMode: true }
	});
	await page.request.post('/api/notes', { data: { title: 'A11y tagged', content: 'Filed under #audit' } });
	await page.request.post('/api/notes', {
		data: { title: 'A11y code', content: 'Inline `code` and a block:\n\n```ts\nconst answer: number = 42; // meaning\n```' }
	});
	const archived = await (await page.request.post('/api/notes', { data: { title: 'A11y archived', content: 'Archived' } })).json();
	await page.request.patch(`/api/notes/${archived.id}`, { data: { archived: true } });
	const trashed = await (await page.request.post('/api/notes', { data: { title: 'A11y trashed', content: 'Trashed' } })).json();
	await page.request.patch(`/api/notes/${trashed.id}`, { data: { trashed: true } });
}

async function visit(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
}

async function anonymousPage(browser: Browser, theme: Theme) {
	const context = await browser.newContext({ colorScheme: theme, storageState: { cookies: [], origins: [] } });
	return { context, page: await context.newPage() };
}

for (const theme of THEMES) {
	test.describe(`WCAG 2.1 AA scan (${theme} theme)`, () => {
		test.beforeEach(async ({ authenticatedPage: page }) => {
			await page.emulateMedia({ colorScheme: theme });
			await seedNotes(page);
		});

		test(`Scenario: The notes grid with every note colour has no WCAG AA violations`, async ({ authenticatedPage: page }) => {
			await visit(page, '/');
			await expect(noteCard(page, 'A11y chalk')).toBeVisible();
			await scan(page, 'notes', theme);
		});

		test(`Scenario: The open editor, its colour picker and share dialog have no WCAG AA violations`, async ({
			authenticatedPage: page
		}) => {
			await visit(page, '/');
			await noteCard(page, 'A11y code').click();
			await expect(page.getByTestId('tiptap-editor')).toBeVisible();
			await scan(page, 'editor', theme);

			await page.getByTestId('color-picker-toggle').click();
			await expect(page.getByTestId('color-picker')).toBeVisible();
			await scan(page, 'editor-color-picker', theme);
			await page.keyboard.press('Escape');

			await page.getByTestId('share-toggle').click();
			await expect(page.getByTestId('share-dialog')).toBeVisible();
			await scan(page, 'share-dialog', theme);
		});

		test(`Scenario: A checklist note open in the editor has no WCAG AA violations`, async ({ authenticatedPage: page }) => {
			await visit(page, '/');
			await noteCard(page, 'A11y checklist').click();
			await expect(page.getByTestId('note-editor')).toBeVisible();
			await scan(page, 'editor-checklist', theme);
		});

		for (const [name, path] of [
			['archive', '/archive'],
			['trash', '/trash'],
			['tag', '/tag/audit'],
			['settings-profile', '/settings/profile'],
			['settings-preferences', '/settings/preferences'],
			['settings-mcp', '/settings/mcp'],
			['settings-users', '/settings/users'],
			['settings-about', '/settings/about']
		] as const) {
			test(`Scenario: The ${name} page has no WCAG AA violations`, async ({ authenticatedPage: page }) => {
				await visit(page, path);
				await scan(page, name, theme);
			});
		}

		test(`Scenario: Search results have no WCAG AA violations`, async ({ authenticatedPage: page }) => {
			await visit(page, '/');
			await page.getByTestId('search-input').fill('A11y');
			await expect(noteCard(page, 'A11y coral')).toBeVisible();
			await scan(page, 'search', theme);
		});

		test(`Scenario: The login page has no WCAG AA violations`, async ({ browser }) => {
			const { context, page } = await anonymousPage(browser, theme);
			await visit(page, '/login');
			await expect(page.getByTestId('login-btn')).toBeVisible();
			await scan(page, 'login', theme);
			await context.close();
		});

		test(`Scenario: A publicly shared note has no WCAG AA violations`, async ({ authenticatedPage: page, browser }) => {
			const notes = await (await page.request.get('/api/notes')).json();
			const code = notes.find((n: { title: string }) => n.title === 'A11y code');
			const { token } = await (await page.request.post(`/api/notes/${code.id}/share`)).json();
			const { context, page: anon } = await anonymousPage(browser, theme);
			await visit(anon, `/s/${token}`);
			await expect(anon.getByTestId('shared-note-content')).toBeVisible();
			await scan(anon, 'share', theme);
			await context.close();
		});
	});
}

test.describe('Structure and keyboard (RGAA 8, 10, 12)', () => {
	test.beforeEach(async ({ authenticatedPage: page }) => {
		await seedNotes(page);
	});

	test('Scenario: Every page has a distinct, descriptive title (RGAA 8.5, 8.6)', async ({ authenticatedPage: page }) => {
		const titles = new Map<string, string>();
		for (const path of ['/', '/archive', '/trash', '/tag/audit', '/settings/profile', '/settings/preferences']) {
			await visit(page, path);
			titles.set(path, await page.title());
		}
		for (const [path, title] of titles) {
			expect(title.trim(), `title of ${path}`).not.toBe('');
		}
		expect(new Set(titles.values()).size, `titles must differ per page: ${JSON.stringify([...titles])}`).toBe(titles.size);
	});

	test('Scenario: The app shell exposes header, navigation, main and footer landmarks (RGAA 12.6, 9.2)', async ({
		authenticatedPage: page
	}) => {
		await visit(page, '/');
		for (const selector of ['header, [role="banner"]', 'nav, [role="navigation"]', 'main, [role="main"]', 'footer, [role="contentinfo"]']) {
			await expect(page.locator(selector).first(), selector).toBeAttached();
		}
	});

	test('Scenario: A skip link lets keyboard users jump past the header and sidebar (RGAA 12.7)', async ({
		authenticatedPage: page
	}) => {
		await visit(page, '/');
		await page.keyboard.press('Tab');
		const first = await page.evaluate(() => {
			const el = document.activeElement as HTMLElement | null;
			return { tag: el?.tagName, text: el?.textContent?.trim() ?? '', href: el?.getAttribute('href') ?? '' };
		});
		expect(first, 'first Tab stop should be a skip link to the main content').toMatchObject({ tag: 'A' });
		expect(first.href).toMatch(/^#/);
	});

	test('Scenario: Every Tab stop on the notes page shows a visible focus indicator (RGAA 10.7)', async ({
		authenticatedPage: page
	}) => {
		await visit(page, '/');
		await expect(noteCard(page, 'A11y chalk')).toBeVisible();
		const invisible: string[] = [];
		const seen = new Set<string>();
		for (let i = 0; i < 40; i++) {
			await page.keyboard.press('Tab');
			const info = await page.evaluate(() => {
				const el = document.activeElement as HTMLElement | null;
				if (!el || el === document.body) return null;
				const s = getComputedStyle(el);
				const key = el.tagName + '#' + (el.dataset.testid ?? el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20));
				const hasOutline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
				const hasRing = s.boxShadow !== 'none';
				const hasBorderChange = el.matches(':focus-visible') && s.borderColor !== getComputedStyle(el.parentElement!).borderColor;
				return { key, visible: hasOutline || hasRing || hasBorderChange };
			});
			if (!info || seen.has(info.key)) break;
			seen.add(info.key);
			if (!info.visible) invisible.push(info.key);
		}
		expect(seen.size, 'Tab must reach interactive elements').toBeGreaterThan(3);
		expect(invisible, 'focused elements without a visible indicator').toEqual([]);
	});

	test('Scenario: Escape closes the editor and returns focus to the card that opened it (RGAA 7.3, 12.8)', async ({
		authenticatedPage: page
	}) => {
		await visit(page, '/');
		const card = noteCard(page, 'A11y coral');
		await card.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('note-editor')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('note-editor')).toBeHidden();
		await expect(card).toBeFocused();
	});

	test('Scenario: Card action buttons are reachable and named for keyboard and screen-reader users (RGAA 7.1, 11.9)', async ({
		authenticatedPage: page
	}) => {
		await visit(page, '/');
		const card = noteCard(page, 'A11y coral');
		const buttons = card.getByRole('button');
		const count = await buttons.count();
		expect(count, 'card should expose its actions as buttons').toBeGreaterThan(0);
		for (let i = 0; i < count; i++) {
			const name = await buttons.nth(i).evaluate((el) => {
				const b = el as HTMLElement;
				return b.getAttribute('aria-label') || b.textContent?.trim() || b.getAttribute('title') || '';
			});
			expect(name, `button ${i} on the card needs an accessible name`).not.toBe('');
		}
	});
});
