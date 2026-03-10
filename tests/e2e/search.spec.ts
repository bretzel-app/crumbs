import { test, expect, noteCard } from './helpers/fixtures.js';

test.describe('Search', () => {
	test('Scenario: Searching by title returns the matching note', async ({ authenticatedPage: page }) => {
		// Given a note titled "Grocery Errands" and a note titled "Work Meeting" exist
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Grocery Errands');
		await page.getByTestId('close-editor-btn').click();

		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Work Meeting');
		await page.getByTestId('close-editor-btn').click();

		// When the user searches for "Grocery"
		await page.getByTestId('search-input').fill('Grocery');

		// Then "Grocery Errands" is visible in the results
		await expect(page.getByText('Grocery Errands')).toBeVisible();
	});

	test('Scenario: Searching by content returns the matching note', async ({ authenticatedPage: page }) => {
		// Given a note titled "Recipe" with content "Pasta with tomato sauce" exists
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Recipe');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await editor.pressSequentially('Pasta with tomato sauce');
		await page.getByTestId('close-editor-btn').click();

		// When the user searches for "tomato"
		await page.getByTestId('search-input').fill('tomato');

		// Then "Recipe" is visible in the results
		await expect(page.getByText('Recipe')).toBeVisible();
	});

	test('Scenario: Searching for a nonexistent term yields no results', async ({ authenticatedPage: page }) => {
		// When the user searches for a term that matches nothing
		await page.getByTestId('search-input').fill('xyznonexistent');

		// Then no notes are displayed
		await expect(page.getByTestId('note-card')).toHaveCount(0);
	});
});
