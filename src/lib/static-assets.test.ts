import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Everything in static/ ships to every visitor, and the service worker precaches it on PWA install.
// favicon.svg doubles as the in-app logo, so it loads on every page.
const STATIC_DIR = resolve(__dirname, '../../static');
const MAX_FILE_BYTES = 64 * 1024;

function listFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? listFiles(path) : [path];
	});
}

describe('static assets', () => {
	it('favicon.svg is drawn as vectors, not a raster image wrapped in SVG', () => {
		const svg = readFileSync(join(STATIC_DIR, 'favicon.svg'), 'utf8');
		expect(svg).not.toMatch(/<image\b/);
		expect(svg).not.toContain('data:image/');
	});

	it.each(listFiles(STATIC_DIR).map((path) => [path.slice(STATIC_DIR.length + 1), path]))(
		'%s stays within the per-file size budget',
		(_name, path) => {
			expect(statSync(path).size).toBeLessThanOrEqual(MAX_FILE_BYTES);
		}
	);
});
