import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Page } from '@playwright/test';

const COVERAGE_DIR = join(process.cwd(), 'coverage', 'e2e', 'raw');

let counter = 0;

/**
 * Collect Istanbul coverage data from the browser page.
 * The vite-plugin-istanbul injects `window.__coverage__` when COVERAGE=true.
 */
export async function collectCoverage(page: Page, testTitle: string) {
	if (process.env.VITE_COVERAGE !== 'true') return;

	const coverage = await page.evaluate(() => (window as any).__coverage__);
	if (!coverage) return;

	mkdirSync(COVERAGE_DIR, { recursive: true });

	const safeName = testTitle.replace(/[^a-zA-Z0-9-_]/g, '_');
	const filename = `coverage-${safeName}-${counter++}-${Date.now()}.json`;
	writeFileSync(join(COVERAGE_DIR, filename), JSON.stringify(coverage));
}
