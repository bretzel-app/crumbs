import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getUserId } from '$lib/server/api-utils.js';
import { createShare, revokeShare } from '$lib/server/shares-service.js';
import { db } from '$lib/server/db/index.js';

export const POST: RequestHandler = async ({ params, url, ...event }) => {
	const userId = getUserId(event);
	const { token } = createShare(db, params.id, userId);
	return json({ token, url: `${url.origin}/s/${token}` }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, ...event }) => {
	const userId = getUserId(event);
	revokeShare(db, params.id, userId);
	return new Response(null, { status: 204 });
};
