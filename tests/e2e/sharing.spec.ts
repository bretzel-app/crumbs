import { test, expect, noteCard } from './helpers/fixtures.js';
import type { Page } from '@playwright/test';

/**
 * Create a note via API and share it with the collaborator.
 * Returns the note object (with id).
 */
async function createSharedNote(
	ownerPage: Page,
	collabPage: Page,
	title: string,
	content = 'Shared content'
) {
	// Create note
	const res = await ownerPage.request.post('/api/notes', {
		data: { title, content }
	});
	const note = await res.json();

	// Find the collab user ID
	const usersRes = await ownerPage.request.get('/api/users/search?q=collab');
	const users = await usersRes.json();
	const collabUser = users[0];

	// Share the note
	await ownerPage.request.post(`/api/notes/${note.id}/collaborators`, {
		data: { userId: collabUser.id }
	});

	return note;
}

test.describe('Note Sharing', () => {
	test('Scenario: Owner shares a note via UI and collaborator sees it', async ({
		authenticatedPage: page,
		collabPage
	}) => {
		// Given a note titled "Share Test" exists
		await page.request.post('/api/notes', {
			data: { title: 'Share Test', content: 'Shared content' }
		});
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(noteCard(page, 'Share Test')).toBeVisible();

		// And the owner opens the share dialog and adds the collaborator
		await noteCard(page, 'Share Test').click();
		await page.getByTestId('share-toggle').click();
		await expect(page.getByTestId('share-dialog')).toBeVisible();
		await page.getByTestId('share-search-input').fill('collab');
		await expect(page.getByTestId('share-user-result').first()).toBeVisible({ timeout: 5000 });
		await page.getByTestId('share-user-result').first().click();
		await expect(page.getByTestId('share-collaborator')).toBeVisible();
		await page.getByTestId('share-dialog-overlay').click({ position: { x: 10, y: 10 } });
		await page.getByTestId('close-editor-btn').click();

		// Then the owner sees a sharing indicator
		await expect(noteCard(page, 'Share Test').getByTestId('sharing-indicator')).toBeVisible();

		// And the collaborator sees the shared note in their list
		await collabPage.reload();
		await collabPage.waitForLoadState('networkidle');
		await expect(noteCard(collabPage, 'Share Test')).toBeVisible({ timeout: 10000 });
	});

	test('Scenario: Collaborator can edit shared note and owner sees changes', async ({
		authenticatedPage: page,
		collabPage
	}) => {
		// Given a shared note exists
		const note = await createSharedNote(page, collabPage, 'Collab Edit Test');

		// When the collaborator edits the note via API
		await collabPage.request.patch(`/api/notes/${note.id}`, {
			data: { content: 'Edited by collaborator' }
		});

		// Then the owner sees the updated content
		const ownerRes = await page.request.get(`/api/notes/${note.id}`);
		const ownerNote = await ownerRes.json();
		expect(ownerNote.content).toBe('Edited by collaborator');
	});

	test('Scenario: Owner and collaborator have independent per-user state', async ({
		authenticatedPage: page,
		collabPage
	}) => {
		// Given a shared note exists
		const note = await createSharedNote(page, collabPage, 'Pin Independence Test');

		// When the collaborator pins the note
		await collabPage.request.patch(`/api/notes/${note.id}`, {
			data: { pinned: true }
		});

		// Then the collaborator sees it as pinned
		const collabRes = await collabPage.request.get(`/api/notes/${note.id}`);
		const collabNote = await collabRes.json();
		expect(collabNote.pinned).toBeTruthy();

		// But the owner does not see it as pinned
		const ownerRes = await page.request.get(`/api/notes/${note.id}`);
		const ownerNote = await ownerRes.json();
		expect(ownerNote.pinned).toBeFalsy();
	});

	test('Scenario: Sync returns correct data for both owner and collaborator', async ({
		authenticatedPage: page,
		collabPage
	}) => {
		// Given a shared note exists
		const note = await createSharedNote(page, collabPage, 'Sync Round-trip Test');

		// When the owner updates the content
		await page.request.patch(`/api/notes/${note.id}`, {
			data: { content: 'Owner sync update' }
		});

		// Then the collaborator sees the change via sync endpoint
		const syncRes = await collabPage.request.get(`/api/sync?since=0`);
		const syncedNotes = await syncRes.json();
		const syncedNote = syncedNotes.find((n: { id: string }) => n.id === note.id);
		expect(syncedNote).toBeDefined();
		expect(syncedNote.content).toBe('Owner sync update');
	});

	test('Scenario: Both users\' edits to different fields are preserved after concurrent PATCH', async ({
		authenticatedPage: page,
		collabPage
	}) => {
		// Given a shared checklist note exists
		const note = await createSharedNote(
			page,
			collabPage,
			'Shopping List',
			'- [ ] Milk\n- [ ] Bread\n- [ ] Eggs'
		);

		// When the owner checks Milk
		await page.request.patch(`/api/notes/${note.id}`, {
			data: { content: '- [x] Milk\n- [ ] Bread\n- [ ] Eggs', baseVersion: note.version }
		});

		// And the collaborator adds Butter (based on the same original version)
		await collabPage.request.patch(`/api/notes/${note.id}`, {
			data: { content: '- [ ] Milk\n- [ ] Bread\n- [ ] Eggs\n- [ ] Butter', baseVersion: note.version }
		});

		// Then both changes are preserved via content merge
		const res = await page.request.get(`/api/notes/${note.id}`);
		const merged = await res.json();
		expect(merged.content).toContain('- [x] Milk');
		expect(merged.content).toContain('- [ ] Butter');
		expect(merged.content).toContain('- [ ] Bread');
		expect(merged.content).toContain('- [ ] Eggs');
	});

	test('Scenario: Collaborator sees leave action and can leave a shared note', async ({
		authenticatedPage: page,
		collabPage
	}) => {
		// Given a shared note exists
		const note = await createSharedNote(page, collabPage, 'Leave Test Note');

		// When the collaborator views their notes
		await collabPage.reload();
		await collabPage.waitForLoadState('networkidle');
		await expect(noteCard(collabPage, 'Leave Test Note')).toBeVisible({ timeout: 10000 });

		// Then the collaborator's card shows a leave button, not trash
		const card = noteCard(collabPage, 'Leave Test Note');
		await card.hover();
		await expect(card.getByTestId('leave-btn')).toBeVisible();
		await expect(card.getByTestId('trash-btn')).not.toBeVisible();

		// When the collaborator leaves
		await card.getByTestId('leave-btn').click({ force: true });

		// Then the note disappears from the collaborator's list
		await expect(noteCard(collabPage, 'Leave Test Note')).not.toBeVisible({ timeout: 5000 });

		// But the owner still has it
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(noteCard(page, 'Leave Test Note')).toBeVisible();
	});
});
