import { test, expect, createNote } from './helpers/fixtures.js';

test.describe.serial('Dark mode', () => {
	test('Scenario: Theme toggle persists selection across page reload', async ({
		authenticatedPage: page
	}) => {
		// Given the user is on the preferences page
		await page.goto('/settings/preferences');
		await page.waitForLoadState('networkidle');

		// When the user selects dark theme
		// Set up response listener BEFORE clicking (response may arrive before waitForResponse)
		const prefSaved = page.waitForResponse((r) => r.url().includes('/api/preferences') && r.ok());
		await page.getByTestId('pref-theme-dark').click();

		// Then the page applies dark theme
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		// Wait for preference to persist to server before reloading
		await prefSaved;

		// When the page is reloaded
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Then the dark theme persists (FOUC script applies it before paint)
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await expect(page.getByTestId('pref-theme-dark')).toHaveClass(/font-medium/);
	});

	test('Scenario: Light mode removes dark theme attribute', async ({
		authenticatedPage: page
	}) => {
		// Given dark theme is active
		await page.goto('/settings/preferences');
		await page.waitForLoadState('networkidle');
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

		// When the user navigates to preferences with system theme active
		await page.goto('/settings/preferences');
		await page.waitForLoadState('networkidle');
		await page.getByTestId('pref-theme-system').click();

		// Then the page applies dark theme from system preference
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	});

	test('Scenario: Note cards use dark colors in dark mode', async ({
		authenticatedPage: page
	}) => {
		// Given a note exists
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await createNote(page, 'Dark Mode Test Note');

		// And dark theme is active
		await page.goto('/settings/preferences');
		await page.waitForLoadState('networkidle');
		await page.getByTestId('pref-theme-dark').click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		// When viewing the notes page
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Then note cards should have dark background colors
		const noteCard = page.getByTestId('note-card').first();
		await expect(noteCard).toBeVisible();
		const bg = await noteCard.evaluate((el) => getComputedStyle(el).backgroundColor);
		// Dark default color is #21201f = rgb(33, 32, 31); NOT light default rgb(250, 245, 235)
		expect(bg).not.toBe('rgb(250, 245, 235)');
	});

	test('Scenario: Colour picker swatches are identifiable in dark mode', async ({
		authenticatedPage: page
	}) => {
		// Given dark theme is active
		await page.goto('/settings/preferences');
		await page.waitForLoadState('networkidle');
		await page.getByTestId('pref-theme-dark').click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		// When the user opens the colour picker while editing a note
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Swatch Test');
		await page.getByTestId('color-picker-toggle').click();
		await expect(page.getByTestId('color-picker')).toBeVisible();

		// Then a swatch shows its vivid chip rather than the muted card surface
		await expect(page.getByTestId('color-coral')).toHaveCSS(
			'background-color',
			'rgb(208, 79, 67)'
		);

		await page.getByTestId('close-editor-btn').click();
	});
});
