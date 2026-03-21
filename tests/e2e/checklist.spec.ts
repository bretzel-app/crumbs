import { test, expect, noteCard } from './helpers/fixtures.js';
import type { Page } from '@playwright/test';

/** Create a checklist note via UI. Leaves the editor closed. */
async function createChecklistNote(page: Page, title: string, items: string[]) {
	await page.getByTestId('new-note-btn').click();
	await page.getByTestId('note-title-input').fill(title);
	await page.getByTestId('checklist-toggle').click();
	for (let i = 0; i < items.length; i++) {
		await page.getByTestId('checklist-input').nth(i).fill(items[i]);
		if (i < items.length - 1) {
			await page.getByTestId('checklist-input').nth(i).press('Enter');
		}
	}
	await page.getByTestId('close-editor-btn').click();
	await expect(noteCard(page, title)).toBeVisible();
}

test.describe('Checklist', () => {
	test('Scenario: Checklist replaces the rich text editor when enabled', async ({ authenticatedPage: page }) => {
		// Given the user is creating a new note
		await page.getByTestId('new-note-btn').click();

		// When the user enables checklist mode
		await page.getByTestId('checklist-toggle').click();

		// Then the checklist component is displayed
		await expect(page.getByTestId('checklist')).toBeVisible();

		// And the rich text editor is hidden
		await expect(page.getByTestId('tiptap-editor')).not.toBeVisible();
	});

	test('Scenario: Checklist item persists after closing and reopening the note', async ({ authenticatedPage: page }) => {
		// Given a checklist note with an item "Buy milk" exists
		await createChecklistNote(page, 'Shopping List', ['Buy milk']);

		// When the user reopens the note
		await noteCard(page, 'Shopping List').click();

		// Then the checklist is displayed with the saved item
		await expect(page.getByTestId('checklist')).toBeVisible();
		await expect(page.getByTestId('checklist-input').first()).toHaveValue('Buy milk');
	});

	test('Scenario: Checked item moves to the done section', async ({ authenticatedPage: page }) => {
		// Given a checklist note with an item "Buy milk" exists
		await createChecklistNote(page, 'Tasks', ['Buy milk']);

		// When the user reopens the note and checks the item
		await noteCard(page, 'Tasks').click();
		await page.getByTestId('checklist-checkbox').first().click();

		// Then the item moves to the done section
		await expect(page.getByTestId('checklist-toggle-done')).toContainText('1 done');
		await page.getByTestId('close-editor-btn').click();

		// And the done state persists after reopening
		await noteCard(page, 'Tasks').click();
		await expect(page.getByTestId('checklist-done-checkbox').first()).toBeChecked();
	});

	test('Scenario: Enter key adds a new checklist item', async ({ authenticatedPage: page }) => {
		// Given a checklist with one item
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('First item');

		// When the user presses Enter
		await page.getByTestId('checklist-input').first().press('Enter');

		// Then a second checklist item appears
		await expect(page.getByTestId('checklist-input')).toHaveCount(2);
	});

	test('Scenario: Enter key focuses new item on reopened note with checked items before active ones', async ({ authenticatedPage: page }) => {
		// Given a saved checklist note where checked items precede active items
		// (this happens when reopening a note — parseChecklist preserves the
		// saved order rather than grouping active items first)
		await createChecklistNote(page, 'Groceries', ['Milk', 'Eggs', 'Bread', 'Butter']);

		// Reopen and check items 1 and 2 so saved content has checked items first
		await noteCard(page, 'Groceries').click();
		await page.getByTestId('checklist-checkbox').nth(0).click(); // Milk → done
		await page.getByTestId('checklist-checkbox').nth(0).click(); // Eggs (now first active) → done
		await page.getByTestId('close-editor-btn').click();

		// Reopen — parseChecklist restores saved order: [x]Milk, [x]Eggs, [ ]Bread, [ ]Butter
		// The checked items precede active ones in items[], but only active ones render as inputs
		await noteCard(page, 'Groceries').click();
		await expect(page.getByTestId('checklist-input')).toHaveCount(2); // Bread, Butter active

		// When the user presses Enter on the first active item (Bread)
		await page.getByTestId('checklist-input').first().press('Enter');

		// Then focus moves to the newly created empty item
		await expect(page.getByTestId('checklist-input')).toHaveCount(3);
		await expect(page.getByTestId('checklist-input').nth(1)).toBeFocused();
		await expect(page.getByTestId('checklist-input').nth(1)).toHaveValue('');
	});

	test('Scenario: Backspace on empty item removes it from the list', async ({ authenticatedPage: page }) => {
		// Given a checklist with two items where the second is empty
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('First item');
		await page.getByTestId('checklist-input').first().press('Enter');
		await expect(page.getByTestId('checklist-input')).toHaveCount(2);

		// When the user presses Backspace on the empty item
		await page.getByTestId('checklist-input').nth(1).press('Backspace');

		// Then only the first item remains
		await expect(page.getByTestId('checklist-input')).toHaveCount(1);
	});

	test('Scenario: Completed items are separated into a done section', async ({ authenticatedPage: page }) => {
		// Given a checklist note with two items
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Hide Done Test');
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('Done task');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).fill('Pending task');

		// When the user completes the first item
		await page.getByTestId('checklist-checkbox').first().click();

		// Then only the pending item remains in the active list
		await expect(page.getByTestId('checklist-input')).toHaveCount(1);
		await expect(page.getByTestId('checklist-input').first()).toHaveValue('Pending task');

		// And the done section shows the completed item
		await expect(page.getByTestId('checklist-toggle-done')).toContainText('1 done');
		await expect(page.getByTestId('checklist-done-section')).toBeVisible();
		await expect(page.getByTestId('checklist-done-section')).toContainText('Done task');
	});

	test('Scenario: Tab indents an item and Shift+Tab outdents it', async ({ authenticatedPage: page }) => {
		// Given a checklist with two top-level items
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('Parent');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).fill('Child');

		// When the user presses Tab on the second item
		await page.getByTestId('checklist-input').nth(1).press('Tab');

		// Then the item becomes indented
		await expect(page.getByTestId('checklist-child-row')).toHaveCount(1);

		// When the user presses Shift+Tab
		await page.getByTestId('checklist-input').nth(1).press('Shift+Tab');

		// Then the item returns to top-level
		await expect(page.getByTestId('checklist-child-row')).toHaveCount(0);
	});

	test('Scenario: Checking a parent checks all its children', async ({ authenticatedPage: page }) => {
		// Given a checklist with a parent and two children
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('Buy groceries');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).fill('Milk');
		await page.getByTestId('checklist-input').nth(1).press('Tab');
		await page.getByTestId('checklist-input').nth(1).press('Enter');
		await page.getByTestId('checklist-input').nth(2).fill('Eggs');

		// When the user checks the parent
		await page.getByTestId('checklist-checkbox').first().click();

		// Then all items move to done section
		await expect(page.getByTestId('checklist-toggle-done')).toContainText('3 done');
		await expect(page.getByTestId('checklist-input')).toHaveCount(0);
	});

	test('Scenario: Checking a child shows read-only parent label in done section', async ({ authenticatedPage: page }) => {
		// Given a checklist with a parent and a child
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('Groceries');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).fill('Milk');
		await page.getByTestId('checklist-input').nth(1).press('Tab');

		// When the user checks only the child
		await page.getByTestId('checklist-checkbox').nth(1).click();

		// Then the done section shows a parent label above the checked child
		await expect(page.getByTestId('checklist-toggle-done')).toContainText('1 done');
		await expect(page.getByTestId('checklist-done-parent-label')).toBeVisible();
		await expect(page.getByTestId('checklist-done-parent-label')).toContainText('Groceries');
	});

	test('Scenario: Unchecking a parent from done restores group to active', async ({ authenticatedPage: page }) => {
		// Given a checklist with a parent and child, all checked
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('Shopping');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).fill('Milk');
		await page.getByTestId('checklist-input').nth(1).press('Tab');
		await page.getByTestId('checklist-checkbox').first().click();
		await expect(page.getByTestId('checklist-toggle-done')).toContainText('2 done');

		// When the user unchecks the parent from the done section
		await page.getByTestId('checklist-done-checkbox').first().click();

		// Then both parent and child return to active
		await expect(page.getByTestId('checklist-input')).toHaveCount(2);
		await expect(page.getByTestId('checklist-child-row')).toHaveCount(1);
	});

	test('Scenario: Nested items persist after close and reopen', async ({ authenticatedPage: page }) => {
		// Given a checklist with nested items
		await createChecklistNote(page, 'Nested Persist', ['Parent', 'Child']);

		// Reopen and indent the second item
		await noteCard(page, 'Nested Persist').click();
		await page.getByTestId('checklist-input').nth(1).press('Tab');
		await expect(page.getByTestId('checklist-child-row')).toHaveCount(1);
		await page.getByTestId('close-editor-btn').click();

		// When the user reopens the note
		await noteCard(page, 'Nested Persist').click();

		// Then the nesting is preserved
		await expect(page.getByTestId('checklist-child-row')).toHaveCount(1);
	});

	test('Scenario: Enter on a child creates a sibling at the same level', async ({ authenticatedPage: page }) => {
		// Given a checklist with a parent and a child
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('checklist-toggle').click();
		await page.getByTestId('checklist-input').first().fill('Parent');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).fill('Child 1');
		await page.getByTestId('checklist-input').nth(1).press('Tab');

		// When the user presses Enter on the child
		await page.getByTestId('checklist-input').nth(1).press('Enter');

		// Then a new child is created at the same level
		await expect(page.getByTestId('checklist-child-row')).toHaveCount(2);
		await expect(page.getByTestId('checklist-input').nth(2)).toBeFocused();
	});

	test('Scenario: NoteCard preview shows indentation for nested items', async ({ authenticatedPage: page }) => {
		// Given a checklist note with nested items
		await createChecklistNote(page, 'Preview Indent', ['Parent', 'Child']);
		await noteCard(page, 'Preview Indent').click();
		await page.getByTestId('checklist-input').nth(1).press('Tab');
		await page.getByTestId('close-editor-btn').click();

		// Then the NoteCard preview shows the child indented
		await expect(page.getByTestId('card-checklist-child')).toHaveCount(1);
	});

	test('Scenario: Disabling checklist mode restores the rich text editor', async ({ authenticatedPage: page }) => {
		// Given checklist mode is enabled on a new note
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
