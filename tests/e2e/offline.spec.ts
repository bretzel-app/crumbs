import { test, expect, noteCard, createNote } from './helpers/fixtures.js';

test.describe('Offline Support', () => {
	test('Scenario: Sync status indicator is visible on the main page', async ({ authenticatedPage: page }) => {
		// Given the user is authenticated
		// Then the sync status indicator is displayed
		await expect(page.getByTestId('sync-indicator')).toBeVisible();
	});

	test('Scenario: Created note is immediately visible in the notes list', async ({ authenticatedPage: page }) => {
		// When the user creates a note titled "Offline Test Note"
		await createNote(page, 'Offline Test Note');

		// Then the note appears in the list
		await expect(page.getByText('Offline Test Note')).toBeVisible();
	});

	test('Scenario: Edited note persists in the UI when offline', async ({ authenticatedPage: page }) => {
		// Given a note titled "Offline Edit" exists
		await createNote(page, 'Offline Edit');

		// When the network is unavailable
		await page.context().setOffline(true);

		// And the user edits the note title to "Offline Edited"
		await noteCard(page, 'Offline Edit').click();
		await page.getByTestId('note-title-input').clear();
		await page.getByTestId('note-title-input').fill('Offline Edited');
		await page.getByTestId('close-editor-btn').click();

		// Then the updated note appears in the list
		await expect(page.getByText('Offline Edited')).toBeVisible();

		// And an offline save confirmation is shown
		await expect(page.getByText('Saved offline')).toBeVisible();
	});

	test('Scenario: New note appears in the UI when created offline', async ({ authenticatedPage: page }) => {
		// When the network is unavailable
		await page.context().setOffline(true);

		// And the user creates a note titled "Offline New"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Offline New');
		await page.getByTestId('close-editor-btn').click();

		// Then the note appears in the list
		await expect(page.getByText('Offline New')).toBeVisible();

		// And an offline save confirmation is shown
		await expect(page.getByText('Saved offline')).toBeVisible();
	});

	test('Scenario: Offline note survives a page reload after reconnecting', async ({ authenticatedPage: page }) => {
		// Given the network is unavailable
		await page.context().setOffline(true);

		// And a note titled "Survive Reload" is created offline
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Survive Reload');
		await page.getByTestId('close-editor-btn').click();
		await expect(page.getByText('Survive Reload')).toBeVisible();

		// When the network is restored and sync completes
		const syncResponse = page.waitForResponse('**/api/sync');
		await page.context().setOffline(false);
		await syncResponse;

		// And the user reloads the page
		await page.reload();

		// Then the note is still visible
		await expect(page.getByText('Survive Reload')).toBeVisible();
	});

	test('Scenario: Notes load from local cache when the API is unavailable', async ({ authenticatedPage: page }) => {
		// Given a note titled "Cached Note" exists
		await createNote(page, 'Cached Note');

		// When the API becomes unavailable and the page is reloaded
		await page.route('**/api/**', (route) => route.abort());
		await page.reload();

		// Then the note is still visible from the local cache
		await expect(page.getByText('Cached Note')).toBeVisible();
	});

	test('Scenario: Trashed note disappears from the list when offline', async ({ authenticatedPage: page }) => {
		// Given a note titled "Offline Trash" exists
		await createNote(page, 'Offline Trash');

		// When the network is unavailable
		await page.context().setOffline(true);

		// And the user trashes the note
		const card = noteCard(page, 'Offline Trash');
		await card.hover();
		await card.getByTestId('trash-btn').click();

		// Then the note is no longer visible
		await expect(page.getByText('Offline Trash')).not.toBeVisible();

		// And an offline save confirmation is shown
		await expect(page.getByText('Saved offline')).toBeVisible();
	});
});
