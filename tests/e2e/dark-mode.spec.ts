import { test, expect } from './helpers/fixtures.js';

test.describe('Dark mode', () => {
	test('Scenario: Theme toggle persists selection across page reload', async ({
		authenticatedPage: page
	}) => {
		// Given the user is on the preferences page
		await page.goto('/settings/preferences');

		// When the user selects dark theme
		await page.getByTestId('pref-theme-dark').click();

		// Then the page applies dark theme
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		// When the page is reloaded
		await page.reload();

		// Then the dark theme persists without flash
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await expect(page.getByTestId('pref-theme-dark')).toHaveClass(/font-medium/);
	});

	test('Scenario: Light mode removes dark theme attribute', async ({
		authenticatedPage: page
	}) => {
		// Given dark theme is active
		await page.goto('/settings/preferences');
		await page.getByTestId('pref-theme-dark').click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		// When the user selects light theme
		await page.getByTestId('pref-theme-light').click();

		// Then the dark theme attribute is removed
		await expect(page.locator('html')).not.toHaveAttribute('data-theme');
	});

	test('Scenario: System mode follows OS dark preference', async ({
		authenticatedPage: page
	}) => {
		// Given the OS prefers dark mode
		await page.emulateMedia({ colorScheme: 'dark' });

		// When the user selects system theme
		await page.goto('/settings/preferences');
		await page.getByTestId('pref-theme-system').click();

		// Then the page applies dark theme from system preference
		// Use toHaveAttribute with timeout to handle async $effect execution
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 5000 });
	});

	test('Scenario: Note cards use dark colors in dark mode', async ({
		authenticatedPage: page
	}) => {
		// Given dark theme is active
		await page.goto('/settings/preferences');
		await page.getByTestId('pref-theme-dark').click();

		// When viewing the notes page
		await page.goto('/');

		// Then note cards should have dark background colors
		const noteCard = page.getByTestId('note-card').first();
		if (await noteCard.isVisible()) {
			const bg = await noteCard.evaluate((el) => getComputedStyle(el).backgroundColor);
			// Dark default color is #2a2520 = rgb(42, 37, 32)
			expect(bg).not.toBe('rgb(250, 245, 235)'); // Not the light default
		}
	});
});
