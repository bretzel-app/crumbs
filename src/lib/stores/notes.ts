import { writable, derived } from 'svelte/store';
import type { Note, NoteFilter, NoteCreate, NoteUpdate } from '$lib/types/index.js';
import { addToSyncQueue, putNote, deleteNoteFromIdb, getAllNotes, clearNotes as clearIdbNotes } from '$lib/sync/idb.js';
import { showToast } from '$lib/stores/toast.js';
import { extractTags } from '$lib/utils/tags.js';

export const notes = writable<Note[]>([]);
export const currentFilter = writable<NoteFilter>('all');
export const selectedTag = writable<string | null>(null);
export const notesLoaded = writable(false);

export const filteredNotes = derived(
	[notes, selectedTag, currentFilter],
	([$notes, $selectedTag, $filter]) => {
		let result = $notes;
		if ($filter === 'all') {
			result = result.filter((n) => !n.trashed && !n.archived);
		} else if ($filter === 'archived') {
			result = result.filter((n) => n.archived && !n.trashed);
		} else if ($filter === 'trashed') {
			result = result.filter((n) => n.trashed);
		}
		if ($selectedTag) {
			result = result.filter((n) => n.tags?.includes($selectedTag));
		}
		return result;
	}
);

function sortNotes(list: Note[]): Note[] {
	return [...list].sort((a, b) => {
		const orderDiff = a.sortOrder - b.sortOrder;
		if (orderDiff !== 0) return orderDiff;
		return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
	});
}

export const pinnedNotes = derived(filteredNotes, ($notes) =>
	sortNotes($notes.filter((n) => n.pinned))
);

export const unpinnedNotes = derived(filteredNotes, ($notes) =>
	sortNotes($notes.filter((n) => !n.pinned))
);

export const allTags = derived(notes, ($notes) => {
	const tagSet = new Set<string>();
	$notes.forEach((n) => n.tags?.forEach((t) => tagSet.add(t)));
	return [...tagSet].sort();
});

function isNetworkError(err: unknown): boolean {
	return err instanceof TypeError;
}

/**
 * Merge incoming notes with current store, keeping the higher-version note
 * when a conflict exists. This prevents a stale loadNotes response from
 * overwriting a just-saved note (race between sync interval and updateNote).
 */
export function mergeNotesByVersion(current: Note[], incoming: Note[]): Note[] {
	const currentMap = new Map(current.map((n) => [n.id, n]));
	const merged = incoming.map((incomingNote) => {
		const local = currentMap.get(incomingNote.id);
		if (local && local.version > incomingNote.version) return local;
		return incomingNote;
	});
	return merged;
}

export async function loadNotes(filter: NoteFilter = 'all') {
	// Load from IDB first for instant display
	try {
		const cached = await getAllNotes();
		if (cached.length > 0) {
			notes.update((current) => current.length > 0 ? mergeNotesByVersion(current, cached) : cached);
		}
	} catch {
		// IDB unavailable — continue with server fetch
	}
	currentFilter.set(filter);
	notesLoaded.set(true);

	// Then fetch from server in the background
	try {
		const res = await fetch(`/api/notes?filter=${filter}`);
		if (res.ok) {
			const data: Note[] = await res.json();
			notes.update((current) => mergeNotesByVersion(current, data));
			currentFilter.set(filter);

			// Update IDB with server state
			try {
				await clearIdbNotes();
				await Promise.all(data.map((n) => putNote(n)));
			} catch {
				// IDB write failed — server data is still in the store
			}
		} else if (res.status === 401) {
			window.location.href = '/login';
		} else {
			showToast('Failed to load notes', 'error');
		}
	} catch {
		// Offline — IDB data already loaded above
	}
}

