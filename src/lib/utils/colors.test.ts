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

/** WCAG relative luminance. */
function relativeLuminance(hex: string): number {
	const n = parseInt(hex.slice(1), 16);
	const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
	const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)];
	return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
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
		// This is the invariant the old palette broke: muted/struck-through text
		// became unreadable on the lighter surfaces.
		for (const [name, { bg }] of Object.entries(NOTE_COLORS_DARK)) {
			expect(contrastRatio(bg, DARK_TEXT_MUTED), `${name} (${bg})`).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('holds the twelve surfaces within a narrow lightness band so they read as a family', () => {
		const luminances = Object.values(NOTE_COLORS_DARK).map((c) => relativeLuminance(c.bg));
		expect(Math.max(...luminances) - Math.min(...luminances)).toBeLessThan(0.03);
	});
});
