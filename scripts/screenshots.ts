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

function startServer(): Promise<ChildProcess> {
	return new Promise((resolve, reject) => {
		const dir = SCREENSHOT_DB.substring(0, SCREENSHOT_DB.lastIndexOf('/'));
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

		const server = spawn('pnpm', ['preview', '--port', '4173'], {
			env: { ...process.env, DATABASE_URL: SCREENSHOT_DB, NODE_ENV: 'production' },
			stdio: 'pipe'
		});

		const timeout = setTimeout(() => reject(new Error('Server start timeout (30s)')), 30_000);

		function checkReady(data: Buffer) {
			const text = data.toString();
			if (text.includes('localhost:4173') || text.includes('0.0.0.0:4173')) {
				clearTimeout(timeout);
				resolve(server);
			}
		}

		server.stdout?.on('data', checkReady);
		server.stderr?.on('data', checkReady);

		server.on('error', (err) => {
			clearTimeout(timeout);
			reject(err);
		});

		server.on('exit', (code) => {
			clearTimeout(timeout);
			if (code !== null && code !== 0) reject(new Error(`Server exited with code ${code}`));
		});
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
