import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getUserId, requireNoteAccess, requireNoteOwnership } from '$lib/server/api-utils.js';
import { addCollaborator, removeCollaborator, fetchCollaboratorsForNotes } from '$lib/server/collaborators.js';
import { db } from '$lib/server/db/index.js';
import { users, notes, noteCollaborators } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, ...event }) => {
	const userId = getUserId(event);
	requireNoteAccess(params.id, userId);

	const collaborators = fetchCollaboratorsForNotes([params.id]);
	return json(collaborators.get(params.id) ?? []);
};

export const POST: RequestHandler = async ({ params, request, ...event }) => {
	const userId = getUserId(event);
	requireNoteOwnership(params.id, userId);

	const body = await request.json();
	const targetUserId = body.userId;
	if (!targetUserId || typeof targetUserId !== 'number') {
		throw error(400, 'userId is required');
	}

	// Cannot add yourself
	const note = db.select({ userId: notes.userId }).from(notes).where(eq(notes.id, params.id)).get();
	if (note && note.userId === targetUserId) {
		throw error(400, 'Cannot add the owner as a collaborator');
	}

	// Target user must exist
	const targetUser = db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).get();
	if (!targetUser) {
		throw error(404, 'User not found');
	}

	// Check not already a collaborator
	const existing = db
		.select({ userId: noteCollaborators.userId })
		.from(noteCollaborators)
		.where(and(eq(noteCollaborators.noteId, params.id), eq(noteCollaborators.userId, targetUserId)))
		.get();
	if (existing) {
		throw error(409, 'User is already a collaborator');
	}

	addCollaborator(params.id, targetUserId, userId);

	const collaborators = fetchCollaboratorsForNotes([params.id]);
	return json(collaborators.get(params.id) ?? [], { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, url, ...event }) => {
	const userId = getUserId(event);
	const targetUserId = Number(url.searchParams.get('userId'));
	if (!targetUserId) {
		throw error(400, 'userId query parameter is required');
	}

	const { isOwner } = requireNoteAccess(params.id, userId);

	// Owner can remove anyone. Collaborator can only remove self.
	if (!isOwner && targetUserId !== userId) {
		throw error(403, 'Only the owner can remove other collaborators');
	}

	removeCollaborator(params.id, targetUserId);

	return json({ success: true });
};
