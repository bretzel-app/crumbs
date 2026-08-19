import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: process.env.CI ? 4 : undefined,
	reporter: 'html',
	globalSetup: './tests/e2e/global-setup.ts',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		serviceWorkers: 'block'
	},
	projects: [
		{
			name: 'auth-setup',
			testMatch: 'auth.spec.ts',
			fullyParallel: false,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'app',
			testIgnore: 'auth.spec.ts',
			dependencies: ['auth-setup'],
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		// The wipe runs here (before the server opens the database), not in
		// globalSetup: Playwright starts the webServer before globalSetup, so
		// deleting the SQLite files later would orphan the server's open
		// database onto a deleted inode. Tests that read the database file
		// directly (see linkUserToOAuth in admin-users.spec.ts) must see the
		// server's real database file.
		command:
			'rm -f data/test-crumbs.db data/test-crumbs.db-wal data/test-crumbs.db-shm data/test-crumbs.db-journal && pnpm preview --port 4173',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			DATABASE_URL: './data/test-crumbs.db',
			NODE_ENV: 'test'
		}
	}
});
