import { test, expect, noteCard, gotoHydrated } from './helpers/fixtures.js';
import type { Page } from '@playwright/test';

const DEFAULT_PREFS = {
	defaultNoteMode: 'richtext',
	defaultNoteColor: 'default',
	hideFooter: false,
	sidebarDefaultState: 'open'
};

/**
 * Reset preferences to defaults on both server and client localStorage.
 *
 * Server reset ensures GET /api/preferences returns defaults.
 * localStorage reset ensures initPreferences() picks up correct values
 * even if the sync request is blocked or returns stale data.
 */
async function resetPreferences(page: Page) {
	await page.request.put('/api/preferences', {
		data: {
			defaultNoteMode: 'richtext',
			defaultNoteColor: 'default',
			hideFooter: 'false',
			sidebarDefaultState: 'open'
		}
	});
	await page.evaluate(
		(prefs) => localStorage.setItem('crumbs-preferences', JSON.stringify(prefs)),
		DEFAULT_PREFS
	);
}

/**
 * Keep the app from syncing preferences from the server for the rest of the test.
 *
 * Every page load re-runs initPreferences():
 *   1. loadFromLocalStorage() — synchronous, returns correct value
 *   2. syncPreferencesFromServer() — async, can return stale data from
 *      parallel test workers that share the same user's server-side prefs
 *
 * Aborting its GET /api/preferences makes initPreferences() fall back to
 * localStorage, which is always correct (set by resetPreferences or by
 * updatePreference on the settings page). Saving still goes through.
 *
 * The route is registered once and never removed. A `{ times: 1 }` route
 * per navigation removed itself while the page's other requests were in
 * flight, and one of them (/api/notes or /api/sync) then never completed,
 * so waiting for networkidle timed out on CI.
 */
async function blockPreferenceSync(page: Page) {
	await page.route('**/api/preferences', (route) =>
		route.request().method() === 'GET' ? route.abort() : route.continue()
	);
}

test.describe('Settings — Preferences', () => {
	test.beforeEach(async ({ authenticatedPage: page }) => {
		await blockPreferenceSync(page);
	});

	test('Scenario: Preferences tab is visible in settings nav', async ({
		authenticatedPage: page
	}) => {
		// When the user navigates to settings
		await page.goto('/settings');

		// Then the Preferences nav link is visible
		await expect(page.getByTestId('settings-nav-preferences')).toBeVisible();
	});

	test('Scenario: Default note mode change applies to new notes', async ({
		authenticatedPage: page
	}) => {
		await resetPreferences(page);

		// Given the user sets default note mode to Markdown
		await gotoHydrated(page, '/settings/preferences');
		const putResponse = page.waitForResponse((res) => res.url().includes('/api/preferences') && res.request().method() === 'PUT');
		await page.getByTestId('pref-mode-markdown').click();
		await putResponse;

		// When the user creates a new note
		await gotoHydrated(page, '/');
		await page.getByTestId('new-note-btn').click();

		// Then the note editor opens in markdown mode (textarea visible)
		await expect(page.getByTestId('note-content-input')).toBeVisible();
	});

	test('Scenario: Default note mode applies when reopening an existing note', async ({
		authenticatedPage: page
	}) => {
		await resetPreferences(page);

		// Given a note titled "Existing Markdown Note" exists
		const title = `Existing Markdown Note ${Date.now()}`;
		await page.request.post('/api/notes', { data: { title, content: 'Some **bold** text' } });

		// And the user's default note mode is Markdown
		await gotoHydrated(page, '/settings/preferences');
		const putResponse = page.waitForResponse((res) => res.url().includes('/api/preferences') && res.request().method() === 'PUT');
		await page.getByTestId('pref-mode-markdown').click();
		await putResponse;

		// When the user opens the note
		await gotoHydrated(page, '/');
		await noteCard(page, title).click();

		// Then the note editor opens in markdown mode showing the raw source
		await expect(page.getByTestId('note-content-input')).toBeVisible();
		await expect(page.getByTestId('note-content-input')).toHaveValue('Some **bold** text');
	});

	test('Scenario: Footer toggle hides and shows footer', async ({
		authenticatedPage: page
	}) => {
		await resetPreferences(page);

		// Given the footer is visible
		await gotoHydrated(page, '/');
		await expect(page.getByTestId('app-footer')).toBeVisible();

		// When the user enables the hide footer preference
		await gotoHydrated(page, '/settings/preferences');
		await page.getByTestId('pref-hide-footer').check();

		// Then the footer is hidden
		await gotoHydrated(page, '/');
		await expect(page.getByTestId('app-footer')).not.toBeVisible();

		// When the user disables the hide footer preference
		await gotoHydrated(page, '/settings/preferences');
		await page.getByTestId('pref-hide-footer').uncheck();

		// Then the footer is visible again
		await gotoHydrated(page, '/');
		await expect(page.getByTestId('app-footer')).toBeVisible();
	});

	test('Scenario: Preferences persist across page reload', async ({
		authenticatedPage: page
	}) => {
		await resetPreferences(page);

		// Given the user changes default note mode to Markdown
		await gotoHydrated(page, '/settings/preferences');
		const putResponse = page.waitForResponse((res) => res.url().includes('/api/preferences') && res.request().method() === 'PUT');
		await page.getByTestId('pref-mode-markdown').click();
		await putResponse;

		// When the page is reloaded
		await page.reload();

		// Then the Markdown button is still selected (has primary styling)
		const mdBtn = page.getByTestId('pref-mode-markdown');
		await expect(mdBtn).toHaveClass(/font-medium/);
	});
});

