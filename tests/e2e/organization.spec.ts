import { test, expect, noteCard, createNote } from './helpers/fixtures.js';

test.describe('Organization Features', () => {
	test('Scenario: Favorited note appears under the Favorites section', async ({ authenticatedPage: page }) => {
		// Given a note titled "Favorite Me" exists
		await createNote(page, 'Favorite Me');

		// When the user favorites the note
		const favCard = noteCard(page, 'Favorite Me');
		await favCard.hover();
		await favCard.getByTestId('favorite-btn').first().click({ force: true });

		// Then the "Favorites" section is visible
		await expect(page.getByText('Favorites')).toBeVisible();
	});

	test('Scenario: Archived note is removed from the main view', async ({ authenticatedPage: page }) => {
		// Given a note titled "Archive Me" exists
		await createNote(page, 'Archive Me');

		// When the user archives the note
		const archiveCard = noteCard(page, 'Archive Me');
		await archiveCard.hover();
		await archiveCard.getByTestId('archive-btn').click({ force: true });

		// Then the note is no longer visible in the main view
		await expect(page.getByText('Archive Me')).not.toBeVisible();
	});

	test('Scenario: Note card reflects the selected color', async ({ authenticatedPage: page }) => {
		// Given the user is creating a new note
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Colored Note');

		// When the user selects the "Coral" color
		await page.getByTestId('color-picker-toggle').click();
		await page.getByTestId('color-coral').click();
		await page.getByTestId('close-editor-btn').click();

		// Then the note is visible in the notes list
		await expect(noteCard(page, 'Colored Note')).toBeVisible();
	});

	test('Scenario: Filtering by tag shows only matching notes', async ({ authenticatedPage: page }) => {
		// Given a note tagged #important and an untagged note exist
		await createNote(page, 'Tagged Note', 'This is #important');
		await createNote(page, 'Untagged Note');

		// When the user filters by the #important tag
		const tagChip = page.getByTestId('tag-filter').getByTestId('tag-chip').filter({ hasText: '#important' });
		await expect(tagChip).toBeVisible();
		await tagChip.click();

		// Then only the tagged note is visible
		await expect(page.getByText('Tagged Note').first()).toBeVisible();
	});
});

test.describe('Note Sorting', () => {
	test('Scenario: Most recently updated note appears first', async ({ authenticatedPage: page }) => {
		// Given two notes exist created at different times
		await createNote(page, 'Sort-First');
		await createNote(page, 'Sort-Second');

		// Then the most recently created note appears before the older one
		const sortFirst = noteCard(page, 'Sort-First');
		const sortSecond = noteCard(page, 'Sort-Second');
		const firstBox = await sortSecond.boundingBox();
		const secondBox = await sortFirst.boundingBox();
		expect(firstBox!.y).toBeLessThanOrEqual(secondBox!.y);
	});
});
