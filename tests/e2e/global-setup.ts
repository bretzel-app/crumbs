import { writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

export const TEST_CREDENTIALS_FILE = './data/test-credentials.json';

export default function globalSetup() {
	// The test database is wiped before the webServer starts (see the
	// webServer.command in playwright.config.ts), NOT here: Playwright brings
	// the webServer up before globalSetup runs, so deleting the SQLite files
	// here would orphan the server's open database onto a deleted inode and
	// tests that read the database file directly would see an empty schema.

	// Generate random passwords for this test run, shared across all workers
	writeFileSync(
		TEST_CREDENTIALS_FILE,
		JSON.stringify({
			testPassword: `test-${randomUUID()}`,
			collabPassword: `collab-${randomUUID()}`,
			userPassword: `user-${randomUUID()}`
		})
	);
}
