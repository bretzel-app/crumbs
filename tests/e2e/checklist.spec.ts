import { test, expect, noteCard } from './helpers/fixtures.js';
import type { Page } from '@playwright/test';

/** Toggle checklist mode via the overflow menu. */
async function toggleChecklistMode(page: Page) {
	await page.getByTestId('overflow-menu-btn').click();
	await page.getByTestId('checklist-toggle').click();
}

/** Create a checklist note via UI. Leaves the editor closed. */
async function createChecklistNote(page: Page, title: string, items: string[]) {
	await page.getByTestId('new-note-btn').click();
	await page.getByTestId('note-title-input').fill(title);
	await toggleChecklistMode(page);
	for (let i = 0; i < items.length; i++) {
		await page.getByTestId('checklist-input').nth(i).focus();
		await page.keyboard.type(items[i]);
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
		await toggleChecklistMode(page);

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
		await expect(page.getByTestId('checklist-input').first()).toHaveText('Buy milk');
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

	test('Scenario: Sequential check and uncheck both persist correctly', async ({ authenticatedPage: page }) => {
		// Given a checklist note with an item "Buy milk" exists
		await createChecklistNote(page, 'Tasks2', ['Buy milk']);

		// When the user checks the item and closes
		await noteCard(page, 'Tasks2').click();
		await page.getByTestId('checklist-checkbox').first().click();
		await expect(page.getByTestId('checklist-toggle-done')).toContainText('1 done');
		await page.getByTestId('close-editor-btn').click();

		// Then the checked state persists
		await noteCard(page, 'Tasks2').click();
		await expect(page.getByTestId('checklist-done-checkbox').first()).toBeChecked();

		// When the user unchecks the item from the done section and closes
		await page.getByTestId('checklist-done-checkbox').first().click();
		await expect(page.getByTestId('checklist-checkbox')).toHaveCount(1);
		await page.getByTestId('close-editor-btn').click();

		// Then the unchecked state also persists (not reverted by 3-way merge)
		await noteCard(page, 'Tasks2').click();
		await expect(page.getByTestId('checklist-checkbox')).toHaveCount(1);
		await expect(page.getByTestId('checklist-input').first()).toHaveText('Buy milk');
	});

	test('Scenario: Enter key adds a new checklist item', async ({ authenticatedPage: page }) => {
		// Given a checklist with one item
		await page.getByTestId('new-note-btn').click();
		await toggleChecklistMode(page);
		await page.getByTestId('checklist-input').first().focus();
		await page.keyboard.type('First item');

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
		await expect(page.getByTestId('checklist-input').nth(1)).toHaveText('');
	});

	test('Scenario: Backspace on empty item removes it from the list', async ({ authenticatedPage: page }) => {
		// Given a checklist with two items where the second is empty
		await page.getByTestId('new-note-btn').click();
		await toggleChecklistMode(page);
		await page.getByTestId('checklist-input').first().focus();
		await page.keyboard.type('First item');
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
		await toggleChecklistMode(page);
		await page.getByTestId('checklist-input').first().focus();
		await page.keyboard.type('Done task');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).focus();
		await page.keyboard.type('Pending task');

		// When the user completes the first item
		await page.getByTestId('checklist-checkbox').first().click();

		// Then only the pending item remains in the active list
		await expect(page.getByTestId('checklist-input')).toHaveCount(1);
		await expect(page.getByTestId('checklist-input').first()).toHaveText('Pending task');

		// And the done section shows the completed item
		await expect(page.getByTestId('checklist-toggle-done')).toContainText('1 done');
		await expect(page.getByTestId('checklist-done-section')).toBeVisible();
		await expect(page.getByTestId('checklist-done-section')).toContainText('Done task');
	});

	test('Scenario: Arrow keys navigate between checklist items', async ({ authenticatedPage: page }) => {
		// Given a checklist with three items
		await page.getByTestId('new-note-btn').click();
		await toggleChecklistMode(page);
		await page.getByTestId('checklist-input').first().focus();
		await page.keyboard.type('First');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).focus();
		await page.keyboard.type('Second');
		await page.getByTestId('checklist-input').nth(1).press('Enter');
		await page.getByTestId('checklist-input').nth(2).focus();
		await page.keyboard.type('Third');

		// When the user presses ArrowUp from the third item
		await page.getByTestId('checklist-input').nth(2).press('ArrowUp');

		// Then focus moves to the second item
		await expect(page.getByTestId('checklist-input').nth(1)).toBeFocused();

		// When the user presses ArrowDown
		await page.getByTestId('checklist-input').nth(1).press('ArrowDown');

		// Then focus moves back to the third item
		await expect(page.getByTestId('checklist-input').nth(2)).toBeFocused();
	});

	test('Scenario: Tab indents an item and Shift+Tab outdents it', async ({ authenticatedPage: page }) => {
		// Given a checklist with two top-level items
		await page.getByTestId('new-note-btn').click();
		await toggleChecklistMode(page);
		await page.getByTestId('checklist-input').first().focus();
		await page.keyboard.type('Parent');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).focus();
		await page.keyboard.type('Child');

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
		await toggleChecklistMode(page);
		await page.getByTestId('checklist-input').first().focus();
		await page.keyboard.type('Buy groceries');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).focus();
		await page.keyboard.type('Milk');
		await page.getByTestId('checklist-input').nth(1).press('Tab');
		await page.getByTestId('checklist-input').nth(1).press('Enter');
		await page.getByTestId('checklist-input').nth(2).focus();
		await page.keyboard.type('Eggs');

		// When the user checks the parent
		await page.getByTestId('checklist-checkbox').first().click();

		// Then all items move to done section
		await expect(page.getByTestId('checklist-toggle-done')).toContainText('3 done');
		await expect(page.getByTestId('checklist-input')).toHaveCount(0);
	});

	test('Scenario: Checking a child shows read-only parent label in done section', async ({ authenticatedPage: page }) => {
		// Given a checklist with a parent and a child
		await page.getByTestId('new-note-btn').click();
		await toggleChecklistMode(page);
		await page.getByTestId('checklist-input').first().focus();
		await page.keyboard.type('Groceries');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).focus();
		await page.keyboard.type('Milk');
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
		await toggleChecklistMode(page);
		await page.getByTestId('checklist-input').first().focus();
		await page.keyboard.type('Shopping');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).focus();
		await page.keyboard.type('Milk');
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
		await toggleChecklistMode(page);
		await page.getByTestId('checklist-input').first().focus();
		await page.keyboard.type('Parent');
		await page.getByTestId('checklist-input').first().press('Enter');
		await page.getByTestId('checklist-input').nth(1).focus();
		await page.keyboard.type('Child 1');
		await page.getByTestId('checklist-input').nth(1).press('Tab');

		// When the user presses Enter on the child
		await page.getByTestId('checklist-input').nth(1).press('Enter');

		// Then a new child is created at the same level
		await expect(page.getByTestId('checklist-child-row')).toHaveCount(2);
		await expect(page.getByTestId('checklist-input').nth(2)).toBeFocused();
	});

	test('Scenario: NoteCard preview shows indentation for nested items', async ({ authenticatedPage: page }) => {
		// Given a checklist note with nested items
		await createChecklistNote(page, 'Indent Preview Note', ['Parent', 'Child']);
		await noteCard(page, 'Indent Preview Note').click();
		await page.getByTestId('checklist-input').nth(1).press('Tab');
		await page.getByTestId('close-editor-btn').click();

		// Then the NoteCard preview shows the child indented (scoped to this card)
		const card = noteCard(page, 'Indent Preview Note');
		await expect(card.getByTestId('card-checklist-child')).toHaveCount(1);
	});

	test('Scenario: Disabling checklist mode restores the rich text editor', async ({ authenticatedPage: page }) => {
		// Given checklist mode is enabled on a new note
		await page.getByTestId('new-note-btn').click();
		await toggleChecklistMode(page);
		await expect(page.getByTestId('checklist')).toBeVisible();

		// When the user disables checklist mode
		await toggleChecklistMode(page);

		// Then the rich text editor is displayed again
		await expect(page.getByTestId('tiptap-editor')).toBeVisible();
		await expect(page.getByTestId('checklist')).not.toBeVisible();
	});

	test('Scenario: Delete checked items removes only done items', async ({ authenticatedPage: page }) => {
		// Given a checklist note with two checked and one unchecked item
		await createChecklistNote(page, 'Cleanup', ['Keep me', 'Done 1', 'Done 2']);
		await noteCard(page, 'Cleanup').click();
		await page.getByTestId('checklist-checkbox').nth(1).click();
		await page.getByTestId('checklist-checkbox').nth(1).click();
		await expect(page.getByTestId('checklist-toggle-done')).toContainText('2 done');

		// When the user deletes checked items via the overflow menu
		await page.getByTestId('overflow-menu-btn').click();
		await page.getByTestId('delete-checked-btn').click();

		// Then only the unchecked item remains
		await expect(page.getByTestId('checklist-input')).toHaveCount(1);
		await expect(page.getByTestId('checklist-input').first()).toHaveText('Keep me');
		await expect(page.getByTestId('checklist-toggle-done')).not.toBeVisible();
	});

	test('Scenario: Uncheck all items moves everything back to active', async ({ authenticatedPage: page }) => {
		// Given a checklist note with checked items
		await createChecklistNote(page, 'Reset', ['Item A', 'Item B']);
		await noteCard(page, 'Reset').click();
		await page.getByTestId('checklist-checkbox').first().click();
		await page.getByTestId('checklist-checkbox').first().click();
		await expect(page.getByTestId('checklist-toggle-done')).toContainText('2 done');

		// When the user unchecks all via the overflow menu
		await page.getByTestId('overflow-menu-btn').click();
		await page.getByTestId('uncheck-all-btn').click();

		// Then all items are back in the active section
		await expect(page.getByTestId('checklist-input')).toHaveCount(2);
		await expect(page.getByTestId('checklist-toggle-done')).not.toBeVisible();
	});
});
