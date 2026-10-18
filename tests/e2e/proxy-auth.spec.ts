import { test, expect, request, type APIRequestContext } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

/**
 * Trusted header (reverse proxy) authentication.
 *
 * The shared preview server can't exercise this: the identity header is only trusted from the TCP
 * peer address, which only the production Node server (`node build`) exposes. So this spec starts
 * its own production server with proxy auth enabled and loopback as "the proxy", then plays the
 * proxy by sending the identity header itself.
 */

const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}`;
const DB = './data/test-proxy-auth.db';
const LOGOUT_URL = 'https://auth.example.test/logout';
const ADMIN = { email: 'proxy-admin@example.com', password: 'proxy-admin-password' };
const BOB = 'bob@example.com';

let server: ChildProcess | undefined;

function wipeDb() {
	for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(DB + suffix, { force: true });
}

async function isServing(): Promise<boolean> {
	try {
		await fetch(`${BASE_URL}/login`);
		return true;
	} catch {
		return false;
	}
}

async function waitForServer(child: ChildProcess) {
	for (let attempt = 0; attempt < 100; attempt++) {
		if (child.exitCode !== null) throw new Error(`proxy-auth server exited with ${child.exitCode}`);
		if (await isServing()) return;
		await new Promise((r) => setTimeout(r, 100));
	}
	throw new Error('proxy-auth server did not start');
}

/** A client whose every request comes through the proxy as `email` */
function viaProxyAs(email: string): Promise<APIRequestContext> {
	return request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Remote-Email': email } });
}

/** A client that only carries the session cookies of `ctx`, with no identity header */
async function withSessionOf(ctx: APIRequestContext): Promise<APIRequestContext> {
	const { cookies } = await ctx.storageState();
	return request.newContext({ baseURL: BASE_URL, storageState: { cookies, origins: [] } });
}

test.describe.serial('Reverse proxy authentication', () => {
	test.beforeAll(async () => {
		test.skip(!existsSync('build/index.js'), 'needs a production build (pnpm build)');
		// A leftover server would answer instead of ours, with a stale database
		if (await isServing()) throw new Error(`port ${PORT} is already in use`);
		wipeDb();
		server = spawn(process.execPath, ['build/index.js'], {
			env: {
				...process.env,
				PORT: String(PORT),
				ORIGIN: BASE_URL,
				DATABASE_URL: DB,
				AUTH_PROXY_ENABLED: 'true',
				AUTH_PROXY_TRUSTED_IPS: '127.0.0.1/32, ::1/128',
				AUTH_PROXY_LOGOUT_URL: LOGOUT_URL
			},
			stdio: 'inherit'
		});
		await waitForServer(server);

		// Given an admin and an invited user Bob exist
		const admin = await request.newContext({ baseURL: BASE_URL });
		const setup = await admin.post('/api/auth/setup', { data: { ...ADMIN, displayName: 'Admin' } });
		expect(setup.ok(), await setup.text()).toBe(true);
		const invite = await admin.post('/api/admin/users', { data: { email: BOB, displayName: 'Bob' } });
		expect(invite.ok(), await invite.text()).toBe(true);
		await admin.dispose();
	});

	test.afterAll(async () => {
		// Wait for exit before deleting: wiping SQLite files under a live server orphans its database
		if (server && server.exitCode === null) {
			const exited = new Promise((r) => server!.once('exit', r));
			server.kill();
			await exited;
		}
		wipeDb();
	});

	test('Scenario: A user signed in at the proxy reaches the app without a Crumbs login', async () => {
		// Given the proxy has signed in the admin
		const admin = await viaProxyAs(ADMIN.email);

		// When they open the app
		const page = await admin.get('/', { maxRedirects: 0 });

		// Then the app is served instead of the login page
		expect(page.status()).toBe(200);
		// And they act with their own privileges
		expect((await admin.get('/api/admin/users')).status()).toBe(200);
	});

	test('Scenario: The Crumbs session keeps working on requests that arrive without the identity header', async () => {
		// Given Bob signed in through the proxy
		const bob = await viaProxyAs(BOB);
		await bob.get('/');

		// When a request carries Bob's session but no identity header
		const sessionOnly = await withSessionOf(bob);

		// Then Bob is still signed in
		expect((await sessionOnly.get('/api/notes')).status()).toBe(200);
	});

	test('Scenario: A different proxy identity replaces the existing session', async () => {
		// Given the admin has a Crumbs session from the proxy
		const browser = await request.newContext({ baseURL: BASE_URL });
		await browser.get('/', { headers: { 'Remote-Email': ADMIN.email } });
		const adminSession = await withSessionOf(browser);

		// When the proxy now forwards Bob's identity from the same browser
		const res = await browser.get('/api/admin/users', { headers: { 'Remote-Email': BOB } });

		// Then the request is served as Bob, not the admin
		expect(res.status()).toBe(403);
		// And the admin's session can no longer be used
		expect((await adminSession.get('/api/notes')).status()).toBe(401);
	});

	test('Scenario: An identity without a Crumbs account is turned away with an explanation', async () => {
		// Given the proxy has signed in someone who was never invited
		const stranger = await viaProxyAs('stranger@example.com');

		// When they open the app
		const page = await stranger.get('/', { maxRedirects: 0 });

		// Then they are sent to the login page, which explains there is no account
		expect(page.status()).toBe(302);
		expect(page.headers()['location']).toBe('/login?error=no_account');
		// And the API refuses them
		expect((await stranger.get('/api/notes')).status()).toBe(401);
	});

	test('Scenario: Signing out of Crumbs also signs the user out at the proxy', async ({ browser }) => {
		// Given Bob is using the app through the proxy
		const context = await browser.newContext({
			baseURL: BASE_URL,
			extraHTTPHeaders: { 'Remote-Email': BOB }
		});
		const page = await context.newPage();
		await page.route(`${LOGOUT_URL}**`, (route) => route.fulfill({ body: 'signed out at the proxy' }));
		await page.goto('/settings/profile');
		const { cookies } = await context.storageState();

		// When Bob signs out
		await page.getByTestId('logout-btn').click();

		// Then the browser lands on the proxy's logout page
		await expect(page).toHaveURL(LOGOUT_URL);
		// And Bob's Crumbs session is gone
		const stale = await request.newContext({ baseURL: BASE_URL, storageState: { cookies, origins: [] } });
		expect((await stale.get('/api/notes')).status()).toBe(401);
		await context.close();
	});
});
