import { describe, it, expect } from 'vitest';
import { getNoteColor, NOTE_COLORS, NOTE_COLORS_DARK } from '$lib/utils/colors.js';

describe('getNoteColor', () => {
	it('returns light color when isDark is false', () => {
		expect(getNoteColor('default', false)).toBe('#faf5eb');
		expect(getNoteColor('coral', false)).toBe('#faafa8');
	});

	it('returns dark color when isDark is true', () => {
		expect(getNoteColor('default', true)).toBe('#21201f');
		expect(getNoteColor('coral', true)).toBe('#3f1f1c');
	});

	it('returns default color for unknown color name', () => {
		expect(getNoteColor('unknown' as any, false)).toBe('#faf5eb');
		expect(getNoteColor('unknown' as any, true)).toBe('#21201f');
	});

	it('has matching keys in light and dark color maps', () => {
		const lightKeys = Object.keys(NOTE_COLORS).sort();
		const darkKeys = Object.keys(NOTE_COLORS_DARK).sort();
		expect(lightKeys).toEqual(darkKeys);
	});
});

function toRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance. */
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

describe('dark note colours', () => {
	// Must track [data-theme="dark"] in src/app.css.
	const DARK_TEXT = '#ece3d3';
	const DARK_TEXT_MUTED = '#b3a695';

	it('keeps body text above the AA threshold on every dark card', () => {
		for (const [name, { bg }] of Object.entries(NOTE_COLORS_DARK)) {
			expect(contrastRatio(bg, DARK_TEXT), `${name} (${bg})`).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('keeps muted text above the AA threshold on every dark card', () => {
		// The shipped dark theme failed this at 3.77:1 with its previous muted
		// colour (#9a8e7e). This guard exists so a future palette edit cannot
		// reintroduce it — it does not discriminate the old surfaces, which were
		// darker and so scored higher against the lifted muted colour.
		for (const [name, { bg }] of Object.entries(NOTE_COLORS_DARK)) {
			expect(contrastRatio(bg, DARK_TEXT_MUTED), `${name} (${bg})`).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('keeps every pair of dark surfaces distinguishable', () => {
		// The old palette failed this: fog and storm sat 7.5 apart, so the twelve
		// colours read as one dark smudge. Current closest pair is coral/peach at 12.
		const entries = Object.entries(NOTE_COLORS_DARK);
		for (let i = 0; i < entries.length; i++) {
			for (let j = i + 1; j < entries.length; j++) {
				const [[nameA, a], [nameB, b]] = [entries[i], entries[j]];
				const distance = rgbDistance(a.bg, b.bg);
				expect(distance, `${nameA} vs ${nameB}`).toBeGreaterThan(10);
			}
		}
	});
});
