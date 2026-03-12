import type { Note } from '$lib/types/index.js';

/** Fields that can be individually merged between local and remote notes */
const MUTABLE_FIELDS = ['title', 'content', 'color', 'pinned', 'archived', 'trashed', 'checklistMode', 'sortOrder'] as const;

/**
 * Last-Write-Wins (LWW) merge strategy with pending-field protection.
 *
 * When remote is newer, takes remote values for all fields EXCEPT those
 * listed in `pendingFields` — these represent locally-queued changes that
 * haven't been pushed yet and must be preserved.
 */
export function mergeNotes(local: Note, remote: Note, pendingFields?: Set<string>): Note {
	const localTime = new Date(local.updatedAt).getTime();
	const remoteTime = new Date(remote.updatedAt).getTime();

	const remoteWins = remoteTime > localTime ||
		(remoteTime === localTime && remote.version > local.version);

	if (!remoteWins) {
		return { ...local };
	}

	// Remote wins — take remote as base, but preserve pending local fields
	if (!pendingFields || pendingFields.size === 0) {
		return { ...remote };
	}

	const merged = { ...remote };
	for (const field of MUTABLE_FIELDS) {
		if (pendingFields.has(field)) {
			(merged as unknown as Record<string, unknown>)[field] = (local as unknown as Record<string, unknown>)[field];
		}
	}

	return merged;
}

/**
 * Determine if a local note has changes compared to a remote note.
 */
export function hasChanges(local: Note, remote: Note): boolean {
	return (
		local.title !== remote.title ||
		local.content !== remote.content ||
		local.color !== remote.color ||
		local.pinned !== remote.pinned ||
		local.archived !== remote.archived ||
		local.trashed !== remote.trashed ||
		local.checklistMode !== remote.checklistMode ||
		local.sortOrder !== remote.sortOrder
	);
}

/**
 * Generate a diff of changed fields between two notes.
 */
export function diffNotes(
	oldNote: Note,
	newNote: Note
): Partial<Note> {
	const diff: Partial<Note> = {};

	if (oldNote.title !== newNote.title) diff.title = newNote.title;
	if (oldNote.content !== newNote.content) diff.content = newNote.content;
	if (oldNote.color !== newNote.color) diff.color = newNote.color;
	if (oldNote.pinned !== newNote.pinned) diff.pinned = newNote.pinned;
	if (oldNote.archived !== newNote.archived) diff.archived = newNote.archived;
	if (oldNote.trashed !== newNote.trashed) diff.trashed = newNote.trashed;
	if (oldNote.checklistMode !== newNote.checklistMode) diff.checklistMode = newNote.checklistMode;
	if (oldNote.sortOrder !== newNote.sortOrder) diff.sortOrder = newNote.sortOrder;

	return diff;
}
