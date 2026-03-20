import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getSharedNote } from '$lib/server/shares-service.js';
import { checkIpRateLimit } from '$lib/server/ip-rate-limit.js';
import { db } from '$lib/server/db/index.js';

export const GET: RequestHandler = async ({ params, getClientAddress }) => {
	const ip = getClientAddress();
	if (!checkIpRateLimit(ip)) {
		throw error(429, 'Too many requests');
	}

	const data = getSharedNote(db, params.token);
	if (!data) {
		throw error(404, 'Not found');
	}

	const { noteId: _, ...publicData } = data;
	return json(publicData);
};
