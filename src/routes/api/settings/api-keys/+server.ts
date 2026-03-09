import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listApiKeys, generateApiKey } from '$lib/server/api-keys.js';
import { getUserId } from '$lib/server/api-utils.js';

export const GET: RequestHandler = async (event) => {
	const userId = getUserId(event);
	return json(listApiKeys(userId));
};

export const POST: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const { name } = await request.json();

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const result = generateApiKey(name.trim(), userId);
	return json(result, { status: 201 });
};
