import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: 'html',
	globalSetup: './tests/e2e/global-setup.ts',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
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
		command: 'pnpm build && pnpm preview --port 4173',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			DATABASE_URL: './data/test-crumbs.db',
			NODE_ENV: 'test'
		}
	}
});
