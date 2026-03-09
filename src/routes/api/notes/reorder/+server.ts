import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { reorderNotes } from '$lib/server/notes-service.js';
import { getUserId } from '$lib/server/api-utils.js';

export const POST: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const body = await request.json();
	const orders: { id: string; sortOrder: number }[] = body.orders;

	if (!Array.isArray(orders)) {
		return json({ error: 'Invalid payload' }, { status: 400 });
	}

	reorderNotes(userId, orders);
	return json({ ok: true });
};