test.describe('Settings — API Key Management', () => {
	test('Scenario: Created API key appears in the keys list', async ({
		authenticatedPage: page
	}) => {
		// Use a unique name to avoid strict-mode violations from parallel test runs
		const keyName = `Test Key ${Date.now()}`;

		// When the user navigates to the MCP settings and creates an API key
		await gotoHydrated(page, '/settings/mcp');
		await page.getByTestId('api-key-name-input').fill(keyName);
		await page.getByTestId('create-api-key-btn').click();

		// Then the key is shown once for copying
		await expect(page.getByTestId('created-key-display')).toBeVisible();
		const keyValue = await page.getByTestId('created-key-value').textContent();
		expect(keyValue).toMatch(/^crumbs_/);

		// And it appears in the keys list
		const keyItem = page.getByTestId('api-key-item').filter({ hasText: keyName });
		await expect(keyItem).toBeVisible();
	});

	test('Scenario: Revoked API key disappears from the keys list', async ({
		authenticatedPage: page
	}) => {
		const keyName = `Revoke Key ${Date.now()}`;

		// Given an API key exists
		await gotoHydrated(page, '/settings/mcp');
		await page.getByTestId('api-key-name-input').fill(keyName);
		await page.getByTestId('create-api-key-btn').click();
		await expect(page.getByTestId('created-key-display')).toBeVisible();

		const keyItem = page.getByTestId('api-key-item').filter({ hasText: keyName });
		await expect(keyItem).toBeVisible();

		// When the user revokes the key
		await keyItem.getByTestId('delete-api-key-btn').click();
		await keyItem.getByTestId('confirm-delete-btn').click();

		// Then the key is removed from the list
		await expect(keyItem).not.toBeVisible();
	});

	test('Scenario: Sidebar settings link opens the preferences page', async ({
		authenticatedPage: page
	}) => {
		// When the user navigates to settings from the sidebar
		await page.getByTestId('settings-link').click();

		// Then the preferences page is displayed
		await expect(page).toHaveURL('/settings/preferences');
		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	});

	test('Scenario: Settings tabs navigate between subpages', async ({
		authenticatedPage: page
	}) => {
		// Given the user is on the settings page
		await gotoHydrated(page, '/settings');

		// When the user selects the API tab
		await page.getByRole('link', { name: 'API' }).click();

		// Then the API settings are displayed
		await expect(page).toHaveURL('/settings/mcp');
		await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();

		// When the user selects the Profile tab
		await page.getByRole('link', { name: 'Profile' }).click();

		// Then the profile settings are displayed
		await expect(page).toHaveURL('/settings/profile');
	});
});
