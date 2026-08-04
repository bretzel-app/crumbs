import type { Db } from './db/index.js';
import { notes, noteTags, tags, noteCollaborators, noteUserState } from './db/schema.js';
import { eq, and, like, or, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { extractTags } from '$lib/utils/tags.js';
import { extractNoteLinks } from '$lib/utils/note-links.js';
import { fetchTagsForNotes, syncNoteTags } from './tags.js';
import { syncNoteLinks, fetchBacklinksForNote } from './note-links.js';
import { fetchAttachmentsForNotes } from './attachments.js';
import { fetchCollaboratorsForNotes } from './collaborators.js';
import { fetchSharesForNotes } from './shares-service.js';
import { canAccessNote } from './api-utils.js';
import { createSnapshot, getBaseContent } from './versions-service.js';
import { mergeContentUpdate } from '$lib/utils/content-merge.js';
import type { NoteFilter } from '$lib/types/index.js';

interface NoteRow {
	id: string;
	userId: number;
	title: string;
	content: string;
	color: string;
	pinned: boolean;
	archived: boolean;
	trashed: boolean;
	trashedAt: Date | null;
	checklistMode: boolean;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
	version: number;
}

function hydrateNotes(db: Db, noteRows: NoteRow[], userId: number) {
	const noteIds = noteRows.map((n) => n.id);
	const tagMap = fetchTagsForNotes(db, noteIds);
	const attachmentMap = fetchAttachmentsForNotes(db, noteIds);
	const collabMap = fetchCollaboratorsForNotes(db, noteIds);
	const shareMap = fetchSharesForNotes(db, noteIds);

	return noteRows.map((note) => {
		const collaborators = collabMap.get(note.id) ?? [];
		const isOwner = note.userId === userId;
		const isShared = collaborators.length > 0;
		return {
			...note,
			tags: tagMap.get(note.id) ?? [],
			attachments: attachmentMap.get(note.id) ?? [],
			collaborators,
			isOwner,
			isShared,
			shareToken: shareMap.get(note.id) ?? undefined
		};
	});
}

/**
 * Get shared notes for a user with per-user state overlay.
 */
function getSharedNotes(db: Db, userId: number, filter: 'all' | 'archived'): NoteRow[] {
	const rows = db
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
				filter === 'archived'
					? sql`COALESCE(${noteUserState.archived}, 0) = 1`
					: sql`COALESCE(${noteUserState.archived}, 0) = 0`
			)
		)
		.all();

	return rows as NoteRow[];
}

export function listNotes(db: Db, userId: number, filter: NoteFilter = 'all') {
	// Owned notes
	let conditions;
	switch (filter) {
		case 'archived':
			conditions = and(eq(notes.userId, userId), eq(notes.archived, true), eq(notes.trashed, false));
			break;
		case 'trashed':
			// Collaborators never see trashed notes — only owner's trashed notes
			conditions = and(eq(notes.userId, userId), eq(notes.trashed, true));
			break;
		default:
			conditions = and(eq(notes.userId, userId), eq(notes.archived, false), eq(notes.trashed, false));
	}

	const ownedNotes = db
		.select()
		.from(notes)
		.where(conditions)
		.all() as NoteRow[];

	// Shared notes (not for trashed filter — collaborators don't see trash)
	let sharedNotes: NoteRow[] = [];
	if (filter !== 'trashed') {
		sharedNotes = getSharedNotes(db, userId, filter === 'archived' ? 'archived' : 'all');
	}

	const combined = [...ownedNotes, ...sharedNotes];
	combined.sort((a, b) => {
		// Pinned first, then by updatedAt descending
		if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
		return b.updatedAt.getTime() - a.updatedAt.getTime();
	});

	return hydrateNotes(db, combined, userId);
}

export function getNote(db: Db, userId: number, id: string) {
	const { canAccess, isOwner } = canAccessNote(db, id, userId);
	if (!canAccess) return null;

	const note = db.select().from(notes).where(eq(notes.id, id)).get();
	if (!note) return null;

	let effectiveNote = note as NoteRow;

	// For collaborators, overlay per-user state
	if (!isOwner) {
		const userState = db
			.select()
			.from(noteUserState)
			.where(and(eq(noteUserState.noteId, id), eq(noteUserState.userId, userId)))
			.get();
		effectiveNote = {
			...note,
			pinned: userState?.pinned ?? false,
			archived: userState?.archived ?? false,
			sortOrder: userState?.sortOrder ?? 0
		};
	}

	const result = hydrateNotes(db, [effectiveNote], userId);
	const hydrated = result[0];
	if (!hydrated) return null;

	return { ...hydrated, backlinks: fetchBacklinksForNote(db, id, userId) };
}

