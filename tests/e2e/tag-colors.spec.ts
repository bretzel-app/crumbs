import { test, expect, noteCard, createNote, gotoHydrated } from './helpers/fixtures.js';

// Light-theme card surfaces from NOTE_COLORS in src/lib/utils/colors.ts
const SAND = 'rgb(255, 248, 184)';
const CORAL = 'rgb(250, 175, 168)';
const DEFAULT = 'rgb(250, 245, 235)';

// Tag colours belong to the shared admin account, so every scenario uses its own tag
function uniqueTag(prefix: string) {
	return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

test.describe('Tag colours', () => {
	test('Scenario: Note without a colour of its own takes its tag colour', async ({ authenticatedPage: page }) => {
		// Given a note tagged with a tag that has no colour yet
		const tag = uniqueTag('network');
		await createNote(page, `Router ${tag}`, `ports #${tag}`);
		await expect(noteCard(page, `Router ${tag}`)).toHaveCSS('background-color', DEFAULT);

		// When the user gives the tag the Sand colour
		await gotoHydrated(page, '/settings/tags');
		const row = page.getByTestId('tag-color-row').filter({ hasText: `#${tag}` });
		await row.getByTestId('tag-color-toggle').click();
		await row.getByTestId('color-sand').click();

		// Then the note is shown in Sand
		await gotoHydrated(page, '/');
		await expect(noteCard(page, `Router ${tag}`)).toHaveCSS('background-color', SAND);
	});

	test('Scenario: Clearing the tag colour reverts its notes', async ({ authenticatedPage: page }) => {
		// Given a note tagged with a Sand tag
		const tag = uniqueTag('info');
		await page.request.put(`/api/tags/${tag}`, { data: { color: 'sand' } });
		await gotoHydrated(page, '/');
		await createNote(page, `Info ${tag}`, `see #${tag}`);
		await expect(noteCard(page, `Info ${tag}`)).toHaveCSS('background-color', SAND);

		// When the user clears the tag colour
		await gotoHydrated(page, '/settings/tags');
		const row = page.getByTestId('tag-color-row').filter({ hasText: `#${tag}` });
		await row.getByTestId('tag-color-toggle').click();
		await row.getByTestId('color-default').click();

		// Then the note is back to the default colour
		await gotoHydrated(page, '/');
		await expect(noteCard(page, `Info ${tag}`)).toHaveCSS('background-color', DEFAULT);
	});

	test('Scenario: Colour picked on the note wins over its tag colour', async ({ authenticatedPage: page }) => {
		// Given a Sand tag
		const tag = uniqueTag('urgent');
		await page.request.put(`/api/tags/${tag}`, { data: { color: 'sand' } });

		// When the user creates a Coral note with that tag
		await gotoHydrated(page, '/');
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill(`Coral ${tag}`);
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await editor.pressSequentially(`call back #${tag}`);
		await page.getByTestId('color-picker-toggle').click();
		await page.getByTestId('color-coral').click();
		await page.getByTestId('close-editor-btn').click();

		// Then the note stays Coral
		await expect(noteCard(page, `Coral ${tag}`)).toHaveCSS('background-color', CORAL);
	});

	test('Scenario: Tags no note uses are not listed', async ({ authenticatedPage: page }) => {
		// Given a coloured tag that no note mentions, and one that a note does
		const unused = uniqueTag('unused');
		const used = uniqueTag('used');
		await page.request.put(`/api/tags/${unused}`, { data: { color: 'sand' } });
		await createNote(page, `Tagged ${used}`, `about #${used}`);

		// When the user opens the tag settings
		await gotoHydrated(page, '/settings/tags');

		// Then only the tag in use is listed
		const rows = page.getByTestId('tag-color-row');
		await expect(rows.filter({ hasText: `#${used}` })).toBeVisible();
		await expect(rows.filter({ hasText: `#${unused}` })).toHaveCount(0);
	});
});
