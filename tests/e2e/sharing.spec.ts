import { test, expect, noteCard, TEST_EMAIL, TEST_PASSWORD } from './helpers/fixtures.js';
import type { Page, BrowserContext } from '@playwright/test';

const COLLAB_EMAIL = 'collab@test.com';
const COLLAB_PASSWORD = 'collabpass123';
const COLLAB_NAME = 'Collaborator User';

/**
 * Create a second user via the admin API (using the admin's session cookies).
 */
async function createCollaboratorUser(adminPage: Page) {
	const cookies = await adminPage.context().cookies();
	const sessionCookie = cookies.find((c) => c.name === 'session');
	if (!sessionCookie) throw new Error('No session cookie found');

	const res = await adminPage.request.post('/api/admin/users', {
		data: {
			email: COLLAB_EMAIL,
			displayName: COLLAB_NAME,
			password: COLLAB_PASSWORD,
			role: 'user'
		}
	});
	if (!res.ok()) {
		const body = await res.text();
		// User may already exist from prior test
		if (!body.includes('already exists') && res.status() !== 409) {
			throw new Error(`Failed to create collaborator user: ${res.status()} ${body}`);
		}
	}
}

/**
 * Log in as the collaborator user in a new browser context.
 */
async function loginAsCollaborator(browser: import('@playwright/test').Browser): Promise<{ context: BrowserContext; page: Page }> {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto('/login');
	await page.getByTestId('email-input').fill(COLLAB_EMAIL);
	await page.getByTestId('password-input').fill(COLLAB_PASSWORD);
	await page.getByTestId('login-btn').click();
	await page.waitForURL('/');
	await page.waitForLoadState('networkidle');
	return { context, page };
}

test.describe.serial('Note Sharing', () => {
	let collabContext: BrowserContext;
	let collabPage: Page;

	test('Scenario: Owner shares a note with another user', async ({ authenticatedPage: page, browser }) => {
		// Given a second user exists
		await createCollaboratorUser(page);

		// When the owner creates a note titled "Shared Note"
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Shared Note');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await editor.pressSequentially('Shared content');
		await page.getByTestId('close-editor-btn').click();
		await expect(noteCard(page, 'Shared Note')).toBeVisible();

		// And the owner opens the share dialog
		await noteCard(page, 'Shared Note').click();
		await page.getByTestId('share-toggle').click();
		await expect(page.getByTestId('share-dialog')).toBeVisible();

		// And the owner searches for the collaborator
		await page.getByTestId('share-search-input').fill('collab');
		await expect(page.getByTestId('share-user-result').first()).toBeVisible({ timeout: 5000 });

		// And the owner adds the collaborator
		await page.getByTestId('share-user-result').first().click();

		// Then the collaborator appears in the share dialog
		await expect(page.getByTestId('share-collaborator')).toBeVisible();

		// Close dialogs
		await page.getByTestId('share-dialog-overlay').click({ position: { x: 10, y: 10 } });
		await page.getByTestId('close-editor-btn').click();

		// Then the note shows a collaborator indicator
		const card = noteCard(page, 'Shared Note');
		await expect(card.getByTestId('collaborator-indicator')).toBeVisible();
	});

	test('Scenario: Collaborator sees the shared note in their list', async ({ authenticatedPage: page, browser }) => {
		// Given the note was shared in the previous test
		// When the collaborator logs in
		const collab = await loginAsCollaborator(browser);
		collabContext = collab.context;
		collabPage = collab.page;

		// Then the collaborator sees "Shared Note" in their notes list
		await expect(noteCard(collabPage, 'Shared Note')).toBeVisible({ timeout: 10000 });

		// And the note shows a collaborator indicator
		await expect(noteCard(collabPage, 'Shared Note').getByTestId('collaborator-indicator')).toBeVisible();
	});

	test('Scenario: Collaborator can edit the shared note content', async ({ authenticatedPage: page }) => {
		// When the collaborator edits the note
		await noteCard(collabPage, 'Shared Note').click();
		const editor = collabPage.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await editor.pressSequentially(' — edited by collaborator');
		await collabPage.getByTestId('close-editor-btn').click();

		// And the owner reloads
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Then the owner sees the collaborator's changes
		await noteCard(page, 'Shared Note').click();
		await expect(page.getByTestId('tiptap-editor')).toContainText('edited by collaborator');
		await page.getByTestId('close-editor-btn').click();
	});

	test('Scenario: Owner and collaborator have independent pin state', async ({ authenticatedPage: page }) => {
		// When the collaborator pins the shared note
		const card = noteCard(collabPage, 'Shared Note');
		await card.hover();
		await card.getByTestId('pin-btn').click({ force: true });

		// Then the collaborator sees the note as pinned
		await expect(noteCard(collabPage, 'Shared Note').getByTestId('pin-indicator')).toBeVisible();

		// But the owner does not see it as pinned
		await page.reload();
		await page.waitForLoadState('networkidle');
		const ownerCard = noteCard(page, 'Shared Note');
		await expect(ownerCard.getByTestId('pin-indicator')).not.toBeVisible();
	});

	test('Scenario: Collaborator sees leave action instead of trash', async () => {
		// Then the collaborator's card shows a leave button, not a trash button
		const card = noteCard(collabPage, 'Shared Note');
		await card.hover();
		await expect(card.getByTestId('leave-btn')).toBeVisible();
		await expect(card.getByTestId('trash-btn')).not.toBeVisible();
	});

	test('Scenario: Collaborator leaves shared note and it disappears', async ({ authenticatedPage: page }) => {
		// When the collaborator leaves the shared note
		const card = noteCard(collabPage, 'Shared Note');
		await card.hover();
		await card.getByTestId('leave-btn').click({ force: true });

		// Then the note disappears from the collaborator's list
		await expect(noteCard(collabPage, 'Shared Note')).not.toBeVisible({ timeout: 5000 });

		// But the owner still sees it
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(noteCard(page, 'Shared Note')).toBeVisible();
	});

	test.afterAll(async () => {
		if (collabContext) await collabContext.close();
	});
});