export interface CreateNoteInput {
	id?: string;
	title?: string;
	content?: string;
	color?: string;
	pinned?: boolean;
	checklistMode?: boolean;
	sortOrder?: number;
}

export function createNote(db: Db, userId: number, input: CreateNoteInput) {
	const now = new Date();
	const id = input.id || uuidv4();

	const newNote = {
		id,
		userId,
		title: input.title || '',
		content: input.content || '',
		color: input.color || 'default',
		pinned: input.pinned || false,
		archived: false,
		trashed: false,
		trashedAt: null,
		checklistMode: input.checklistMode || false,
		sortOrder: input.sortOrder || 0,
		createdAt: now,
		updatedAt: now,
		version: 1
	};

	const content = `${newNote.title} ${newNote.content}`;
	const extractedTags = extractTags(content);

	db.transaction((tx) => {
		tx.insert(notes).values(newNote).run();
	});
	syncNoteTags(db, id, extractedTags, userId);

	const extractedLinks = extractNoteLinks(content);
	syncNoteLinks(db, id, extractedLinks);

	return { ...newNote, tags: extractedTags };
}

export interface UpdateNoteInput {
	title?: string;
	content?: string;
	color?: string;
	pinned?: boolean;
	archived?: boolean;
	trashed?: boolean;
	checklistMode?: boolean;
	sortOrder?: number;
	baseVersion?: number;
}

/** Per-user fields that go to noteUserState for collaborators */
const PER_USER_FIELDS = ['pinned', 'archived', 'sortOrder'] as const;

export function updateNote(db: Db, userId: number, id: string, input: UpdateNoteInput) {
	const { canAccess, isOwner } = canAccessNote(db, id, userId);
	if (!canAccess) return null;

	const existing = db.select().from(notes).where(eq(notes.id, id)).get();
	if (!existing) return null;

	// Collaborators cannot trash notes
	if (!isOwner && input.trashed !== undefined) {
		return null;
	}

	const now = new Date();

	// Shared fields: update the notes table (all participants can edit content)
	const sharedUpdates: Record<string, unknown> = {
		updatedAt: now,
		version: existing.version + 1
	};
	let hasSharedUpdates = false;

	if (input.title !== undefined) { sharedUpdates.title = input.title; hasSharedUpdates = true; }
	if (input.content !== undefined) {
		// Preserve concurrent edits at line/block granularity when the client
		// saved from an older note version.
		const hasConcurrentEdit = input.baseVersion !== undefined
			&& input.baseVersion < existing.version;

		sharedUpdates.content = hasConcurrentEdit
			? mergeContentUpdate({
				baseContent: getBaseContent(db, id, input.baseVersion),
				incomingContent: input.content,
				currentContent: existing.content
			})
			: input.content;
		hasSharedUpdates = true;
	}
	if (input.color !== undefined) { sharedUpdates.color = input.color; hasSharedUpdates = true; }
	if (input.checklistMode !== undefined) { sharedUpdates.checklistMode = input.checklistMode; hasSharedUpdates = true; }

	if (isOwner) {
		// Owner: per-user fields go to notes table directly
		if (input.pinned !== undefined) { sharedUpdates.pinned = input.pinned; hasSharedUpdates = true; }
		if (input.archived !== undefined) { sharedUpdates.archived = input.archived; hasSharedUpdates = true; }
		if (input.trashed !== undefined) {
			sharedUpdates.trashed = input.trashed;
			sharedUpdates.trashedAt = input.trashed ? now : null;
			hasSharedUpdates = true;
		}
		if (input.sortOrder !== undefined) { sharedUpdates.sortOrder = input.sortOrder; hasSharedUpdates = true; }
	}

	const hasActualContentChange =
		(input.title !== undefined && input.title !== existing.title) ||
		(sharedUpdates.content !== undefined && sharedUpdates.content !== existing.content) ||
		(input.color !== undefined && input.color !== existing.color) ||
		(input.checklistMode !== undefined && input.checklistMode !== existing.checklistMode);

	if (hasActualContentChange) {
		createSnapshot(db, id, {
			version: existing.version,
			title: existing.title,
			content: existing.content,
			checklistMode: existing.checklistMode,
			color: existing.color
		});
	}

	if (hasSharedUpdates || isOwner) {
		db.update(notes).set(sharedUpdates).where(eq(notes.id, id)).run();
	}

	// Collaborator: per-user fields go to noteUserState
	if (!isOwner) {
		const hasPerUserFields = PER_USER_FIELDS.some((f) => input[f] !== undefined);
		if (hasPerUserFields) {
			const userState = db
				.select()
				.from(noteUserState)
				.where(and(eq(noteUserState.noteId, id), eq(noteUserState.userId, userId)))
				.get();

			if (userState) {
				const stateUpdates: Record<string, unknown> = {};
				if (input.pinned !== undefined) stateUpdates.pinned = input.pinned;
				if (input.archived !== undefined) stateUpdates.archived = input.archived;
				if (input.sortOrder !== undefined) stateUpdates.sortOrder = input.sortOrder;
				db.update(noteUserState)
					.set(stateUpdates)
					.where(and(eq(noteUserState.noteId, id), eq(noteUserState.userId, userId)))
					.run();
			} else {
				db.insert(noteUserState)
					.values({
						noteId: id,
						userId,
						pinned: input.pinned ?? false,
						archived: input.archived ?? false,
						sortOrder: input.sortOrder ?? 0
					})
					.run();
			}
		}
	}

	if (input.title !== undefined || input.content !== undefined) {
		const updated = db.select().from(notes).where(eq(notes.id, id)).get();
		if (updated) {
			const content = `${updated.title} ${updated.content}`;
			const extractedTags = extractTags(content);
			syncNoteTags(db, id, extractedTags, existing.userId);
			const extractedLinks = extractNoteLinks(content);
			syncNoteLinks(db, id, extractedLinks);
		}
	}

	return getNote(db, userId, id);
}

