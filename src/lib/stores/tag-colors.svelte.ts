import { browser } from '$app/environment';
import { isNoteColor } from '$lib/utils/colors.js';
import { showToast } from '$lib/stores/toast.js';
import type { NoteColor } from '$lib/types/index.js';

const STORAGE_KEY = 'crumbs-tag-colors';

let tagColors = $state<Record<string, NoteColor>>({});

/** Convert `GET /api/tags` rows into a tag name → colour map, keeping only coloured tags. */
export function toTagColorMap(rows: { name: string; color: string | null }[]): Record<string, NoteColor> {
	const map: Record<string, NoteColor> = {};
	for (const row of rows) {
		if (isNoteColor(row.color)) map[row.name] = row.color;
	}
	return map;
}

function loadFromLocalStorage(): Record<string, NoteColor> {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw);
	} catch {
		// Corrupted localStorage — start empty
	}
	return {};
}

function saveToLocalStorage(map: Record<string, NoteColor>) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
	} catch {
		// localStorage full or unavailable
	}
}

/**
 * Initialize tag colours — load from localStorage so cards colour offline, then sync from server.
 */
export function initTagColors() {
	tagColors = loadFromLocalStorage();
	syncTagColorsFromServer();
}

/**
 * Get the reactive tag name → colour map.
 */
export function getTagColors(): Record<string, NoteColor> {
	return tagColors;
}

/**
 * Pull tag colours from server and replace local state.
 */
export async function syncTagColorsFromServer() {
	if (!browser) return;
	try {
		const res = await fetch('/api/tags');
		if (res.ok) {
			tagColors = toTagColorMap(await res.json());
			saveToLocalStorage(tagColors);
		}
	} catch {
		// Offline — local state stands
	}
}

/**
 * Set or clear (`null`) a tag's colour. Applied immediately, reverted if the server
 * doesn't take it: unlike preferences, a lost change here would silently recolour notes.
 */
export async function setTagColor(name: string, color: NoteColor | null) {
	const previous = tagColors;
	const next = { ...tagColors };
	if (color && color !== 'default') next[name] = color;
	else delete next[name];
	tagColors = next;
	saveToLocalStorage(tagColors);

	try {
		const res = await fetch(`/api/tags/${encodeURIComponent(name)}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ color })
		});
		if (res.ok) return;
	} catch {
		// Offline — fall through to revert
	}
	tagColors = previous;
	saveToLocalStorage(tagColors);
	showToast('Could not save the tag colour', 'error');
}
