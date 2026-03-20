import type { NoteColor } from '$lib/types/index.js';

export const NOTE_COLORS: Record<NoteColor, { bg: string; label: string }> = {
	default: { bg: '#faf5eb', label: 'Default' },
	coral: { bg: '#faafa8', label: 'Coral' },
	peach: { bg: '#f39f76', label: 'Peach' },
	sand: { bg: '#fff8b8', label: 'Sand' },
	mint: { bg: '#e2f6d3', label: 'Mint' },
	sage: { bg: '#b4ddd3', label: 'Sage' },
	fog: { bg: '#d4e4ed', label: 'Fog' },
	storm: { bg: '#aeccdc', label: 'Storm' },
	dusk: { bg: '#d3bfdb', label: 'Dusk' },
	blossom: { bg: '#f6e2dd', label: 'Blossom' },
	clay: { bg: '#e9e3d4', label: 'Clay' },
	chalk: { bg: '#efeff1', label: 'Chalk' }
};

export const NOTE_COLORS_DARK: Record<NoteColor, { bg: string; label: string }> = {
	default: { bg: '#2a2520', label: 'Default' },
	coral: { bg: '#4a2522', label: 'Coral' },
	peach: { bg: '#4a3020', label: 'Peach' },
	sand: { bg: '#3a3520', label: 'Sand' },
	mint: { bg: '#2a3a22', label: 'Mint' },
	sage: { bg: '#223a32', label: 'Sage' },
	fog: { bg: '#222e3a', label: 'Fog' },
	storm: { bg: '#1e2a35', label: 'Storm' },
	dusk: { bg: '#352540', label: 'Dusk' },
	blossom: { bg: '#3a2830', label: 'Blossom' },
	clay: { bg: '#302e28', label: 'Clay' },
	chalk: { bg: '#2e2e30', label: 'Chalk' }
};

export function getNoteColor(color: NoteColor, isDark: boolean): string {
	const map = isDark ? NOTE_COLORS_DARK : NOTE_COLORS;
	return (map[color] ?? map.default).bg;
}

export const COLOR_OPTIONS = Object.entries(NOTE_COLORS).map(([value, { label }]) => ({
	value: value as NoteColor,
	label
}));
