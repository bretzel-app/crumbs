import { test, expect, noteCard, createNote } from './helpers/fixtures.js';

test.describe('Auto-save', () => {
	test('Scenario: New note is auto-saved without closing the editor', async ({ authenticatedPage: page }) => {
		// When the user starts a new note and types a title and content
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Auto-saved Note');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await editor.pressSequentially('This should be saved automatically');

		// Then the note is persisted after the auto-save delay (2s debounce)
		await expect(noteCard(page, 'Auto-saved Note')).toBeVisible({ timeout: 5000 });

		// And closing the editor preserves the note
		await page.getByTestId('close-editor-btn').click();
		await expect(noteCard(page, 'Auto-saved Note')).toBeVisible();
	});

	test('Scenario: Edits to an existing note are auto-saved', async ({ authenticatedPage: page }) => {
		// Given a note titled "Edit Me" exists
		await createNote(page, 'Edit Me', 'Original content');

		// When the user opens the note and changes the title
		await noteCard(page, 'Edit Me').click();
		await page.getByTestId('note-title-input').clear();
		await page.getByTestId('note-title-input').fill('Edited Title');

		// Then the updated title is auto-saved after the debounce delay
		// Wait for the API call that confirms the save
		await page.waitForResponse(
			(res) => res.url().includes('/api/notes/') && res.request().method() === 'PATCH',
			{ timeout: 5000 }
		);

		// And the note card reflects the change while editor is still open
		await expect(noteCard(page, 'Edited Title')).toBeVisible();

		// Cleanup: close the editor
		await page.getByTestId('close-editor-btn').click();
	});

	test('Scenario: Empty note is not auto-saved', async ({ authenticatedPage: page }) => {
		// Given the current number of notes
		const noteCards = page.locator('[data-testid="note-card"]');
		const countBefore = await noteCards.count();

		// When the user opens a new note but leaves it empty
		await page.getByTestId('new-note-btn').click();

		// And waits longer than the auto-save delay
		await page.waitForTimeout(3000);

		// And closes the empty editor
		await page.getByTestId('close-editor-btn').click();

		// Then no new note was created
		const countAfter = await noteCards.count();
		expect(countAfter).toBe(countBefore);
	});

	test('Scenario: Auto-save persists note across page reload', async ({ authenticatedPage: page }) => {
		// When the user creates a note and waits for auto-save
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Survive Reload');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await editor.pressSequentially('Content that survives');

		// Wait for auto-save to fire
		await page.waitForResponse(
			(res) => res.url().includes('/api/notes') && res.request().method() === 'POST',
			{ timeout: 5000 }
		);

		// When the page is reloaded without closing the editor
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Then the note is still visible
		await expect(noteCard(page, 'Survive Reload')).toBeVisible();
	});
});
