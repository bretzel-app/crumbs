import { test, expect, TEST_EMAIL } from './helpers/fixtures.js';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';
import { TEST_CREDENTIALS_FILE } from './global-setup';

const { userPassword } = JSON.parse(readFileSync(TEST_CREDENTIALS_FILE, 'utf-8'));

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE_PATH = join(__dirname, 'helpers', 'test-image.png');
const TEST_DB = './data/test-crumbs.db';

/** Link a user row to an OAuth provider in the test database (simulates first SSO sign-in). */
function linkUserToOAuth(userId: number, provider = 'google', providerId?: string): void {
	const db = new Database(TEST_DB);
	db.prepare('UPDATE users SET auth_provider = ?, provider_id = ? WHERE id = ?').run(
		provider,
		providerId ?? `test-${userId}`,
		userId
	);
	db.close();
}

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

/**
 * Create a victim user with no password via the admin API, returning the user's id.
 * Omitting the password is the OAuth-only path: createUser() stores authProvider
 * 'none' with passwordLoginEnabled false until an admin reset enables it.
 */
async function createOAuthOnlyVictim(
	page: import('@playwright/test').Page,
	email: string,
	displayName = email.split('@')[0]
): Promise<number> {
	const res = await page.request.post('/api/admin/users', {
		data: { email, displayName, role: 'user' }
	});
	expect(res.status()).toBe(201);
	const user = await res.json();
	expect(user.authProvider).toBe('none');
	expect(user.passwordLoginEnabled).toBe(false);
	return user.id;
}

