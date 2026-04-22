import { test, expect } from './helpers/fixtures.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { TEST_CREDENTIALS_FILE } from './global-setup';

const { userPassword } = JSON.parse(readFileSync(TEST_CREDENTIALS_FILE, 'utf-8'));

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE_PATH = join(__dirname, 'helpers', 'test-image.png');

/** Create a victim user via the admin API, returning the user's id. */
async function createVictim(
	page: import('@playwright/test').Page,
	email: string,
	displayName = email.split('@')[0]
): Promise<number> {
	const res = await page.request.post('/api/admin/users', {
		data: { email, displayName, password: userPassword, role: 'user' }
	});
	expect(res.status()).toBe(201);
	const user = await res.json();
	return user.id;
}

test.describe.serial('Admin — User Deletion', () => {
	test('Scenario: Admin deletes a user from the users list', async ({
		authenticatedPage: page
	}) => {
		// Given a disposable user exists
		const victimId = await createVictim(page, 'delete-me@test.com', 'Delete Me');

		// When the admin navigates to the users settings page
		await page.goto('/settings/users');
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId(`user-row-${victimId}`)).toBeVisible();

		// And accepts the confirmation dialog for deletion
		page.once('dialog', (dialog) => dialog.accept());

		const deleteResponse = page.waitForResponse(
			(res) => res.url().endsWith(`/api/admin/users/${victimId}`) && res.request().method() === 'DELETE'
		);
		await page.getByTestId(`delete-user-btn-${victimId}`).click();
		const res = await deleteResponse;

		// Then the delete request succeeds
		expect(res.status()).toBe(200);

		// And the user disappears from the list
		await expect(page.getByTestId(`user-row-${victimId}`)).toHaveCount(0);

		// And the list is reloaded correctly on refresh (backend is consistent)
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId(`user-row-${victimId}`)).toHaveCount(0);
	});

	test('Scenario: Deletion is cancelled when the admin dismisses the confirmation', async ({
		authenticatedPage: page
	}) => {
		// Given a user exists
		const victimId = await createVictim(page, 'keep-me@test.com', 'Keep Me');

		// When the admin navigates to the users settings page
		await page.goto('/settings/users');
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId(`user-row-${victimId}`)).toBeVisible();

		// And dismisses the confirmation dialog
		page.once('dialog', (dialog) => dialog.dismiss());
		await page.getByTestId(`delete-user-btn-${victimId}`).click();

		// Then the user remains in the list
		await expect(page.getByTestId(`user-row-${victimId}`)).toBeVisible();

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: Deleting a user with notes, tags, and attachments succeeds', async ({
		authenticatedPage: page,
		browser
	}) => {
		// Given a user with full data exists (note, tag, attachment, preferences, api key)
		const email = 'heavy-user@test.com';
		const victimId = await createVictim(page, email, 'Heavy User');

		// Log in as the victim in a fresh context so they create their own data
		const ctx = await browser.newContext();
		const victimPage = await ctx.newPage();
		await victimPage.goto('/login');
		await victimPage.getByTestId('email-input').fill(email);
		await victimPage.getByTestId('password-input').fill(userPassword);
		await victimPage.getByTestId('login-btn').click();
		await victimPage.waitForURL('/');

		// Create a note with a tag
		const noteRes = await victimPage.request.post('/api/notes', {
			data: { title: 'Victim Note #todo', content: 'content #work' }
		});
		expect(noteRes.ok()).toBe(true);
		const note = await noteRes.json();

		// Upload an attachment on the note. Use a browser-context fetch so the
		// Origin header is set correctly for SvelteKit's CSRF check.
		const imageBase64 = readFileSync(TEST_IMAGE_PATH).toString('base64');
		const attachmentStatus = await victimPage.evaluate(
			async ({ noteId, base64 }) => {
				const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
				const form = new FormData();
				form.append('file', new Blob([bytes], { type: 'image/png' }), 'test-image.png');
				const r = await fetch(`/api/notes/${noteId}/attachments`, {
					method: 'POST',
					body: form
				});
				return r.status;
			},
			{ noteId: note.id, base64: imageBase64 }
		);
		expect(attachmentStatus).toBe(201);

		// Write a preference and create an API key to exercise every table
		await victimPage.request.put('/api/preferences', {
			data: { defaultNoteMode: 'markdown' }
		});
		await victimPage.request.post('/api/settings/api-keys', { data: { name: 'test-key' } });

		await ctx.close();

		// When the admin deletes the user with all their data
		await page.goto('/settings/users');
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId(`user-row-${victimId}`)).toBeVisible();

		page.once('dialog', (dialog) => dialog.accept());
		const deleteResponse = page.waitForResponse(
			(res) => res.url().endsWith(`/api/admin/users/${victimId}`) && res.request().method() === 'DELETE'
		);
		await page.getByTestId(`delete-user-btn-${victimId}`).click();
		const res = await deleteResponse;

		// Then the delete succeeds atomically (no partial state)
		expect(res.status()).toBe(200);
		await expect(page.getByTestId(`user-row-${victimId}`)).toHaveCount(0);

		// And the user cannot log in afterwards
		const loginRes = await page.request.post('/api/auth/login', {
			data: { email, password: userPassword }
		});
		expect(loginRes.status()).toBe(401);
	});
});
