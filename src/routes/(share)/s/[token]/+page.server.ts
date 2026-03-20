import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { getSharedNote } from '$lib/server/shares-service.js';
import { checkIpRateLimit } from '$lib/server/ip-rate-limit.js';
import { db } from '$lib/server/db/index.js';

export const load: PageServerLoad = async ({ params, getClientAddress }) => {
	const ip = getClientAddress();
	if (!checkIpRateLimit(ip)) {
		throw error(429, 'Too many requests');
	}

	const data = getSharedNote(db, params.token);
	if (!data) {
		throw error(404, 'This shared note does not exist or has been removed.');
	}

	return {
		token: params.token,
		title: data.title,
		content: data.content,
		checklistMode: data.checklistMode,
		color: data.color,
		attachments: data.attachments,
		createdAt: data.createdAt,
		updatedAt: data.updatedAt
	};
};