/** The id of the admin account the authenticated page is signed in as. */
async function currentAdminId(page: import('@playwright/test').Page): Promise<number> {
	const res = await page.request.get('/api/admin/users');
	expect(res.status()).toBe(200);
	const users = (await res.json()) as Array<{ id: number; email: string }>;
	const admin = users.find((u) => u.email === TEST_EMAIL);
	if (!admin) throw new Error(`admin ${TEST_EMAIL} is missing from the users list`);
	return admin.id;
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

test.describe.serial('Admin — Password Reset', () => {
	test('Scenario: An account can sign in with a password the admin set', async ({
		authenticatedPage: page,
		browser
	}) => {
		// Given a password-auth user exists
		const email = 'reset-target@test.com';
		const victimId = await createVictim(page, email, 'Reset Target');

		// When the admin sets a new password for that account
		const newPassword = `reset-${randomUUID()}`;
		const res = await page.request.patch(`/api/admin/users/${victimId}`, {
			data: { newPassword }
		});

		// Then the reset succeeds
		expect(res.status()).toBe(200);

		// And the account can sign in with the new password. A separate browser
		// context keeps the resulting session cookie out of the admin's jar.
		const ctx = await browser.newContext();
		const loginRes = await ctx.request.post('/api/auth/login', {
			data: { email, password: newPassword }
		});
		expect(loginRes.status()).toBe(200);
		await ctx.close();

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: An OAuth-only account can be given a password by an admin', async ({
		authenticatedPage: page,
		browser
	}) => {
		// Given an OAuth-only user exists
		const email = 'oauth-only@test.com';
		const victimId = await createOAuthOnlyVictim(page, email, 'OAuth Only');

		// When the admin sets a password for that account
		const newPassword = `oauth-pw-${randomUUID()}`;
		const res = await page.request.patch(`/api/admin/users/${victimId}`, {
			data: { newPassword }
		});

		// Then the reset succeeds and enables password login
		expect(res.status()).toBe(200);
		const updated = await res.json();
		expect(updated.passwordLoginEnabled).toBe(true);

		// And the account can sign in with the new password while keeping OAuth
		const ctx = await browser.newContext();
		const loginRes = await ctx.request.post('/api/auth/login', {
			data: { email, password: newPassword }
		});
		expect(loginRes.status()).toBe(200);
		await ctx.close();

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: A password reset revokes all existing sessions', async ({
		authenticatedPage: page,
		browser
	}) => {
		// Given a password-auth user with an active session
		const email = 'revoke-on-reset@test.com';
		const victimId = await createVictim(page, email, 'Revoke Reset');
		const ctx = await browser.newContext();
		const loginRes = await ctx.request.post('/api/auth/login', {
			data: { email, password: userPassword }
		});
		expect(loginRes.status()).toBe(200);

		// When the admin sets a new password for that account
		const newPassword = `revoke-${randomUUID()}`;
		const resetRes = await page.request.patch(`/api/admin/users/${victimId}`, {
			data: { newPassword }
		});
		expect(resetRes.status()).toBe(200);

		// Then the old session is no longer valid
		expect((await ctx.request.get('/api/notes')).status()).toBe(401);
		await ctx.close();

		// And the new password still works
		const fresh = await browser.newContext();
		expect(
			(
				await fresh.request.post('/api/auth/login', {
					data: { email, password: newPassword }
				})
			).status()
		).toBe(200);
		await fresh.close();

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: An admin can disable password login on an OAuth-linked user', async ({
		authenticatedPage: page
	}) => {
		// Given an OAuth-linked user with password login enabled
		const email = 'disable-pw@test.com';
		const victimId = await createVictim(page, email, 'Disable Pw');
		linkUserToOAuth(victimId);

		// When the admin disables password login for that account
		const res = await page.request.patch(`/api/admin/users/${victimId}`, {
			data: { disablePasswordLogin: true }
		});

		// Then password login is off and the old password no longer works
		expect(res.status()).toBe(200);
		expect((await res.json()).passwordLoginEnabled).toBe(false);
		expect(
			(await page.request.post('/api/auth/login', { data: { email, password: userPassword } }))
				.status()
		).toBe(401);

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: An admin cannot reset their own password', async ({
		authenticatedPage: page
	}) => {
		// Given the admin's own account
		const adminId = await currentAdminId(page);

		// When the admin targets their own account for a password reset
		const res = await page.request.patch(`/api/admin/users/${adminId}`, {
			data: { newPassword: `self-${randomUUID()}` }
		});

		// Then the attempt is rejected and the response says why
		expect(res.status()).toBe(400);
		const body = await res.json();
		expect(body.message).toMatch(/your own password/i);
	});

	test('Scenario: A password below the minimum length is rejected for its length, whatever the account', async ({
		authenticatedPage: page
	}) => {
		// Given an OAuth-only user exists, who is also ineligible for a reset
		const victimId = await createOAuthOnlyVictim(page, 'short-pw-oauth@test.com', 'Short Pw');

		// When the admin attempts to set a password shorter than the minimum
		const res = await page.request.patch(`/api/admin/users/${victimId}`, {
			data: { newPassword: 'short' }
		});

		// Then the length rule is what the response reports, taking precedence
		// over the eligibility rule
		expect(res.status()).toBe(400);
		const body = await res.json();
		expect(body.message).toMatch(/at least 8 characters/i);

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});
});

/** Open the users settings page and wait for it to hydrate. */
async function openUsersPage(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/settings/users');
	await page.waitForLoadState('networkidle');
}

/**
 * Reset a row's password through the UI and return the revealed plaintext.
 * Trimmed because the reveal is markup-formatted text, not a form value.
 */
async function resetViaUi(
	page: import('@playwright/test').Page,
	victimId: number
): Promise<string> {
	await page.getByTestId(`reset-password-btn-${victimId}`).click();
	const reveal = page.getByTestId(`generated-password-${victimId}`);
	await expect(reveal).toBeVisible();
	const revealed = (await reveal.textContent())?.trim() ?? '';
	expect(revealed.length).toBeGreaterThanOrEqual(8);
	return revealed;
}

/**
 * The four row action buttons, in DOM order, named by their accessible name. An
 * eligible row that is not the signed-in admin's own offers all four.
 */
const ROW_ACTION_LABELS = [
	'Promote to admin',
	'Reset password',
	'Disable password login',
	'Revoke all sessions',
	'Delete user'
] as const;

