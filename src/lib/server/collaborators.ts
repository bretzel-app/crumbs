import { db } from './db/index.js';
import { noteCollaborators, noteUserState, users } from './db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import type { Collaborator } from '$lib/types/index.js';

/**
 * Batch fetch collaborators for multiple notes.
 * Returns a Map of noteId → Collaborator[].
 */
export function fetchCollaboratorsForNotes(noteIds: string[]): Map<string, Collaborator[]> {
	if (noteIds.length === 0) return new Map();

	const rows = db
		.select({
			noteId: noteCollaborators.noteId,
			userId: noteCollaborators.userId,
			displayName: users.displayName,
			email: users.email,
			addedAt: noteCollaborators.addedAt
		})
		.from(noteCollaborators)
		.innerJoin(users, eq(noteCollaborators.userId, users.id))
		.where(inArray(noteCollaborators.noteId, noteIds))
		.all();

	const map = new Map<string, Collaborator[]>();
	for (const row of rows) {
		const collab: Collaborator = {
			userId: row.userId,
			displayName: row.displayName,
			email: row.email,
			addedAt: row.addedAt
		};
		const existing = map.get(row.noteId);
		if (existing) {
			existing.push(collab);
		} else {
			map.set(row.noteId, [collab]);
		}
	}
	return map;
}

/**
 * Add a collaborator to a note.
 */
export function addCollaborator(noteId: string, userId: number, addedBy: number): void {
	db.insert(noteCollaborators)
		.values({ noteId, userId, addedBy, addedAt: new Date() })
		.run();
}

/**
 * Remove a collaborator from a note. Also cleans up their per-user state.
 */
export function removeCollaborator(noteId: string, userId: number): void {
	db.delete(noteCollaborators)
		.where(and(eq(noteCollaborators.noteId, noteId), eq(noteCollaborators.userId, userId)))
		.run();
	db.delete(noteUserState)
		.where(and(eq(noteUserState.noteId, noteId), eq(noteUserState.userId, userId)))
		.run();
}

/**
 * Get all collaborator user IDs for a note.
 */
export function getCollaboratorIds(noteId: string): number[] {
	return db
		.select({ userId: noteCollaborators.userId })
		.from(noteCollaborators)
		.where(eq(noteCollaborators.noteId, noteId))
		.all()
		.map((r) => r.userId);
}
