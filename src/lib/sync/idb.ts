import { openDB, deleteDB, type IDBPDatabase } from 'idb';
import type { Note } from '$lib/types/index.js';

const DB_PREFIX = 'crumbs';
const DB_VERSION = 2;

export interface PendingAttachment {
	id: string;
	noteId: string;
	optimized: Blob;
	thumbnail: Blob;
	filename: string;
	mimeType: string;
	timestamp: number;
}

interface CrumbsDB {
	notes: {
		key: string;
		value: Note;
		indexes: {
			'by-updated': Date;
		};
	};
	syncQueue: {
		key: number;
		value: SyncQueueItem;
		indexes: {
			'by-timestamp': number;
		};
	};
	meta: {
		key: string;
		value: { key: string; value: string };
	};
	pendingAttachments: {
		key: string;
		value: PendingAttachment;
		indexes: {
			'by-noteId': string;
		};
	};
}

export interface SyncQueueItem {
	id?: number;
	noteId: string;
	operation: 'create' | 'update' | 'delete';
	data?: Partial<Note>;
	timestamp: number;
	baseVersion?: number;
}

let dbPromise: Promise<IDBPDatabase<CrumbsDB>> | null = null;
let currentUserId: number | null = null;

/**
 * Initialize the IDB for a specific user. Must be called before any
 * other IDB operation (typically after login when userId is known).
 */
export function initDb(userId: number): void {
	if (currentUserId !== userId) {
		dbPromise = null;
		currentUserId = userId;
	}
}

export function getDb(): Promise<IDBPDatabase<CrumbsDB>> {
	if (!dbPromise) {
		const dbName = currentUserId ? `${DB_PREFIX}-${currentUserId}` : DB_PREFIX;
		dbPromise = openDB<CrumbsDB>(dbName, DB_VERSION, {
			upgrade(db) {
				// Notes store
				if (!db.objectStoreNames.contains('notes')) {
					const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
					noteStore.createIndex('by-updated', 'updatedAt');
				}

				// Sync queue
				if (!db.objectStoreNames.contains('syncQueue')) {
					const syncStore = db.createObjectStore('syncQueue', {
						keyPath: 'id',
						autoIncrement: true
					});
					syncStore.createIndex('by-timestamp', 'timestamp');
				}

				// Metadata (e.g., last sync timestamp, client ID)
				if (!db.objectStoreNames.contains('meta')) {
					db.createObjectStore('meta', { keyPath: 'key' });
				}

				// Pending attachments (offline uploads)
				if (!db.objectStoreNames.contains('pendingAttachments')) {
					const pendingStore = db.createObjectStore('pendingAttachments', { keyPath: 'id' });
					pendingStore.createIndex('by-noteId', 'noteId');
				}
			}
		});
	}
	return dbPromise;
}

/**
 * Delete the current user's IDB (call on logout).
 */
export async function destroyDb(): Promise<void> {
	if (dbPromise) {
		const db = await dbPromise;
		db.close();
		dbPromise = null;
	}
	if (currentUserId) {
		await deleteDB(`${DB_PREFIX}-${currentUserId}`);
		currentUserId = null;
	}
}

// Notes operations
export async function getAllNotes(): Promise<Note[]> {
	const db = await getDb();
	return db.getAll('notes');
}

export async function getNote(id: string): Promise<Note | undefined> {
	const db = await getDb();
	return db.get('notes', id);
}

export async function putNote(note: Note): Promise<void> {
	const db = await getDb();
	await db.put('notes', note);
}

export async function deleteNoteFromIdb(id: string): Promise<void> {
	const db = await getDb();
	await db.delete('notes', id);
}

export async function clearNotes(): Promise<void> {
	const db = await getDb();
	await db.clear('notes');
}

// Sync queue operations
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
	const db = await getDb();
	await db.add('syncQueue', item as SyncQueueItem);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
	const db = await getDb();
	return db.getAll('syncQueue');
}

export async function clearSyncQueue(): Promise<void> {
	const db = await getDb();
	await db.clear('syncQueue');
}

export async function removeSyncQueueItem(id: number): Promise<void> {
	const db = await getDb();
	await db.delete('syncQueue', id);
}

// Meta operations
export async function getMeta(key: string): Promise<string | undefined> {
	const db = await getDb();
	const result = await db.get('meta', key);
	return result?.value;
}

export async function setMeta(key: string, value: string): Promise<void> {
	const db = await getDb();
	await db.put('meta', { key, value });
}

// Pending attachment operations
export async function addPendingAttachment(item: PendingAttachment): Promise<void> {
	const db = await getDb();
	await db.put('pendingAttachments', item);
}

export async function getPendingAttachments(noteId?: string): Promise<PendingAttachment[]> {
	const db = await getDb();
	if (noteId) {
		return db.getAllFromIndex('pendingAttachments', 'by-noteId', noteId);
	}
	return db.getAll('pendingAttachments');
}

export async function removePendingAttachment(id: string): Promise<void> {
	const db = await getDb();
	await db.delete('pendingAttachments', id);
}
