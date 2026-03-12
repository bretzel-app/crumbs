import type { Db } from '$lib/server/db/index.js';
import { notes, noteCollaborators, noteUserState, noteVersions, syncLog } from '$lib/server/db/schema.js';
import { eq, gt, and, or, sql, desc, lte } from 'drizzle-orm';
import { extractTags } from '$lib/utils/tags.js';
import { syncNoteTags } from '$lib/server/tags.js';
import { canAccessNote } from '$lib/server/api-utils.js';
import { mergeContent } from '$lib/utils/content-merge.js';
import type { SyncQueueItem } from './idb.js';

/**
 * Find the base content for 3-way merge from version snapshots.
 * Returns the content from the snapshot at or before the given version,
 * or the current note content if no snapshot is found.
 */
function getBaseContent(tx: Parameters<Parameters<Db['transaction']>[0]>[0], noteId: string, baseVersion?: number): string | null {
	if (baseVersion !== undefined) {
		const snapshot = tx.select({ content: noteVersions.content })
			.from(noteVersions)
			.where(and(eq(noteVersions.noteId, noteId), lte(noteVersions.version, baseVersion)))
			.orderBy(desc(noteVersions.version))
			.limit(1)
			.get();
		if (snapshot) return snapshot.content;
	}
	// Fallback: get the most recent snapshot before the current version
	const latest = tx.select({ content: noteVersions.content })
		.from(noteVersions)
		.where(eq(noteVersions.noteId, noteId))
		.orderBy(desc(noteVersions.version))
		.limit(1)
		.get();
	return latest?.content ?? null;
}

/**
 * Process incoming sync changes from client.
 */
export async function processSyncPush(db: Db, changes: SyncQueueItem[], userId: number): Promise<void> {
	const noteIdsToSyncTags: string[] = [];

	db.transaction((tx) => {
		for (const change of changes) {
			switch (change.operation) {
				case 'create':
				case 'update': {
					if (!change.data) continue;

					// Check access: owner can update all fields, collaborator can update shared fields
					const note = tx.select().from(notes).where(eq(notes.id, change.noteId)).get();

					if (note) {
						const isOwner = note.userId === userId;
						const isCollaborator = !isOwner && tx
							.select({ userId: noteCollaborators.userId })
							.from(noteCollaborators)
							.where(and(eq(noteCollaborators.noteId, change.noteId), eq(noteCollaborators.userId, userId)))
							.get();

						if (!isOwner && !isCollaborator) continue;

						// Apply field-level updates unconditionally (no timestamp gate).
						// Each sync change only contains the fields the client explicitly modified,
						// so applying them won't overwrite other users' changes to different fields.
						const sharedData: Record<string, unknown> = {
							updatedAt: new Date(Math.max(change.timestamp, note.updatedAt.getTime())),
							version: note.version + 1
						};
						if (change.data.title !== undefined) sharedData.title = change.data.title;
						if (change.data.color !== undefined) sharedData.color = change.data.color;
						if (change.data.checklistMode !== undefined) sharedData.checklistMode = change.data.checklistMode;

						// Content: 3-way merge to preserve concurrent edits from other users
						if (change.data.content !== undefined && change.data.content !== note.content) {
							const baseContent = getBaseContent(tx, change.noteId, change.baseVersion);
							if (baseContent !== null && baseContent !== note.content) {
								// 3-way merge: base, incoming (local), server current (remote)
								sharedData.content = mergeContent(baseContent, change.data.content, note.content);
							} else {
								// No base or base matches server — take incoming content
								sharedData.content = change.data.content;
							}
						}

						if (isOwner) {
							// Owner: per-user fields go to notes table
							if (change.data.pinned !== undefined) sharedData.pinned = change.data.pinned;
							if (change.data.archived !== undefined) sharedData.archived = change.data.archived;
							if (change.data.trashed !== undefined) {
								sharedData.trashed = change.data.trashed;
								sharedData.trashedAt = change.data.trashed ? new Date(change.timestamp) : null;
							}
							if (change.data.sortOrder !== undefined) sharedData.sortOrder = change.data.sortOrder;
						}

						tx.update(notes)
							.set(sharedData)
							.where(eq(notes.id, change.noteId))
							.run();

						// Collaborator: per-user fields go to noteUserState
						if (!isOwner) {
							const hasPerUser = change.data.pinned !== undefined ||
								change.data.archived !== undefined ||
								change.data.sortOrder !== undefined;
							if (hasPerUser) {
								const existing = tx.select().from(noteUserState)
									.where(and(eq(noteUserState.noteId, change.noteId), eq(noteUserState.userId, userId)))
									.get();
								if (existing) {
									const updates: Record<string, unknown> = {};
									if (change.data.pinned !== undefined) updates.pinned = change.data.pinned;
									if (change.data.archived !== undefined) updates.archived = change.data.archived;
									if (change.data.sortOrder !== undefined) updates.sortOrder = change.data.sortOrder;
									tx.update(noteUserState).set(updates)
										.where(and(eq(noteUserState.noteId, change.noteId), eq(noteUserState.userId, userId)))
										.run();
								} else {
									tx.insert(noteUserState).values({
										noteId: change.noteId,
										userId,
										pinned: change.data.pinned ?? false,
										archived: change.data.archived ?? false,
										sortOrder: change.data.sortOrder ?? 0
									}).run();
								}
							}
						}
					} else if (change.operation === 'create' && change.data) {
						// Only owner can create notes
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
					// Only owner can delete
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
		const note = db.select().from(notes).where(eq(notes.id, noteId)).get();
		if (note) {
			const content = `${note.title} ${note.content}`;
			syncNoteTags(db, noteId, extractTags(content), note.userId);
		}
	}
}

/**
 * Get all notes updated since a given timestamp for a specific user.
 * Includes both owned and shared notes.
 * For shared notes, per-user state (pinned, archived, sortOrder) is overlaid
 * from noteUserState so collaborators get their own view.
 */
export async function getChangesSince(db: Db, sinceTimestamp: number, userId: number) {
	const since = new Date(sinceTimestamp);

	// Owned notes
	const ownedNotes = db
		.select()
		.from(notes)
		.where(and(eq(notes.userId, userId), gt(notes.updatedAt, since)))
		.all();

	// Shared notes (via collaborator relationship) with per-user state overlay
	const sharedNotes = db
		.select({
			id: notes.id,
			userId: notes.userId,
			title: notes.title,
			content: notes.content,
			color: notes.color,
			pinned: sql<boolean>`COALESCE(${noteUserState.pinned}, 0)`.as('user_pinned'),
			archived: sql<boolean>`COALESCE(${noteUserState.archived}, 0)`.as('user_archived'),
			trashed: notes.trashed,
			trashedAt: notes.trashedAt,
			checklistMode: notes.checklistMode,
			sortOrder: sql<number>`COALESCE(${noteUserState.sortOrder}, 0)`.as('user_sort_order'),
			createdAt: notes.createdAt,
			updatedAt: notes.updatedAt,
			version: notes.version
		})
		.from(noteCollaborators)
		.innerJoin(notes, eq(noteCollaborators.noteId, notes.id))
		.leftJoin(
			noteUserState,
			and(eq(noteUserState.noteId, notes.id), eq(noteUserState.userId, userId))
		)
		.where(
			and(
				eq(noteCollaborators.userId, userId),
				eq(notes.trashed, false),
				gt(notes.updatedAt, since)
			)
		)
		.all();

	return [...ownedNotes, ...sharedNotes];
}
