import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { getUserId } from '$lib/server/api-utils.js';
import { setTagColor } from '$lib/server/tags.js';
import { isNoteColor } from '$lib/utils/colors.js';
import { isTagName } from '$lib/utils/tags.js';

/** Set a tag's colour, or clear it with `null`. */
export const PUT: RequestHandler = async ({ params, request, ...event }) => {
	const userId = getUserId(event);
	if (!isTagName(params.name)) {
		throw error(400, 'Invalid tag name');
	}
	const body = await request.json().catch(() => null);
	const color = body?.color;
	if (color !== null && !isNoteColor(color)) {
		throw error(400, 'Invalid color');
	}
	setTagColor(db, userId, params.name, color);
	return json({ name: params.name, color: color === 'default' ? null : color });
};
