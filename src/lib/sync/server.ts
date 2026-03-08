import { db } from '$lib/server/db/index.js';
import { notes, syncLog } from '$lib/server/db/schema.js';
import { eq, gt, and } from 'drizzle-orm';
import { extractTags } from '$lib/utils/tags.js';
import { syncNoteTags } from '$lib/server/tags.js';
import type { SyncQueueItem } from './idb.js';

/**
 * Process incoming sync changes from client.
 */
export async function processSyncPush(changes: SyncQueueItem[], userId: number): Promise<void> {
	const noteIdsToSyncTags: string[] = [];

	db.transaction((tx) => {
		for (const change of changes) {
			switch (change.operation) {
				case 'create':
				case 'update': {
					if (!change.data) continue;
					const existing = tx
						.select()
						.from(notes)
						.where(and(eq(notes.id, change.noteId), eq(notes.userId, userId)))
						.get();

					if (existing) {
						if (change.timestamp > existing.updatedAt.getTime()) {
							tx.update(notes)
								.set({
									...change.data,
									updatedAt: new Date(change.timestamp),
									version: existing.version + 1
								})
								.where(and(eq(notes.id, change.noteId), eq(notes.userId, userId)))
								.run();
						}
					} else if (change.operation === 'create' && change.data) {
						tx.insert(notes)
							.values({
								id: change.noteId,
								userId,
								title: change.data.title || '',
								content: change.data.content || '',
								color: change.data.color || 'default',
								pinned: change.data.pinned || false,
								archived: change.data.archived || false,
								trashed: change.data.trashed || false,
								checklistMode: change.data.checklistMode || false,
								sortOrder: change.data.sortOrder || 0,
								createdAt: new Date(change.timestamp),
								updatedAt: new Date(change.timestamp),
								version: 1
							})
							.run();
					}

					if (change.data.title !== undefined || change.data.content !== undefined) {
						noteIdsToSyncTags.push(change.noteId);
					}
					break;
				}
				case 'delete': {
					tx.delete(notes).where(and(eq(notes.id, change.noteId), eq(notes.userId, userId))).run();
					break;
				}
			}

			tx.insert(syncLog)
				.values({
					userId,
					noteId: change.noteId,
					operation: change.operation,
					timestamp: new Date(change.timestamp),
					clientId: 'default'
				})
				.run();
		}
	});

	for (const noteId of noteIdsToSyncTags) {
		const note = db.select().from(notes).where(and(eq(notes.id, noteId), eq(notes.userId, userId))).get();
		if (note) {
			const content = `${note.title} ${note.content}`;
			syncNoteTags(noteId, extractTags(content));
		}
	}
}

/**
 * Get all notes updated since a given timestamp for a specific user.
 */
export async function getChangesSince(sinceTimestamp: number, userId: number) {
	return db
		.select()
		.from(notes)
		.where(and(eq(notes.userId, userId), gt(notes.updatedAt, new Date(sinceTimestamp))))
		.all();
}
