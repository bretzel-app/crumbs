import { describe, it, expect } from 'vitest';
import { getNoteColor, NOTE_COLORS, NOTE_COLORS_DARK } from '$lib/utils/colors.js';

describe('getNoteColor', () => {
	it('returns light color when isDark is false', () => {
		expect(getNoteColor('default', false)).toBe('#faf5eb');
		expect(getNoteColor('coral', false)).toBe('#faafa8');
	});

	it('returns dark color when isDark is true', () => {
		expect(getNoteColor('default', true)).toBe('#2a2520');
		expect(getNoteColor('coral', true)).toBe('#4a2522');
	});

	it('returns default color for unknown color name', () => {
		expect(getNoteColor('unknown' as any, false)).toBe('#faf5eb');
		expect(getNoteColor('unknown' as any, true)).toBe('#2a2520');
	});

	it('has matching keys in light and dark color maps', () => {
		const lightKeys = Object.keys(NOTE_COLORS).sort();
		const darkKeys = Object.keys(NOTE_COLORS_DARK).sort();
		expect(lightKeys).toEqual(darkKeys);
	});
});
