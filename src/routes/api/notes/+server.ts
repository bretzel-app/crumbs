import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getUserId } from '$lib/server/api-utils.js';
import { listNotes, createNote } from '$lib/server/notes-service.js';
import type { NoteFilter } from '$lib/types/index.js';

export const GET: RequestHandler = async ({ url, ...event }) => {
	const userId = getUserId(event);
	const filter = (url.searchParams.get('filter') || 'all') as NoteFilter;
	const result = listNotes(userId, filter);
	return json(result);
};

export const POST: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const body = await request.json();
	const newNote = createNote(userId, body);
	return json(newNote, { status: 201 });
};