export function deleteNote(db: Db, userId: number, id: string): boolean {
	const existing = db
		.select()
		.from(notes)
		.where(and(eq(notes.id, id), eq(notes.userId, userId)))
		.get();
	if (!existing) return false;

	db.delete(notes)
		.where(and(eq(notes.id, id), eq(notes.userId, userId)))
		.run();
	return true;
}

export function searchNotes(db: Db, userId: number, query: string) {
	if (!query) return [];

	const pattern = `%${query}%`;

	// Owned notes matching query
	const ownedResults = db
		.select()
		.from(notes)
		.where(
			and(
				eq(notes.userId, userId),
				eq(notes.trashed, false),
				or(like(notes.title, pattern), like(notes.content, pattern))
			)
		)
		.all();

	// Shared notes matching query
	const sharedResults = db
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
				or(like(notes.title, pattern), like(notes.content, pattern))
			)
		)
		.all();

	// Tag search for owned notes
	const tagResults = db
		.select({ noteId: noteTags.noteId })
		.from(noteTags)
		.innerJoin(tags, eq(noteTags.tagId, tags.id))
		.where(and(like(tags.name, pattern), eq(tags.userId, userId)))
		.all();

	const resultIds = new Set([...ownedResults.map((n) => n.id), ...sharedResults.map((n) => n.id)]);
	const extraNoteIds = [...new Set(tagResults.map((r) => r.noteId))].filter(
		(id) => !resultIds.has(id)
	);

	let extraNotes: typeof ownedResults = [];
	if (extraNoteIds.length > 0) {
		extraNotes = db
			.select()
			.from(notes)
			.where(and(eq(notes.userId, userId), inArray(notes.id, extraNoteIds), eq(notes.trashed, false)))
			.all();
	}

	const combined = [...ownedResults, ...sharedResults, ...extraNotes] as NoteRow[];
	return hydrateNotes(db, combined, userId);
}

export function listAllTags(db: Db, userId: number) {
	return db.select().from(tags).where(eq(tags.userId, userId)).all();
}

export function reorderNotes(db: Db, userId: number, orders: { id: string; sortOrder: number }[]) {
	const now = new Date();
	for (const { id, sortOrder } of orders) {
		const { canAccess, isOwner } = canAccessNote(db, id, userId);
		if (!canAccess) continue;

		if (isOwner) {
			db.update(notes)
				.set({ sortOrder, updatedAt: now })
				.where(and(eq(notes.id, id), eq(notes.userId, userId)))
				.run();
		} else {
			// Collaborator: upsert into noteUserState
			const existing = db
				.select()
				.from(noteUserState)
				.where(and(eq(noteUserState.noteId, id), eq(noteUserState.userId, userId)))
				.get();
			if (existing) {
				db.update(noteUserState)
					.set({ sortOrder })
					.where(and(eq(noteUserState.noteId, id), eq(noteUserState.userId, userId)))
					.run();
			} else {
				db.insert(noteUserState)
					.values({ noteId: id, userId, pinned: false, archived: false, sortOrder })
					.run();
			}
		}
	}
}
