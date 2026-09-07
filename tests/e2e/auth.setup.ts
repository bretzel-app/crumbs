import { test as setup } from '@playwright/test';
import { setupAndLogin } from './helpers/fixtures';
import { STORAGE_STATE_FILE } from './global-setup';

/**
 * Log in as the admin once and persist the session cookie. The `app` project
 * loads this storage state into every browser context, so tests start already
 * authenticated instead of each one submitting the login form (~0.8s per test,
 * roughly half of a typical test's duration).
 *
 * The admin's own session is never revoked by any test: admin-users only
 * resets/revokes victim accounts, and auth.spec's logout scenario runs in the
 * auth-setup project with its own context before this setup executes.
 */
setup('authenticate as admin and save storage state', async ({ page }) => {
	await setupAndLogin(page);
	await page.context().storageState({ path: STORAGE_STATE_FILE });
});
