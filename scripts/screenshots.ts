import { chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { seed, login } from './screenshots/seed';
import { captureDesktop, captureMobile } from './screenshots/capture';
import {
	BASE_URL,
	SCREENSHOT_DB,
	DESKTOP_VIEWPORT,
	MOBILE_VIEWPORT,
	OUTPUT_DIR
} from './screenshots/constants';

function cleanDatabase(): void {
	for (const ext of ['', '-journal', '-wal', '-shm']) {
		const path = `${SCREENSHOT_DB}${ext}`;
		if (existsSync(path)) {
			unlinkSync(path);
			console.log(`  deleted ${path}`);
		}
	}
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url);
			if (res.ok || res.status === 302) return;
		} catch {
			// Server not ready yet
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error(`Server not reachable at ${url} after ${timeoutMs}ms`);
}

function startServer(): Promise<ChildProcess> {
	return new Promise((resolve, reject) => {
		const dir = SCREENSHOT_DB.substring(0, SCREENSHOT_DB.lastIndexOf('/'));
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

		const server = spawn('pnpm', ['preview', '--port', '4173'], {
			env: { ...process.env, DATABASE_URL: SCREENSHOT_DB, NODE_ENV: 'production' },
			stdio: 'pipe'
		});

		server.on('error', reject);
		server.on('exit', (code) => {
			if (code !== null && code !== 0) reject(new Error(`Server exited with code ${code}`));
		});

		// Poll until server responds (stdout detection is unreliable in CI)
		waitForServer(BASE_URL, 60_000)
			.then(() => resolve(server))
			.catch(reject);
	});
}

async function main(): Promise<void> {
	console.log('Screenshot automation starting...\n');

	// 1. Clean DB
	console.log('Cleaning database...');
	cleanDatabase();

	// 2. Ensure output dir exists
	if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

	// 3. Start preview server
	console.log('Starting preview server...');
	const server = await startServer();
	console.log('Server ready.\n');

	const browser = await chromium.launch();

	try {
		// 4. Seed data (in desktop context)
		console.log('Seeding data...');
		const desktopContext = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
		const desktopPage = await desktopContext.newPage();
		await seed(desktopPage);
		console.log('Seed complete.\n');

		// 5. Desktop screenshots
		await captureDesktop(desktopPage);
		await desktopContext.close();
		console.log('');

		// 6. Mobile screenshots (fresh context with mobile viewport)
		const mobileContext = await browser.newContext({ viewport: MOBILE_VIEWPORT });
		const mobilePage = await mobileContext.newPage();
		await login(mobilePage);
		await captureMobile(mobilePage);
		await mobileContext.close();

		console.log('\nAll screenshots captured successfully!');
	} finally {
		await browser.close();
		server.kill('SIGTERM');
	}
}

main().catch((err) => {
	console.error('Screenshot automation failed:', err);
	process.exit(1);
});