export async function createNote(note: NoteCreate): Promise<Note | null> {
	try {
		const res = await fetch('/api/notes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(note)
		});
		if (res.ok) {
			const created: Note = await res.json();
			notes.update((list) => [created, ...list]);
			await putNote(created);
			return created;
		}
		if (res.status === 401) {
			window.location.href = '/login';
		} else {
			showToast('Failed to save note', 'error');
		}
		return null;
	} catch (err) {
		if (isNetworkError(err)) {
			const now = new Date();
			const title = note.title ?? '';
			const content = note.content ?? '';
			const optimistic: Note = {
				id: crypto.randomUUID(),
				title,
				content,
				color: note.color ?? 'default',
				pinned: note.pinned ?? false,
				archived: false,
				trashed: false,
				trashedAt: null,
				checklistMode: note.checklistMode ?? false,
				sortOrder: 0,
				createdAt: now,
				updatedAt: now,
				version: 1,
				tags: extractTags(`${title} ${content}`)
			};
			notes.update((list) => [optimistic, ...list]);
			await putNote(optimistic);
			await addToSyncQueue({ noteId: optimistic.id, operation: 'create', data: optimistic, timestamp: Date.now() });
			showToast('Saved offline — will sync when reconnected', 'info');
			return optimistic;
		}
		return null;
	}
}

export async function updateNote(id: string, updates: NoteUpdate): Promise<Note | null> {
	// Read current version for 3-way merge base on the server
	let baseVersion: number | undefined;
	notes.update((list) => {
		const current = list.find((n) => n.id === id);
		if (current) baseVersion = current.version;
		return list;
	});

	try {
		const res = await fetch(`/api/notes/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...updates, baseVersion })
		});
		if (res.ok) {
			const updated: Note = await res.json();
			notes.update((list) => list.map((n) => (n.id === id ? updated : n)));
			await putNote(updated);
			return updated;
		}
		showToast('Failed to save note', 'error');
		return null;
	} catch (err) {
		if (isNetworkError(err)) {
			let optimistic: Note | null = null;
			notes.update((list) =>
				list.map((n) => {
					if (n.id === id) {
						optimistic = { ...n, ...updates, updatedAt: new Date() };
						if (updates.title !== undefined || updates.content !== undefined) {
							optimistic.tags = extractTags(`${optimistic.title} ${optimistic.content}`);
						}
						return optimistic;
					}
					return n;
				})
			);
			if (optimistic) {
				await putNote(optimistic);
				await addToSyncQueue({ noteId: id, operation: 'update', data: updates, timestamp: Date.now(), baseVersion });
				showToast('Saved offline — will sync when reconnected', 'info');
			}
			return optimistic;
		}
		return null;
	}
}

export async function deleteNote(id: string): Promise<boolean> {
	try {
		const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
		if (res.ok) {
			notes.update((list) => list.filter((n) => n.id !== id));
			await deleteNoteFromIdb(id);
			return true;
		}
		return false;
	} catch (err) {
		if (isNetworkError(err)) {
			notes.update((list) => list.filter((n) => n.id !== id));
			await deleteNoteFromIdb(id);
			await addToSyncQueue({ noteId: id, operation: 'delete', timestamp: Date.now() });
			showToast('Saved offline — will sync when reconnected', 'info');
			return true;
		}
		return false;
	}
}

export async function trashNote(id: string): Promise<Note | null> {
	const result = await updateNote(id, { trashed: true });
	if (result) notes.update((list) => list.filter((n) => n.id !== id));
	return result;
}

export async function restoreNote(id: string): Promise<Note | null> {
	return updateNote(id, { trashed: false });
}

export async function archiveNote(id: string): Promise<Note | null> {
	const result = await updateNote(id, { archived: true });
	if (result) notes.update((list) => list.filter((n) => n.id !== id));
	return result;
}

export async function unarchiveNote(id: string): Promise<Note | null> {
	return updateNote(id, { archived: false });
}

export async function togglePin(id: string, currentPinned: boolean): Promise<Note | null> {
	return updateNote(id, { pinned: !currentPinned });
}

export async function leaveNote(id: string): Promise<boolean> {
	try {
		const res = await fetch(`/api/notes/${id}/collaborators?userId=self`, { method: 'DELETE' });
		if (res.ok) {
			notes.update((list) => list.filter((n) => n.id !== id));
			await deleteNoteFromIdb(id);
			return true;
		}
		showToast('Failed to leave note', 'error');
		return false;
	} catch {
		return false;
	}
}

export async function updateSortOrders(orders: { id: string; sortOrder: number }[]): Promise<boolean> {
	// Optimistic update
	notes.update((list) =>
		list.map((n) => {
			const order = orders.find((o) => o.id === n.id);
			return order ? { ...n, sortOrder: order.sortOrder } : n;
		})
	);

	try {
		const res = await fetch('/api/notes/reorder', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ orders })
		});
		return res.ok;
	} catch {
		// Offline — optimistic update stands
		return false;
	}
}
