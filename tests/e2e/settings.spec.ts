import { test, expect } from './helpers/fixtures.js';

test.describe('Settings — API Key Management', () => {
	test('Scenario: Created API key appears in the keys list', async ({
		authenticatedPage: page
	}) => {
		// When the user navigates to the MCP settings and creates an API key
		await page.goto('/settings/mcp');
		await page.getByTestId('api-key-name-input').fill('Settings Test Key');
		await page.getByTestId('create-api-key-btn').click();

		// Then the key is shown once for copying
		await expect(page.getByTestId('created-key-display')).toBeVisible();
		const keyValue = await page.getByTestId('created-key-value').textContent();
		expect(keyValue).toMatch(/^crumbs_/);

		// And it appears in the keys list
		const keyItem = page.getByTestId('api-key-item').filter({ hasText: 'Settings Test Key' });
		await expect(keyItem).toBeVisible();
	});

	test('Scenario: Revoked API key disappears from the keys list', async ({
		authenticatedPage: page
	}) => {
		// Given an API key exists
		await page.goto('/settings/mcp');
		await page.getByTestId('api-key-name-input').fill('Revoke Me');
		await page.getByTestId('create-api-key-btn').click();
		await expect(page.getByTestId('created-key-display')).toBeVisible();

		const keyItem = page.getByTestId('api-key-item').filter({ hasText: 'Revoke Me' });
		await expect(keyItem).toBeVisible();

		// When the user revokes the key
		await keyItem.getByTestId('delete-api-key-btn').click();
		await keyItem.getByTestId('confirm-delete-btn').click();

		// Then the key is removed from the list
		await expect(keyItem).not.toBeVisible();
	});

	test('Scenario: Settings page is accessible from sidebar', async ({
		authenticatedPage: page
	}) => {
		// Given the user is on the main page
		// When the user clicks the Settings link in the sidebar
		await page.getByTestId('settings-link').click();

		// Then the settings page is shown
		await expect(page).toHaveURL('/settings');
		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	});

	test('Scenario: Settings subpages are navigable', async ({
		authenticatedPage: page
	}) => {
		// Given the user is on the settings page
		await page.goto('/settings');

		// When the user clicks the MCP Server nav link
		await page.getByRole('link', { name: 'MCP Server' }).click();

		// Then the MCP settings page is shown
		await expect(page).toHaveURL('/settings/mcp');
		await expect(page.getByText('API Keys')).toBeVisible();

		// When the user clicks back to Profile
		await page.getByRole('link', { name: 'Profile' }).click();
		await expect(page).toHaveURL('/settings');
	});
});
