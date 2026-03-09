import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getUserId } from '$lib/server/api-utils.js';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { ne } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, ...event }) => {
	const userId = getUserId(event);
	const query = url.searchParams.get('q')?.trim();
	if (!query || query.length < 1) {
		return json([]);
	}

	const pattern = `%${query}%`;
	const results = db
		.select({
			id: users.id,
			displayName: users.displayName,
			email: users.email
		})
		.from(users)
		.where(
			ne(users.id, userId)
		)
		.all()
		.filter(
			(u) =>
				u.displayName.toLowerCase().includes(query.toLowerCase()) ||
				u.email.toLowerCase().includes(query.toLowerCase())
		)
		.slice(0, 10);

	return json(results);
};
