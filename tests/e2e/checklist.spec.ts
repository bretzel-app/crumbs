import { test, expect, noteCard } from './helpers/fixtures.js';

test.describe('Checklist', () => {
	test('Scenario: Checklist UI replaces editor when checklist mode is enabled', async ({ authenticatedPage: page }) => {
		// Given the user is creating a new note
		await page.getByTestId('new-note-btn').click();

		// When the user enables checklist mode
		await page.getByTestId('checklist-toggle').click();

		// Then the checklist component is displayed
		await expect(page.getByTestId('checklist')).toBeVisible();

		// And the rich text editor is hidden
		await expect(page.getByTestId('tiptap-editor')).not.toBeVisible();
	});

	test('Scenario: Checklist item can be added and persisted', async ({ authenticatedPage: page }) => {
		// When the user creates a checklist note with an item "Buy milk"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Shopping List');
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('Buy milk');
		await page.getByTestId('close-editor-btn').click();

		// Then the note appears in the list
		await expect(page.getByText('Shopping List')).toBeVisible();

		// When the user reopens the note
		await noteCard(page, 'Shopping List').click();

		// Then the checklist is displayed with the saved item
		await expect(page.getByTestId('checklist')).toBeVisible();
		await expect(page.getByTestId('checklist-input').first()).toHaveValue('Buy milk');
	});

	test('Scenario: Checking an item marks it as completed', async ({ authenticatedPage: page }) => {
		// Given a checklist note with an item "Buy milk"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Tasks');
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('Buy milk');
		await page.getByTestId('close-editor-btn').click();

		// When the user reopens the note and checks the item
		await noteCard(page, 'Tasks').click();
		await page.getByTestId('checklist-checkbox').first().click();

		// Then the item moves to the done section
		await expect(page.getByTestId('checklist-toggle-done')).toContainText('1 done');
		await page.getByTestId('close-editor-btn').click();

		// And reopening the note shows the item in the done section (expanded by default)
		await noteCard(page, 'Tasks').click();
		await expect(page.getByTestId('checklist-done-checkbox').first()).toBeChecked();
	});

	test('Scenario: New checklist item is added by pressing Enter', async ({ authenticatedPage: page }) => {
		// Given the user is editing a checklist note
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('First item');

		// When the user presses Enter
		await page.getByTestId('checklist-input').first().press('Enter');

		// Then a second checklist item appears
		await expect(page.getByTestId('checklist-input')).toHaveCount(2);
	});

	test('Scenario: Empty checklist item is removed by pressing Backspace', async ({ authenticatedPage: page }) => {
		// Given a checklist note with two items
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('First item');
		await page.getByTestId('checklist-input').first().press('Enter');
		await expect(page.getByTestId('checklist-input')).toHaveCount(2);

		// When the user presses Backspace on the empty second item
		await page.getByTestId('checklist-input').nth(1).press('Backspace');

		// Then only the first item remains
		await expect(page.getByTestId('checklist-input')).toHaveCount(1);
	});

	test('Scenario: Completed checklist items are separated and can be expanded', async ({ authenticatedPage: page }) => {
		// Given a checklist note with a completed item and an uncompleted item
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Hide Done Test');
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('Done task');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).fill('Pending task');
		await page.getByTestId('checklist-checkbox').first().click();

		// Then the completed item is separated from the active list
		await expect(page.getByTestId('checklist-input')).toHaveCount(1);
		await expect(page.getByTestId('checklist-input').first()).toHaveValue('Pending task');

		// And the "done" toggle shows the count
		await expect(page.getByTestId('checklist-toggle-done')).toBeVisible();
		await expect(page.getByTestId('checklist-toggle-done')).toContainText('1 done');

		// Then the completed items are shown in the done section (expanded by default)
		await expect(page.getByTestId('checklist-done-section')).toBeVisible();
		await expect(page.getByTestId('checklist-done-section')).toContainText('Done task');
	});

	test('Scenario: Switching back from checklist mode restores the text area', async ({ authenticatedPage: page }) => {
		// Given the user has checklist mode enabled
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await expect(page.getByTestId('checklist')).toBeVisible();

		// When the user disables checklist mode
		await page.getByTestId('checklist-toggle').click();

		// Then the rich text editor is displayed again
		await expect(page.getByTestId('tiptap-editor')).toBeVisible();
		await expect(page.getByTestId('checklist')).not.toBeVisible();
	});
});
