import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { processSyncPush, getChangesSince } from '$lib/sync/server.js';
import { fetchTagsForNotes } from '$lib/server/tags.js';
import { fetchAttachmentsForNotes } from '$lib/server/attachments.js';
import { getUserId } from '$lib/server/api-utils.js';

export const POST: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const { changes } = await request.json();

	if (!Array.isArray(changes)) {
		return json({ error: 'Invalid changes' }, { status: 400 });
	}

	await processSyncPush(changes, userId);
	return json({ success: true });
};

export const GET: RequestHandler = async ({ url, ...event }) => {
	const userId = getUserId(event);
	const since = parseInt(url.searchParams.get('since') || '0', 10);
	const changes = await getChangesSince(since, userId);

	const noteIds = changes.map((n) => n.id);
	const tagMap = fetchTagsForNotes(noteIds);
	const attachmentMap = fetchAttachmentsForNotes(noteIds);
	const changesWithTags = changes.map((note) => ({
		...note,
		tags: tagMap.get(note.id) ?? [],
		attachments: attachmentMap.get(note.id) ?? []
	}));

	return json(changesWithTags);
};
