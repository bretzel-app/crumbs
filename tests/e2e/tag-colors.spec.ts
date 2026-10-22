import { test, expect, noteCard, gotoHydrated } from './helpers/fixtures.js';
import type { Page } from '@playwright/test';

// Card surfaces from NOTE_COLORS / NOTE_COLORS_DARK in src/lib/utils/colors.ts. Both themes are
// listed because the theme follows the shared admin's preferences, which other specs change.
const CARD_RGB = {
	light: { default: 'rgb(250, 245, 235)', sand: 'rgb(255, 248, 184)', coral: 'rgb(250, 175, 168)' },
	dark: { default: 'rgb(33, 32, 31)', sand: 'rgb(60, 55, 27)', coral: 'rgb(63, 31, 28)' }
};

async function expectCardColor(page: Page, title: string, color: keyof typeof CARD_RGB.light) {
	// Re-read the theme on every retry: another worker can flip it mid-assertion
	await expect(async () => {
		const theme = await page.evaluate(() =>
			document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
		);
		await expect(noteCard(page, title)).toHaveCSS('background-color', CARD_RGB[theme][color], {
			timeout: 1000
		});
	}).toPass();
}

// Tag colours belong to the shared admin account, so every scenario uses its own tag
function uniqueTag(prefix: string) {
	return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Created through the API rather than the editor: the editor's mode follows the shared
// admin's preferences, which settings.spec changes while other workers run
async function givenNote(page: Page, title: string, content: string, color = 'default') {
	const res = await page.request.post('/api/notes', { data: { title, content, color } });
	expect(res.ok()).toBe(true);
}

/** Pick a colour for the tag on the settings page and wait until the server has it. */
async function pickTagColor(page: Page, tag: string, color: string) {
	const row = page.getByTestId('tag-color-row').filter({ hasText: `#${tag}` });
	await row.getByTestId('tag-color-toggle').click();
	const saved = page.waitForResponse(
		(res) => res.url().endsWith(`/api/tags/${tag}`) && res.request().method() === 'PUT'
	);
	await row.getByTestId(`color-${color}`).click();
	expect((await saved).ok()).toBe(true);
}

async function givenTagColor(page: Page, tag: string, color: string) {
	const res = await page.request.put(`/api/tags/${tag}`, { data: { color } });
	expect(res.ok()).toBe(true);
}

test.describe('Tag colours', () => {
	test('Scenario: Note without a colour of its own takes its tag colour', async ({ authenticatedPage: page }) => {
		// Given a note tagged with a tag that has no colour yet
		const tag = uniqueTag('network');
		await givenNote(page, `Router ${tag}`, `ports #${tag}`);
		await gotoHydrated(page, '/');
		await expectCardColor(page, `Router ${tag}`, 'default');

		// When the user gives the tag the Sand colour
		await gotoHydrated(page, '/settings/tags');
		await pickTagColor(page, tag, 'sand');

		// Then the note is shown in Sand
		await gotoHydrated(page, '/');
		await expectCardColor(page, `Router ${tag}`, 'sand');
	});

	test('Scenario: Clearing the tag colour reverts its notes', async ({ authenticatedPage: page }) => {
		// Given a note tagged with a Sand tag
		const tag = uniqueTag('info');
		await givenTagColor(page, tag, 'sand');
		await givenNote(page, `Info ${tag}`, `see #${tag}`);
		await gotoHydrated(page, '/');
		await expectCardColor(page, `Info ${tag}`, 'sand');

		// When the user clears the tag colour
		await gotoHydrated(page, '/settings/tags');
		await pickTagColor(page, tag, 'default');

		// Then the note is back to the default colour
		await gotoHydrated(page, '/');
		await expectCardColor(page, `Info ${tag}`, 'default');
	});

	test('Scenario: Colour picked on the note wins over its tag colour', async ({ authenticatedPage: page }) => {
		// Given a Coral note tagged with a Sand tag
		const tag = uniqueTag('urgent');
		await givenTagColor(page, tag, 'sand');
		await givenNote(page, `Coral ${tag}`, `call back #${tag}`, 'coral');

		// When the user views their notes
		await gotoHydrated(page, '/');

		// Then the note stays Coral
		await expectCardColor(page, `Coral ${tag}`, 'coral');
	});

	test('Scenario: Tags no note uses are not listed', async ({ authenticatedPage: page }) => {
		// Given a coloured tag that no note mentions, and one that a note does
		const unused = uniqueTag('unused');
		const used = uniqueTag('used');
		await givenTagColor(page, unused, 'sand');
		await givenNote(page, `Tagged ${used}`, `about #${used}`);

		// When the user opens the tag settings
		await gotoHydrated(page, '/settings/tags');

		// Then only the tag in use is listed
		const rows = page.getByTestId('tag-color-row');
		await expect(rows.filter({ hasText: `#${used}` })).toBeVisible();
		await expect(rows.filter({ hasText: `#${unused}` })).toHaveCount(0);
	});
});
