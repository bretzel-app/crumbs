import { test, expect, noteCard } from './helpers/fixtures.js';
import type { Page } from '@playwright/test';

/**
 * Create a note via API and return it.
 */
async function createNoteViaApi(page: Page, title: string, content = 'Public share content') {
	const res = await page.request.post('/api/notes', {
		data: { title, content }
	});
	return res.json();
}

/**
 * Create a public share link for a note via API and return the token.
 */
async function createShareViaApi(page: Page, noteId: string): Promise<string> {
	const res = await page.request.post(`/api/notes/${noteId}/share`);
	const data = await res.json();
	return data.token;
}

test.describe('Public Note Sharing', () => {
	test('Scenario: User creates a public share link', async ({
		authenticatedPage: page
	}) => {
		// Given a note titled "Public Test" exists
		const note = await createNoteViaApi(page, 'Public Test', 'Hello world');
		await page.reload();
		await page.waitForLoadState('networkidle');

		// When the owner opens the share dialog and enables the public link
		await noteCard(page, 'Public Test').click();
		await page.getByTestId('share-toggle').click();
		await expect(page.getByTestId('share-dialog')).toBeVisible();
		await page.getByTestId('public-share-toggle').click();

		// Then a share URL is displayed
		await expect(page.getByTestId('share-url-container')).toBeVisible({ timeout: 5000 });
		const urlText = await page.getByTestId('share-url-text').textContent();
		expect(urlText).toContain('/s/');
	});

	test('Scenario: Public page renders note content without auth', async ({
		authenticatedPage: page,
		browser
	}) => {
		// Given a publicly shared note exists
		const note = await createNoteViaApi(page, 'Shared Publicly', 'This is **public** content');
		const token = await createShareViaApi(page, note.id);

		// When an unauthenticated user visits the share URL
		const context = await browser.newContext();
		const publicPage = await context.newPage();
		await publicPage.goto(`/s/${token}`);

		// Then the note content is rendered
		await expect(publicPage.getByTestId('shared-note')).toBeVisible();
		await expect(publicPage.getByTestId('shared-note-title')).toHaveText('Shared Publicly');
		await expect(publicPage.getByTestId('shared-note-content')).toContainText('public');

		await context.close();
	});

	test('Scenario: User revokes share and link returns 404', async ({
		authenticatedPage: page,
		browser
	}) => {
		// Given a publicly shared note exists
		const note = await createNoteViaApi(page, 'Revoke Test', 'Will be revoked');
		const token = await createShareViaApi(page, note.id);

		// And the public page is accessible
		const context = await browser.newContext();
		const publicPage = await context.newPage();
		await publicPage.goto(`/s/${token}`);
		await expect(publicPage.getByTestId('shared-note')).toBeVisible();

		// When the owner revokes the share
		const revokeRes = await page.request.delete(`/api/notes/${note.id}/share`);
		expect(revokeRes.status()).toBe(204);

		// Then the public page returns 404
		const res = await publicPage.request.get(`/api/shared/${token}`);
		expect(res.status()).toBe(404);

		await context.close();
	});

	test('Scenario: Trashed note share link returns 404', async ({
		authenticatedPage: page
	}) => {
		// Given a publicly shared note that is then trashed
		const note = await createNoteViaApi(page, 'Trash Share Test', 'Will be trashed');
		const token = await createShareViaApi(page, note.id);

		// When the note is trashed
		await page.request.patch(`/api/notes/${note.id}`, {
			data: { trashed: true }
		});

		// Then the shared API returns 404
		const res = await page.request.get(`/api/shared/${token}`);
		expect(res.status()).toBe(404);
	});

	test('Scenario: Globe icon appears on shared note card', async ({
		authenticatedPage: page
	}) => {
		// Given a note with a public share link
		const note = await createNoteViaApi(page, 'Globe Icon Test');
		await createShareViaApi(page, note.id);

		// When the user views the notes list
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Then the note card shows a sharing indicator
		const card = noteCard(page, 'Globe Icon Test');
		await expect(card).toBeVisible();
		await expect(card.getByTestId('sharing-indicator')).toBeVisible();
	});

	test('Scenario: Copy link button copies to clipboard', async ({
		authenticatedPage: page
	}) => {
		// Given a note with a public share link
		const note = await createNoteViaApi(page, 'Copy Link Test');
		await createShareViaApi(page, note.id);
		await page.reload();
		await page.waitForLoadState('networkidle');

		// When the owner opens the share dialog
		await noteCard(page, 'Copy Link Test').click();
		await page.getByTestId('share-toggle').click();
		await expect(page.getByTestId('share-dialog')).toBeVisible();

		// Then the share URL is already visible (token was created via API)
		await expect(page.getByTestId('share-url-container')).toBeVisible({ timeout: 5000 });

		// And clicking copy shows the check icon
		// Grant clipboard permissions for the test
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.getByTestId('copy-share-url-btn').click();

		// The clipboard should contain the share URL
		const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
		expect(clipboardText).toContain('/s/');
	});
});
