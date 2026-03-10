import { test as base, expect, type Page, type Locator } from '@playwright/test';
import { collectCoverage } from './coverage';

const TEST_EMAIL = 'admin@test.com';
const TEST_PASSWORD = 'testpassword123';
const TEST_DISPLAY_NAME = 'Test Admin';

const COLLAB_EMAIL = 'collab@test.com';
const COLLAB_PASSWORD = 'collabpass123';
const COLLAB_NAME = 'Collaborator User';

/** Find a specific note card by its title text */
export function noteCard(page: Page, title: string): Locator {
	return page.locator('[data-testid="note-card"]', { hasText: title });
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

export { expect, TEST_EMAIL, TEST_PASSWORD, COLLAB_EMAIL, COLLAB_PASSWORD, COLLAB_NAME };