test.describe('Admin — Password Reset UI', () => {
	test('Scenario: Every user row offers a reset control, and an unavailable one says why', async ({
		authenticatedPage: page
	}) => {
		// Given a password-auth user and an OAuth-only user exist
		const eligibleId = await createVictim(page, 'ui-reason-pw@test.com', 'UI Reason Pw');
		const oauthId = await createOAuthOnlyVictim(page, 'ui-reason-oauth@test.com', 'UI Reason OAuth');
		const adminId = await currentAdminId(page);

		// When the admin views the users list
		const patchedIds: string[] = [];
		page.on('request', (req) => {
			if (req.method() === 'PATCH' && req.url().includes('/api/admin/users/')) {
				patchedIds.push(req.url());
			}
		});
		await openUsersPage(page);

		// Then the control is offered on every row, including the admin's own
		for (const id of [eligibleId, oauthId, adminId]) {
			await expect(page.getByTestId(`reset-password-btn-${id}`)).toBeVisible();
		}

		// And it is available for both password and OAuth-only accounts
		for (const id of [eligibleId, oauthId]) {
			await expect(page.getByTestId(`reset-password-btn-${id}`)).toHaveAttribute(
				'aria-disabled',
				'false'
			);
			await expect(page.getByTestId(`reset-password-reason-${id}`)).toHaveCount(0);
		}

		// And the admin's own row points them at their profile instead
		const ownBtn = page.getByTestId(`reset-password-btn-${adminId}`);
		await expect(ownBtn).toHaveAttribute('aria-disabled', 'true');
		await expect(page.getByTestId(`reset-password-reason-${adminId}`)).toContainText(/Profile/i);

		// And an unavailable control stays reachable by keyboard
		await expect(ownBtn).not.toHaveAttribute('disabled', /.*/);
		await ownBtn.focus();
		await expect(ownBtn).toBeFocused();

		// And activating the admin's own control changes nothing
		await ownBtn.click({ force: true });
		await expect(page.getByTestId(`generated-password-${adminId}`)).toHaveCount(0);
		expect(patchedIds).toEqual([]);

		// Clean up
		await page.request.delete(`/api/admin/users/${eligibleId}`);
		await page.request.delete(`/api/admin/users/${oauthId}`);
	});

	test('Scenario: An account signs in with the password the admin generated, and its old one stops working', async ({
		authenticatedPage: page,
		browser
	}) => {
		// Given a password-auth user exists
		const email = 'ui-roundtrip@test.com';
		const victimId = await createVictim(page, email, 'UI Roundtrip');
		await openUsersPage(page);

		// And the announcement region is present and silent
		await expect(page.getByTestId('reset-password-live')).toHaveText('');

		// When the admin resets that account's password
		const patch = page.waitForResponse(
			(res) =>
				res.url().endsWith(`/api/admin/users/${victimId}`) && res.request().method() === 'PATCH'
		);
		const revealed = await resetViaUi(page, victimId);
		expect((await patch).status()).toBe(200);

		// Then the reveal is announced
		await expect(page.getByTestId('reset-password-live')).toContainText(/password/i);

		// And that row's control is unavailable until the reveal is dismissed
		await expect(page.getByTestId(`reset-password-btn-${victimId}`)).toHaveAttribute(
			'aria-disabled',
			'true'
		);

		// And the account signs in with the generated password, from a context whose
		// cookie jar is separate from the admin's
		const ctx = await browser.newContext();
		const newLogin = await ctx.request.post('/api/auth/login', {
			data: { email, password: revealed }
		});
		expect(newLogin.status()).toBe(200);

		// And the password it had before is refused. 401 exactly: a 429 would mean the
		// shared test IP is rate-limited, which proves nothing about the credential.
		const oldLogin = await ctx.request.post('/api/auth/login', {
			data: { email, password: userPassword }
		});
		expect(oldLogin.status()).toBe(401);
		await ctx.close();

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: A revealed password is never persisted or logged', async ({
		authenticatedPage: page
	}) => {
		// Given a password-auth user exists
		const victimId = await createVictim(page, 'ui-nostore@test.com', 'UI No Store');
		const consoleMessages: string[] = [];
		page.on('console', (msg) => consoleMessages.push(msg.text()));
		await openUsersPage(page);

		// When the admin resets that account's password
		const revealed = await resetViaUi(page, victimId);

		// Then the plaintext reaches no persistent client storage
		const leaks = await page.evaluate(async (secret: string) => {
			const hits: string[] = [];
			const scanWebStorage = (store: Storage, label: string) => {
				for (let i = 0; i < store.length; i++) {
					const key = store.key(i);
					if (key === null) continue;
					if (key.includes(secret) || (store.getItem(key) ?? '').includes(secret)) {
						hits.push(`${label}:${key}`);
					}
				}
			};
			scanWebStorage(localStorage, 'localStorage');
			scanWebStorage(sessionStorage, 'sessionStorage');

			const databases = (await indexedDB.databases?.()) ?? [];
			for (const info of databases) {
				if (!info.name) continue;
				const db = await new Promise<IDBDatabase>((resolve, reject) => {
					const request = indexedDB.open(info.name as string);
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
				for (const storeName of Array.from(db.objectStoreNames)) {
					const records = await new Promise<unknown[]>((resolve, reject) => {
						const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
						request.onsuccess = () => resolve(request.result);
						request.onerror = () => reject(request.error);
					});
					let serialised = '';
					try {
						serialised = JSON.stringify(records) ?? '';
					} catch {
						serialised = '';
					}
					if (serialised.includes(secret)) hits.push(`indexedDB:${info.name}/${storeName}`);
				}
				db.close();
			}
			return hits;
		}, revealed);
		expect(leaks).toEqual([]);

		// And it appears in no console output
		expect(consoleMessages.filter((m) => m.includes(revealed))).toEqual([]);

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: A revealed password is shown whole on a phone-sized screen', async ({
		authenticatedPage: page
	}) => {
		// Given a password-auth user seen on a 360px-wide screen
		const victimId = await createVictim(page, 'ui-narrow@test.com', 'UI Narrow');
		await page.setViewportSize({ width: 360, height: 800 });
		await openUsersPage(page);

		// When the admin resets that account's password
		const revealed = await resetViaUi(page, victimId);

		// Then none of it is clipped away — truncating it would quietly corrupt the
		// fallback of copying it by hand
		const shown = await page.getByTestId(`generated-password-${victimId}`).evaluate((el) => ({
			scrollWidth: el.scrollWidth,
			clientWidth: el.clientWidth,
			text: (el.textContent ?? '').trim()
		}));
		expect(shown.text).toBe(revealed);
		expect(shown.clientWidth).toBeGreaterThan(0);
		expect(shown.scrollWidth).toBeLessThanOrEqual(shown.clientWidth);

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: Copying a revealed password confirms that it was copied', async ({
		authenticatedPage: page
	}) => {
		// Given a password-auth user exists and the clipboard is available
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
		const victimId = await createVictim(page, 'ui-copy-ok@test.com', 'UI Copy Ok');
		await openUsersPage(page);

		// When the admin resets the password and copies it
		const revealed = await resetViaUi(page, victimId);
		await page.getByTestId(`copy-password-btn-${victimId}`).click();

		// Then the copy is confirmed and the clipboard holds the password
		await expect(page.getByTestId(`copy-status-${victimId}`)).toContainText(/copied/i);
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(revealed);

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: A refused clipboard leaves the password copyable by hand', async ({
		authenticatedPage: page
	}) => {
		// Given a password-auth user exists and the clipboard refuses writes.
		// defineProperty, not assignment: navigator.clipboard is a getter-only
		// accessor, so assigning to it silently leaves the real API in place.
		const victimId = await createVictim(page, 'ui-copy-denied@test.com', 'UI Copy Denied');
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'clipboard', {
				configurable: true,
				get: () => ({
					writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError'))
				})
			});
		});
		await openUsersPage(page);

		// When the admin resets the password and tries to copy it
		const revealed = await resetViaUi(page, victimId);
		await page.getByTestId(`copy-password-btn-${victimId}`).click();

		// Then the failure is reported as a manual-copy fallback
		await expect(page.getByTestId(`copy-status-${victimId}`)).toContainText(/by hand|manually/i);

		// And the password is still shown, selectable, for copying by hand
		const reveal = page.getByTestId(`generated-password-${victimId}`);
		await expect(reveal).toBeVisible();
		expect((await reveal.textContent())?.trim()).toBe(revealed);
		expect(await reveal.evaluate((el) => getComputedStyle(el).userSelect)).not.toBe('none');

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: Dismissing a reveal clears the password and leaves focus on that row', async ({
		authenticatedPage: page
	}) => {
		// Given a password-auth user whose password was just reset
		const victimId = await createVictim(page, 'ui-dismiss@test.com', 'UI Dismiss');
		await openUsersPage(page);
		await resetViaUi(page, victimId);

		// When the admin dismisses the reveal
		await page.getByTestId(`dismiss-password-btn-${victimId}`).click();

		// Then the password is gone from the page
		await expect(page.getByTestId(`generated-password-${victimId}`)).toHaveCount(0);
		await expect(page.getByTestId(`copy-password-btn-${victimId}`)).toHaveCount(0);

		// And focus is back on that row's control, which is available again
		const btn = page.getByTestId(`reset-password-btn-${victimId}`);
		await expect(btn).toBeFocused();
		await expect(btn).toHaveAttribute('aria-disabled', 'false');

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: Each of the three controls is large enough to hit on a phone', async ({
		authenticatedPage: page
	}) => {
		// Given a password-auth user exists, seen on a phone-sized screen
		const victimId = await createVictim(page, 'ui-target@test.com', 'UI Target');
		await page.setViewportSize({ width: 360, height: 800 });
		await openUsersPage(page);

		// When the admin resets that account's password
		await resetViaUi(page, victimId);

		// Then every control in the flow meets the 44px minimum. Dismiss destroys the
		// only copy of the credential, so a cramped target is a data-loss risk.
		for (const testId of [
			`reset-password-btn-${victimId}`,
			`copy-password-btn-${victimId}`,
			`dismiss-password-btn-${victimId}`
		]) {
			const box = await page.getByTestId(testId).boundingBox();
			expect(box, testId).not.toBeNull();
			expect(Math.min(box!.width, box!.height), testId).toBeGreaterThanOrEqual(44);
		}

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: Row actions stay full-size square targets at every phone width', async ({
		authenticatedPage: page
	}) => {
		// Given an OAuth-linked user, whose row therefore offers all five actions
		// (the disable-password control is only offered where another sign-in
		// method exists)
		const victimId = await createVictim(page, 'ui-strip@test.com', 'UI Strip');
		linkUserToOAuth(victimId);

		// The strip fits four of its five 44px squares on one line and wraps the
		// fifth below it at every phone width, so all three widths exercise the
		// wrap case; 300px is narrow enough that a strip which refused to wrap
		// would be pushed clear of its row, which the containment check below
		// then catches.
		for (const [width, fitsOneLine] of [
			[360, false],
			[320, false],
			[300, false]
		] as const) {
			// When the admin views the users list on a screen that wide
			await page.setViewportSize({ width, height: 800 });
			await openUsersPage(page);
			const row = page.getByTestId(`user-row-${victimId}`);

			const boxes = [];
			for (const label of ROW_ACTION_LABELS) {
				const box = await row.getByRole('button', { name: label, exact: true }).boundingBox();
				expect(box, `${label} at ${width}px`).not.toBeNull();
				boxes.push(box!);
			}

			// Then every action is a square that clears the 44px minimum. One of them
			// deletes an account irreversibly, so an action that shrank to fit its row
			// would put a data-losing target under a thumb.
			for (const [i, box] of boxes.entries()) {
				const at = `${ROW_ACTION_LABELS[i]} at ${width}px`;
				expect(Math.min(box.width, box.height), at).toBeGreaterThanOrEqual(44);
				expect(Math.abs(box.width - box.height), at).toBeLessThan(1);
			}

			// And they sit on one line wherever there is room for one
			const lines = new Set(boxes.map((box) => Math.round(box.y)));
			if (fitsOneLine) expect(lines.size, `lines at ${width}px`).toBe(1);

			// And where there is not, they wrap rather than spill out of their row or
			// push the page sideways
			const rowBox = await row.boundingBox();
			expect(rowBox, `row at ${width}px`).not.toBeNull();
			for (const [i, box] of boxes.entries()) {
				expect(box.x + box.width, `${ROW_ACTION_LABELS[i]} at ${width}px`).toBeLessThanOrEqual(
					rowBox!.x + rowBox!.width
				);
			}
			const overflows = await page.evaluate(
				() => document.documentElement.scrollWidth > document.documentElement.clientWidth
			);
			expect(overflows, `horizontal overflow at ${width}px`).toBe(false);
		}

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: A refused reset reports the server reason and reveals no password', async ({
		authenticatedPage: page
	}) => {
		// Given a user the server refuses to reset — an account whose sign-in method
		// changed after the list was loaded, so the row still looks eligible
		const victimId = await createVictim(page, 'ui-rejected@test.com', 'UI Rejected');
		const serverReason = 'Managed by SSO — password login is disabled for this account.';
		await openUsersPage(page);
		await page.route(`**/api/admin/users/${victimId}`, async (route) => {
			if (route.request().method() !== 'PATCH') return route.continue();
			await route.fulfill({
				status: 400,
				contentType: 'application/json',
				body: JSON.stringify({ message: serverReason })
			});
		});

		// When the admin resets that account's password
		await page.getByTestId(`reset-password-btn-${victimId}`).click();

		// Then the refusal is shown in that row, and announced
		await expect(page.getByTestId(`reset-password-error-${victimId}`)).toContainText(serverReason);
		await expect(page.getByTestId('reset-password-live')).toContainText(serverReason);

		// And no password is revealed
		await expect(page.getByTestId(`generated-password-${victimId}`)).toHaveCount(0);

		// And the control no longer invites a retry that would fail the same way
		const btn = page.getByTestId(`reset-password-btn-${victimId}`);
		await expect(btn).toHaveAttribute('aria-disabled', 'true');
		await expect(page.getByTestId(`reset-password-reason-${victimId}`)).toContainText(serverReason);

		// And dismissing the message keeps that explanation in place
		await page.getByTestId(`dismiss-password-btn-${victimId}`).click();
		await expect(page.getByTestId(`reset-password-error-${victimId}`)).toHaveCount(0);
		await expect(btn).toBeFocused();
		await expect(btn).toHaveAttribute('aria-disabled', 'true');

		// Clean up
		await page.unroute(`**/api/admin/users/${victimId}`);
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: A reset whose outcome is unknown keeps the generated password', async ({
		authenticatedPage: page
	}) => {
		// Given a user whose reset response never arrives, so the server may or may
		// not have stored the new password
		const victimId = await createVictim(page, 'ui-unknown@test.com', 'UI Unknown');
		await openUsersPage(page);
		await page.route(`**/api/admin/users/${victimId}`, async (route) => {
			if (route.request().method() !== 'PATCH') return route.continue();
			await route.abort('connectionreset');
		});

		// When the admin resets that account's password
		await page.getByTestId(`reset-password-btn-${victimId}`).click();

		// Then the uncertainty is stated
		await expect(page.getByTestId(`reset-password-error-${victimId}`)).toContainText(
			/may or may not/i
		);

		// And the generated password is kept, because it may be the account's only
		// working credential and nothing else holds a copy of it
		const reveal = page.getByTestId(`generated-password-${victimId}`);
		await expect(reveal).toBeVisible();
		expect(((await reveal.textContent()) ?? '').trim().length).toBeGreaterThanOrEqual(8);
		await expect(page.getByTestId(`copy-password-btn-${victimId}`)).toBeVisible();

		// Clean up
		await page.unroute(`**/api/admin/users/${victimId}`);
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: A server-side failure keeps the generated password even when it gives a reason', async ({
		authenticatedPage: page
	}) => {
		// Given a user whose reset fails inside the server, with a reason attached —
		// a reason says why the server is unhappy, never whether it already stored
		// the password, so the outcome is unknown however readable the body is
		const victimId = await createVictim(page, 'ui-5xx-reason@test.com', 'UI 5xx Reason');
		await openUsersPage(page);
		await page.route(`**/api/admin/users/${victimId}`, async (route) => {
			if (route.request().method() !== 'PATCH') return route.continue();
			await route.fulfill({
				status: 503,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Database is temporarily read-only.' })
			});
		});

		// When the admin resets that account's password
		await page.getByTestId(`reset-password-btn-${victimId}`).click();

		// Then the uncertainty is stated rather than the server's reason being taken
		// as a refusal
		await expect(page.getByTestId(`reset-password-error-${victimId}`)).toContainText(
			/may or may not/i
		);

		// And the generated password is kept, because the server may already hold it
		const reveal = page.getByTestId(`generated-password-${victimId}`);
		await expect(reveal).toBeVisible();
		expect(((await reveal.textContent()) ?? '').trim().length).toBeGreaterThanOrEqual(8);

		// Clean up
		await page.unroute(`**/api/admin/users/${victimId}`);
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: A rejection nobody can read keeps the generated password', async ({
		authenticatedPage: page
	}) => {
		// Given a user whose reset comes back as an unreadable error page — what a
		// reverse proxy returns when it answers instead of the app, so the request may
		// have reached the server or may not have
		const victimId = await createVictim(page, 'ui-html-error@test.com', 'UI Html Error');
		await openUsersPage(page);
		await page.route(`**/api/admin/users/${victimId}`, async (route) => {
			if (route.request().method() !== 'PATCH') return route.continue();
			await route.fulfill({
				status: 400,
				contentType: 'text/html',
				body: '<html><body><h1>400 Bad Request</h1></body></html>'
			});
		});

		// When the admin resets that account's password
		await page.getByTestId(`reset-password-btn-${victimId}`).click();

		// Then the uncertainty is stated rather than the status alone being read as a
		// refusal
		await expect(page.getByTestId(`reset-password-error-${victimId}`)).toContainText(
			/may or may not/i
		);

		// And the generated password is kept, because nothing said it was not stored
		const reveal = page.getByTestId(`generated-password-${victimId}`);
		await expect(reveal).toBeVisible();
		expect(((await reveal.textContent()) ?? '').trim().length).toBeGreaterThanOrEqual(8);

		// And the control is not left explaining a reason it never received
		await expect(page.getByTestId(`reset-password-reason-${victimId}`)).toHaveCount(0);

		// Clean up
		await page.unroute(`**/api/admin/users/${victimId}`);
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: A reset attempted offline reports that nothing was changed', async ({
		authenticatedPage: page
	}) => {
		// Given a password-auth user exists and the browser has no connection
		const victimId = await createVictim(page, 'ui-offline@test.com', 'UI Offline');
		await openUsersPage(page);
		const patchRequests: string[] = [];
		page.on('request', (req) => {
			if (req.method() === 'PATCH') patchRequests.push(req.url());
		});
		await page.context().setOffline(true);

		// When the admin resets that account's password
		await page.getByTestId(`reset-password-btn-${victimId}`).click();

		// Then the outcome is stated as definite: nothing left the device
		await expect(page.getByTestId(`reset-password-error-${victimId}`)).toContainText(
			/offline.*nothing was changed/i
		);
		expect(patchRequests).toEqual([]);

		// And no password is revealed, since none was set
		await expect(page.getByTestId(`generated-password-${victimId}`)).toHaveCount(0);

		// Restore connectivity — Playwright does not reliably emit the online event
		await page.context().setOffline(false);
		await page.evaluate(() => window.dispatchEvent(new Event('online')));

		// Clean up
		await page.request.delete(`/api/admin/users/${victimId}`);
	});

	test('Scenario: One row\'s reset never touches another row', async ({
		authenticatedPage: page
	}) => {
		// Given two password-auth users exist
		const firstId = await createVictim(page, 'ui-isolation-a@test.com', 'UI Isolation A');
		const secondId = await createVictim(page, 'ui-isolation-b@test.com', 'UI Isolation B');
		await openUsersPage(page);

		// When the first account's password is reset
		const revealed = await resetViaUi(page, firstId);

		// Then the second row shows neither a password nor a message
		await expect(page.getByTestId(`generated-password-${secondId}`)).toHaveCount(0);
		await expect(page.getByTestId(`reset-password-error-${secondId}`)).toHaveCount(0);
		await expect(page.getByTestId(`reset-password-btn-${secondId}`)).toHaveAttribute(
			'aria-disabled',
			'false'
		);

		// And when the second account's reset is refused
		await page.route(`**/api/admin/users/${secondId}`, async (route) => {
			if (route.request().method() !== 'PATCH') return route.continue();
			await route.fulfill({
				status: 400,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Password login is not available for this account.' })
			});
		});
		await page.getByTestId(`reset-password-btn-${secondId}`).click();
		await expect(page.getByTestId(`reset-password-error-${secondId}`)).toBeVisible();

		// Then the first row keeps its password and stays free of that message
		expect((await page.getByTestId(`generated-password-${firstId}`).textContent())?.trim()).toBe(
			revealed
		);
		await expect(page.getByTestId(`reset-password-error-${firstId}`)).toHaveCount(0);

		// Clean up
		await page.unroute(`**/api/admin/users/${secondId}`);
		await page.request.delete(`/api/admin/users/${firstId}`);
		await page.request.delete(`/api/admin/users/${secondId}`);
	});

	test('Scenario: Resetting an account that no longer exists drops it from the list', async ({
		authenticatedPage: page
	}) => {
		// Given a user who is deleted after the list was loaded
		const victimId = await createVictim(page, 'ui-missing@test.com', 'UI Missing');
		await openUsersPage(page);
		await expect(page.getByTestId(`user-row-${victimId}`)).toBeVisible();
		expect((await page.request.delete(`/api/admin/users/${victimId}`)).status()).toBe(200);

		// When the admin resets that account's password
		await page.getByTestId(`reset-password-btn-${victimId}`).click();

		// Then the row disappears and no password is left behind
		await expect(page.getByTestId(`user-row-${victimId}`)).toHaveCount(0);
		await expect(page.getByTestId(`generated-password-${victimId}`)).toHaveCount(0);
	});

	test('Scenario: A reset in flight cannot be issued twice', async ({
		authenticatedPage: page
	}) => {
		// Given a password-auth user whose reset response is slow to arrive
		const victimId = await createVictim(page, 'ui-inflight@test.com', 'UI In Flight');
		await openUsersPage(page);
		let patchCount = 0;
		await page.route(`**/api/admin/users/${victimId}`, async (route) => {
			if (route.request().method() !== 'PATCH') return route.continue();
			patchCount++;
			await new Promise((resolve) => setTimeout(resolve, 1500));
			await route.continue();
		});

		// When the admin activates the control twice in a row
		const btn = page.getByTestId(`reset-password-btn-${victimId}`);
		await btn.click();
		await expect(btn).toHaveAccessibleName(/Resetting/);
		await expect(btn).toHaveAttribute('aria-disabled', 'true');
		await btn.click({ force: true });

		// Then only one reset is issued
		await expect(page.getByTestId(`generated-password-${victimId}`)).toBeVisible();
		expect(patchCount).toBe(1);

		// Clean up
		await page.unroute(`**/api/admin/users/${victimId}`);
		await page.request.delete(`/api/admin/users/${victimId}`);
	});
});
