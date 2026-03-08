import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tags } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getUserId } from '$lib/server/api-utils.js';

export const GET: RequestHandler = async (event) => {
	const userId = getUserId(event);
	const allTags = await db.select().from(tags).where(eq(tags.userId, userId));
	return json(allTags);
};
