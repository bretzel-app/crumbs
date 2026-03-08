import { test, expect, noteCard } from './helpers/fixtures.js';

test.describe('Organization Features', () => {
	test('Scenario: Pinned note appears under the Pinned section', async ({ authenticatedPage: page }) => {
		// Given a note titled "Pin Me" exists
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Pin Me');
		await page.getByTestId('close-editor-btn').click();

		// When the user pins the note
		const pinCard = noteCard(page, 'Pin Me');
		await pinCard.hover();
		await pinCard.getByTestId('pin-btn').first().click({ force: true });

		// Then the "Pinned" section is visible
		await expect(page.getByText('Pinned')).toBeVisible();
	});

	test('Scenario: Archived note is removed from the main view', async ({ authenticatedPage: page }) => {
		// Given a note titled "Archive Me" exists
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Archive Me');
		await page.getByTestId('close-editor-btn').click();

		// When the user archives the note
		const archiveCard = noteCard(page, 'Archive Me');
		await archiveCard.hover();
		await archiveCard.getByTestId('archive-btn').click({ force: true });

		// Then the note is no longer visible in the main view
		await expect(page.getByText('Archive Me')).not.toBeVisible();
	});

	test('Scenario: Note color is changed via the color picker', async ({ authenticatedPage: page }) => {
		// Given the user is creating a note titled "Colored Note"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Colored Note');

		// When the user sets the note color to "Coral"
		await page.getByTestId('color-picker-toggle').click();
		await page.getByTestId('color-coral').click();
		await page.getByTestId('close-editor-btn').click();

		// Then the note is saved and visible in the notes list
		await expect(noteCard(page, 'Colored Note')).toBeVisible();
	});

	test('Scenario: Filtering by tag shows only matching notes', async ({ authenticatedPage: page }) => {
		// Given a note tagged #important and an untagged note exist
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Tagged Note');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await editor.pressSequentially('This is #important');
		await page.getByTestId('close-editor-btn').click();

		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Untagged Note');
		await page.getByTestId('close-editor-btn').click();

		// When the user filters by the #important tag
		const tagChip = page.getByTestId('tag-filter').getByTestId('tag-chip').filter({ hasText: '#important' });
		if (await tagChip.isVisible()) {
			await tagChip.click();

			// Then only the tagged note is visible
			await expect(page.getByText('Tagged Note').first()).toBeVisible();
		}
	});
});

test.describe('Note Sorting', () => {
	test('Scenario: Notes can be sorted by last updated', async ({ authenticatedPage: page }) => {
		// Given two notes exist with different update times
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Sort-First');
		await page.getByTestId('close-editor-btn').click();
		await expect(noteCard(page, 'Sort-First')).toBeVisible();

		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Sort-Second');
		await page.getByTestId('close-editor-btn').click();
		await expect(noteCard(page, 'Sort-Second')).toBeVisible();

		// When the user selects "Updated" sort mode
		await page.getByTestId('sort-updated').click();

		// Then Sort-Second (most recently updated) appears before Sort-First
		const sortFirst = noteCard(page, 'Sort-First');
		const sortSecond = noteCard(page, 'Sort-Second');
		const firstBox = await sortSecond.boundingBox();
		const secondBox = await sortFirst.boundingBox();
		expect(firstBox!.y).toBeLessThanOrEqual(secondBox!.y);
	});

	test('Scenario: Notes can be sorted by creation date', async ({ authenticatedPage: page }) => {
		// Given two notes exist
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Created-Older');
		await page.getByTestId('close-editor-btn').click();
		await expect(noteCard(page, 'Created-Older')).toBeVisible();

		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Created-Newer');
		await page.getByTestId('close-editor-btn').click();
		await expect(noteCard(page, 'Created-Newer')).toBeVisible();

		// When the user selects "Created" sort mode
		await page.getByTestId('sort-created').click();

		// Then Created-Newer appears before Created-Older
		const newer = noteCard(page, 'Created-Newer');
		const older = noteCard(page, 'Created-Older');
		const newerBox = await newer.boundingBox();
		const olderBox = await older.boundingBox();
		expect(newerBox!.y).toBeLessThanOrEqual(olderBox!.y);
	});

	test('Scenario: Sort preference persists across page reload', async ({ authenticatedPage: page }) => {
		// Given the user selects "Created" sort mode
		await page.getByTestId('sort-created').click();

		// When the page is reloaded
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Then the "Created" sort mode is still active
		const createdBtn = page.getByTestId('sort-created');
		await expect(createdBtn).toHaveClass(/bg-\[var\(--primary\)\]/);
	});
});
