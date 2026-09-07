import { test, expect } from '@playwright/test';

// These scenarios describe what an anonymous visitor receives, so drop the
// shared admin session the `app` project injects.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('PWA', () => {
	test('Scenario: Web manifest provides correct app metadata', async ({ page }) => {
		// When the browser requests the web manifest
		const response = await page.goto('/manifest.webmanifest');

		// Then it returns successfully with the correct app name, display mode, and icons
		expect(response?.status()).toBe(200);
		const manifest = await response?.json();
		expect(manifest?.name).toBe('Crumbs by Bretzel');
		expect(manifest?.display).toBe('standalone');
		expect(manifest?.icons?.length).toBeGreaterThan(0);
	});

	test('Scenario: Application declares a theme color for mobile browsers', async ({ page }) => {
		// Given the application is loaded
		await page.goto('/login');

		// Then a theme-color meta tag is present
		const themeColor = await page.getAttribute('meta[name="theme-color"]', 'content');
		expect(themeColor).toBeTruthy();
	});
});
