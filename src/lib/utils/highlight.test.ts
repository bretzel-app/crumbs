import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CODE_LANGUAGES, editorLowlight, highlightCode, isKnownLanguage, lowlight } from './highlight.js';

describe('highlightCode', () => {
	it('wraps tokens in hljs-* spans for a known language', () => {
		const html = highlightCode('const x = 1;', 'javascript');
		expect(html).toContain('<span class="hljs-keyword">const</span>');
		expect(html).toContain('<span class="hljs-number">1</span>');
	});

	it('accepts highlight.js aliases the way a fence info string carries them', () => {
		expect(highlightCode('let a = 1', 'js')).toContain('hljs-keyword');
		expect(highlightCode('print(1)', 'py')).toContain('hljs-built_in');
		expect(highlightCode('<div></div>', 'html')).toContain('hljs-tag');
	});

	it('returns null for an absent or unknown language so the caller falls back to plain text', () => {
		expect(highlightCode('SELECT 1', null)).toBeNull();
		expect(highlightCode('SELECT 1', '')).toBeNull();
		expect(highlightCode('SELECT 1', 'not-a-language')).toBeNull();
	});

	it('escapes HTML in the source so a snippet cannot inject markup', () => {
		const html = highlightCode('const s = "<img src=x onerror=alert(1)>";', 'javascript');
		expect(html).not.toContain('<img');
		expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
	});

	it('keeps highlight.js sub-scope classes alongside the hljs-* class', () => {
		const html = highlightCode('function foo() {}', 'javascript');
		expect(html).toContain('<span class="hljs-title function_">foo</span>');
	});

	it('round-trips the source text exactly once tags are stripped', () => {
		const source = 'if (a < b && c > d) {\n\treturn "x&y";\n}';
		const html = highlightCode(source, 'typescript')!;
		const text = html
			.replace(/<[^>]+>/g, '')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, '&');
		expect(text).toBe(source);
	});
});

describe('CODE_LANGUAGES', () => {
	it('lists only languages the shared lowlight instance can actually highlight', () => {
		for (const { id } of CODE_LANGUAGES) {
			expect(isKnownLanguage(id), id).toBe(true);
		}
	});

	it('has no duplicate ids', () => {
		const ids = CODE_LANGUAGES.map((l) => l.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('editorLowlight', () => {
	it('never auto-detects: an unlabelled block comes back as a single plain text node', () => {
		const result = editorLowlight.highlightAuto('SELECT * FROM users;');
		expect(result.children).toEqual([{ type: 'text', value: 'SELECT * FROM users;' }]);
	});

	it('highlights a labelled block with the same grammars as the renderer', () => {
		const viaEditor = editorLowlight.highlight('python', 'def f(): pass');
		const viaRenderer = lowlight.highlight('python', 'def f(): pass');
		expect(viaEditor.children).toEqual(viaRenderer.children);
	});

	it('reports the languages the picker offers as registered', () => {
		for (const { id } of CODE_LANGUAGES) {
			expect(editorLowlight.registered(id), id).toBe(true);
		}
		expect(editorLowlight.listLanguages()).toContain('javascript');
	});
});

// The palette lives in CSS, so the contrast guarantees are checked against the
// stylesheet itself rather than a TypeScript mirror that could drift.
describe('code palette in src/app.css', () => {
	const css = readFileSync(resolve(__dirname, '../../app.css'), 'utf8');
	const light = readVars(css.slice(css.indexOf(':root {'), css.indexOf('[data-theme="dark"] {')));
	const dark = readVars(css.slice(css.indexOf('[data-theme="dark"] {')));
	const tokenNames = ['--hl-keyword', '--hl-string', '--hl-number', '--hl-comment', '--hl-title', '--hl-tag'];

	it('defines the code surface and every token colour in both themes', () => {
		for (const name of ['--code-bg', ...tokenNames]) {
			expect(light[name], `${name} light`).toMatch(/^#[0-9a-f]{6}$/i);
			expect(dark[name], `${name} dark`).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it('keeps AA contrast (4.5:1) between every token and the code surface', () => {
		for (const [theme, vars] of [
			['light', light],
			['dark', dark]
		] as const) {
			for (const name of tokenNames) {
				const ratio = contrastRatio(vars[name], vars['--code-bg']);
				expect(ratio, `${theme} ${name} ${vars[name]} on ${vars['--code-bg']}`).toBeGreaterThanOrEqual(4.5);
			}
		}
	});

	it('keeps AA contrast between body text and the code surface', () => {
		expect(contrastRatio(light['--text'], light['--code-bg'])).toBeGreaterThanOrEqual(4.5);
		expect(contrastRatio(dark['--text'], dark['--code-bg'])).toBeGreaterThanOrEqual(4.5);
	});

	it('keeps token colours distinguishable from each other', () => {
		for (const vars of [light, dark]) {
			for (let i = 0; i < tokenNames.length; i++) {
				for (let j = i + 1; j < tokenNames.length; j++) {
					const distance = rgbDistance(vars[tokenNames[i]], vars[tokenNames[j]]);
					expect(distance, `${tokenNames[i]} vs ${tokenNames[j]}`).toBeGreaterThanOrEqual(40);
				}
			}
		}
	});
});

function readVars(block: string): Record<string, string> {
	const vars: Record<string, string> = {};
	for (const match of block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
		vars[match[1]] = match[2].toLowerCase();
	}
	return vars;
}

function toRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
	const channels = toRgb(hex).map((v) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
	const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)];
	return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function rgbDistance(a: string, b: string): number {
	const [ra, ga, ba] = toRgb(a);
	const [rb, gb, bb] = toRgb(b);
	return Math.hypot(ra - rb, ga - gb, ba - bb);
}
