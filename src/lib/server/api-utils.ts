import { error } from '@sveltejs/kit';
import { db } from './db/index.js';
import { notes, noteCollaborators } from './db/schema.js';
import { eq, and } from 'drizzle-orm';

type EventWithLocals = {
	locals: App.Locals;
};

export function getUserId(event: EventWithLocals): number {
	if (!event.locals.user) throw error(401, 'Unauthorized');
	return event.locals.user.id;
}

export function requireAdmin(event: EventWithLocals) {
	const user = event.locals.user;
	if (!user || user.role !== 'admin') throw error(403, 'Forbidden');
	return user;
}

/**
 * Check if a user can access a note (as owner or collaborator).
 */
export function canAccessNote(noteId: string, userId: number): { canAccess: boolean; isOwner: boolean } {
	const note = db.select({ userId: notes.userId }).from(notes).where(eq(notes.id, noteId)).get();
	if (!note) return { canAccess: false, isOwner: false };
	if (note.userId === userId) return { canAccess: true, isOwner: true };

	const collab = db
		.select({ userId: noteCollaborators.userId })
		.from(noteCollaborators)
		.where(and(eq(noteCollaborators.noteId, noteId), eq(noteCollaborators.userId, userId)))
		.get();
	return { canAccess: !!collab, isOwner: false };
}

/**
 * Require that a user can access a note. Throws 404 if no access.
 */
export function requireNoteAccess(noteId: string, userId: number): { isOwner: boolean } {
	const { canAccess, isOwner } = canAccessNote(noteId, userId);
	if (!canAccess) throw error(404, 'Not found');
	return { isOwner };
}

/**
 * Require that a user is the owner of a note. Throws 404 if not owner.
 */
export function requireNoteOwnership(noteId: string, userId: number): void {
	const note = db.select({ userId: notes.userId }).from(notes).where(eq(notes.id, noteId)).get();
	if (!note || note.userId !== userId) throw error(404, 'Not found');
}
