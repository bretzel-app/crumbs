import { db as defaultDb } from './db/index.js';
import { notes, noteTags, tags } from './db/schema.js';
import { eq, and, desc, like, or, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { extractTags } from '$lib/utils/tags.js';
import { fetchTagsForNotes, syncNoteTags } from './tags.js';
import { fetchAttachmentsForNotes } from './attachments.js';
import type { NoteFilter } from '$lib/types/index.js';

const db = defaultDb;

export function listNotes(userId: number, filter: NoteFilter = 'all') {
	let conditions;
	switch (filter) {
		case 'archived':
			conditions = and(eq(notes.userId, userId), eq(notes.archived, true), eq(notes.trashed, false));
			break;
		case 'trashed':
			conditions = and(eq(notes.userId, userId), eq(notes.trashed, true));
			break;
		default:
			conditions = and(eq(notes.userId, userId), eq(notes.archived, false), eq(notes.trashed, false));
	}

	const result = db
		.select()
		.from(notes)
		.where(conditions)
		.orderBy(desc(notes.pinned), desc(notes.updatedAt))
		.all();

	const noteIds = result.map((n) => n.id);
	const tagMap = fetchTagsForNotes(noteIds);
	const attachmentMap = fetchAttachmentsForNotes(noteIds);
	return result.map((note) => ({
		...note,
		tags: tagMap.get(note.id) ?? [],
		attachments: attachmentMap.get(note.id) ?? []
	}));
}

export function getNote(userId: number, id: string) {
	const note = db
		.select()
		.from(notes)
		.where(and(eq(notes.id, id), eq(notes.userId, userId)))
		.get();
	if (!note) return null;

	const tagMap = fetchTagsForNotes([id]);
	const attachmentMap = fetchAttachmentsForNotes([id]);
	return {
		...note,
		tags: tagMap.get(id) ?? [],
		attachments: attachmentMap.get(id) ?? []
	};
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

export function createNote(userId: number, input: CreateNoteInput) {
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
	syncNoteTags(id, extractedTags);

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
}

export function updateNote(userId: number, id: string, input: UpdateNoteInput) {
	const existing = db
		.select()
		.from(notes)
		.where(and(eq(notes.id, id), eq(notes.userId, userId)))
		.get();
	if (!existing) return null;

	const now = new Date();
	const updates: Record<string, unknown> = {
		updatedAt: now,
		version: existing.version + 1
	};

	if (input.title !== undefined) updates.title = input.title;
	if (input.content !== undefined) updates.content = input.content;
	if (input.color !== undefined) updates.color = input.color;
	if (input.pinned !== undefined) updates.pinned = input.pinned;
	if (input.archived !== undefined) updates.archived = input.archived;
	if (input.trashed !== undefined) {
		updates.trashed = input.trashed;
		updates.trashedAt = input.trashed ? now : null;
	}
	if (input.checklistMode !== undefined) updates.checklistMode = input.checklistMode;
	if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

	db.update(notes)
		.set(updates)
		.where(and(eq(notes.id, id), eq(notes.userId, userId)))
		.run();

	const updated = db
		.select()
		.from(notes)
		.where(and(eq(notes.id, id), eq(notes.userId, userId)))
		.get();

	if (input.title !== undefined || input.content !== undefined) {
		const content = `${updated!.title} ${updated!.content}`;
		const extractedTags = extractTags(content);
		syncNoteTags(id, extractedTags);
	}

	const tagMap = fetchTagsForNotes([id]);
	const attachmentMap = fetchAttachmentsForNotes([id]);
	return {
		...updated,
		tags: tagMap.get(id) ?? [],
		attachments: attachmentMap.get(id) ?? []
	};
}

export function deleteNote(userId: number, id: string): boolean {
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

export function searchNotes(userId: number, query: string) {
	if (!query) return [];

	const pattern = `%${query}%`;

	const results = db
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

	const tagResults = db
		.select({ noteId: noteTags.noteId })
		.from(noteTags)
		.innerJoin(tags, eq(noteTags.tagId, tags.id))
		.where(and(like(tags.name, pattern), eq(tags.userId, userId)))
		.all();

	const resultIds = new Set(results.map((n) => n.id));
	const extraNoteIds = [...new Set(tagResults.map((r) => r.noteId))].filter(
		(id) => !resultIds.has(id)
	);

	let extraNotes: typeof results = [];
	if (extraNoteIds.length > 0) {
		extraNotes = db
			.select()
			.from(notes)
			.where(and(eq(notes.userId, userId), inArray(notes.id, extraNoteIds), eq(notes.trashed, false)))
			.all();
	}

	const combined = [...results, ...extraNotes];
	const tagMap = fetchTagsForNotes(combined.map((n) => n.id));
	return combined.map((note) => ({
		...note,
		tags: tagMap.get(note.id) ?? []
	}));
}

export function listAllTags(userId: number) {
	return db.select().from(tags).where(eq(tags.userId, userId)).all();
}

export function reorderNotes(userId: number, orders: { id: string; sortOrder: number }[]) {
	const now = new Date();
	for (const { id, sortOrder } of orders) {
		db.update(notes)
			.set({ sortOrder, updatedAt: now })
			.where(and(eq(notes.id, id), eq(notes.userId, userId)))
			.run();
	}
}
