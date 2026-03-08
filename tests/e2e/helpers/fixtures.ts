import { test as base, expect, type Page, type Locator } from '@playwright/test';

const TEST_EMAIL = 'admin@test.com';
const TEST_PASSWORD = 'testpassword123';
const TEST_DISPLAY_NAME = 'Test Admin';

/** Find a specific note card by its title text */
export function noteCard(page: Page, title: string): Locator {
	return page.locator('[data-testid="note-card"]', { hasText: title });
}

/**
 * Extended test fixture that handles setup/auth.
 */
export const test = base.extend<{ authenticatedPage: Page }>({
	authenticatedPage: async ({ page }, use) => {
		// Setup: create user and login
		await setupAndLogin(page);
		await use(page);
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

export { expect, TEST_EMAIL, TEST_PASSWORD };
