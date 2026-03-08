import { browser } from '$app/environment';
import type { Note } from '$lib/types/index.js';
import { putNote, getAllNotes, addToSyncQueue, getSyncQueue, clearSyncQueue, deleteNoteFromIdb, getMeta, setMeta, getPendingAttachments, removePendingAttachment } from './idb.js';
import { mergeNotes } from './crdt.js';
import { loadNotes, currentFilter } from '$lib/stores/notes.js';
import { get } from 'svelte/store';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

let syncStatus: SyncStatus = 'synced';
let syncInterval: ReturnType<typeof setInterval> | null = null;
const statusListeners: Set<(status: SyncStatus) => void> = new Set();

export function onSyncStatusChange(listener: (status: SyncStatus) => void) {
	statusListeners.add(listener);
	return () => statusListeners.delete(listener);
}

function setStatus(status: SyncStatus) {
	syncStatus = status;
	statusListeners.forEach((l) => l(status));
}

export function getSyncStatus(): SyncStatus {
	return syncStatus;
}

/**
 * Push local changes to server.
 */
async function pushChanges(): Promise<boolean> {
	let queue;
	try {
		queue = await getSyncQueue();
	} catch {
		return true; // IDB unavailable — nothing to push
	}
	if (queue.length === 0) return true;

	try {
		const res = await fetch('/api/sync', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ changes: queue })
		});

		if (res.ok) {
			await clearSyncQueue();
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Push pending offline attachments to server.
 */
async function pushPendingAttachments(): Promise<void> {
	const pending = await getPendingAttachments();
	for (const item of pending) {
		try {
			const formData = new FormData();
			formData.append('file', new File([item.optimized], item.filename, { type: item.mimeType }));
			formData.append('thumbnail', new File([item.thumbnail], `${item.filename}_thumb.webp`, { type: 'image/webp' }));

			const res = await fetch(`/api/notes/${item.noteId}/attachments`, {
				method: 'POST',
				body: formData
			});

			if (res.ok) {
				await removePendingAttachment(item.id);
			}
		} catch {
			// Will retry on next sync cycle
		}
	}
}

/**
 * Pull remote changes and merge with local state.
 */
async function pullChanges(): Promise<Note[]> {
	let lastSync = '0';
	try {
		lastSync = (await getMeta('lastSyncTimestamp')) || '0';
	} catch {
		// IDB unavailable — pull everything
	}

	try {
		const res = await fetch(`/api/sync?since=${lastSync}`);
		if (!res.ok) return [];

		const remoteNotes: Note[] = await res.json();

		try {
			const localNotes = await getAllNotes();
			const localMap = new Map(localNotes.map((n) => [n.id, n]));

			for (const remote of remoteNotes) {
				const local = localMap.get(remote.id);
				if (local) {
					const merged = mergeNotes(local, remote);
					await putNote(merged);
				} else {
					await putNote(remote);
				}
			}

			await setMeta('lastSyncTimestamp', String(Date.now()));
		} catch {
			// IDB write failed — server data still returned for store use
		}
		return remoteNotes;
	} catch {
		return [];
	}
}

/**
 * Full sync cycle: push then pull.
 */
export async function sync(): Promise<void> {
	if (!browser || !navigator.onLine) {
		setStatus('offline');
		return;
	}

	setStatus('syncing');

	try {
		const pushed = await pushChanges();
		if (!pushed) {
			setStatus('error');
			return;
		}

		await pushPendingAttachments();
		await pullChanges();
		setStatus('synced');

		// Reload notes from server and persist to IDB
		await loadNotes(get(currentFilter));
	} catch {
		setStatus('error');
	}
}

/**
 * Start background sync (every 30 seconds).
 */
export function startSync() {
	if (!browser) return;

	// Initial sync
	sync();

	// Periodic sync
	syncInterval = setInterval(sync, 30_000);

	// Sync on online/offline events
	window.addEventListener('online', () => sync());
	window.addEventListener('offline', () => setStatus('offline'));
}

export function stopSync() {
	if (syncInterval) {
		clearInterval(syncInterval);
		syncInterval = null;
	}
}
