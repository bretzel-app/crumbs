import { test as base, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync } from 'fs';
import { collectCoverage } from './coverage';
import { TEST_CREDENTIALS_FILE } from '../global-setup';

const { testPassword, collabPassword } = JSON.parse(readFileSync(TEST_CREDENTIALS_FILE, 'utf-8'));

const TEST_EMAIL = 'admin@test.com';
const TEST_PASSWORD = testPassword;
const TEST_DISPLAY_NAME = 'Test Admin';

const COLLAB_EMAIL = 'collab@test.com';
const COLLAB_PASSWORD = collabPassword;
const COLLAB_NAME = 'Collaborator User';

/**
 * Find a specific note card by its exact title text. Matches only the
 * card's <h3> title, not its full text content — with note-linking, a
 * card's content preview can render another note's title as plain text
 * (e.g. a stripped note-link), so a substring match against the whole
 * card can ambiguously resolve to more than one card.
 */
export function noteCard(page: Page, title: string): Locator {
	const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return page.locator('[data-testid="note-card"]').filter({
		has: page.locator('h3', { hasText: new RegExp(`^${escaped}$`) })
	});
}

/**
 * Extended test fixture that handles setup/auth.
 */
export const test = base.extend<{ authenticatedPage: Page; collabPage: Page }>({
	authenticatedPage: async ({ page }, use, testInfo) => {
		// Setup: create user and login
		await setupAndLogin(page);
		await use(page);
		// Teardown: collect coverage data from the browser
		await collectCoverage(page, testInfo.title);
	},
	collabPage: async ({ browser, authenticatedPage }, use, testInfo) => {
		// Create collab user via admin API (idempotent)
		const res = await authenticatedPage.request.post('/api/admin/users', {
			data: {
				email: COLLAB_EMAIL,
				displayName: COLLAB_NAME,
				password: COLLAB_PASSWORD,
				role: 'user'
			}
		});
		// Ignore 409 — user already exists

		// Login as collaborator in a new browser context
		const context = await browser.newContext();
		const page = await context.newPage();
		await page.goto('/login');
		await page.getByTestId('email-input').fill(COLLAB_EMAIL);
		await page.getByTestId('password-input').fill(COLLAB_PASSWORD);
		await page.getByTestId('login-btn').click();
		await page.waitForURL('/');
		await page.waitForLoadState('networkidle');
		await use(page);
		// Teardown: collect coverage data from the browser
		await collectCoverage(page, testInfo.title + '-collab');
		await context.close();
	}
});

export async function setupAndLogin(page: Page) {
	await page.goto('/');

	const url = page.url();
	if (url.includes('/setup')) {
		// First-time setup with email
		await page.getByTestId('email-input').fill(TEST_EMAIL);
		await page.getByTestId('display-name-input').fill(TEST_DISPLAY_NAME);
		await page.getByTestId('password-input').fill(TEST_PASSWORD);
		await page.getByTestId('confirm-password-input').fill(TEST_PASSWORD);
		await page.getByTestId('setup-btn').click();

		// Wait for either redirect to main page or an error (another worker completed setup first)
		try {
			await page.waitForURL('/', { timeout: 5000 });
		} catch {
			// Setup was completed by another worker - go to login instead
			await page.goto('/login');
			await page.getByTestId('email-input').fill(TEST_EMAIL);
			await page.getByTestId('password-input').fill(TEST_PASSWORD);
			await page.getByTestId('login-btn').click();
			await page.waitForURL('/');
		}
	} else if (url.includes('/login')) {
		// Login with email
		await page.getByTestId('email-input').fill(TEST_EMAIL);
		await page.getByTestId('password-input').fill(TEST_PASSWORD);
		await page.getByTestId('login-btn').click();
		await page.waitForURL('/');
	}
	// else: already on main page (session still valid)

	// Wait for full hydration after auth redirect (window.location.href causes full reload).
	// networkidle ensures JS bundles have loaded and executed.
	await page.waitForLoadState('networkidle');
}

/** Create a note via the UI and close the editor. Use in Given steps for state setup. */
export async function createNote(page: Page, title: string, content?: string) {
	await page.getByTestId('new-note-btn').click();
	await page.getByTestId('note-title-input').fill(title);
	if (content) {
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await editor.pressSequentially(content);
	}
	await page.getByTestId('close-editor-btn').click();
	// Wait for the editor to fully unmount, not just start closing. The close is
	// animated and dismisses via an async history.back() (see NoteEditor); returning
	// before it settles lets a following page.goto race that navigation and abort it
	// (net::ERR_ABORTED). The outer overlay is removed only when the close completes.
	await expect(page.getByTestId('note-editor-overlay')).toHaveCount(0);
	await expect(noteCard(page, title)).toBeVisible();
}

export { expect, TEST_EMAIL, TEST_PASSWORD, COLLAB_EMAIL, COLLAB_PASSWORD, COLLAB_NAME };
