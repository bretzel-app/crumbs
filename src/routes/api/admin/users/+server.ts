import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/api-utils.js';
import { listUsers, createUser } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	return json(listUsers());
};

export const POST: RequestHandler = async ({ request, ...event }) => {
	requireAdmin(event);
	const { email, displayName, password, role } = await request.json();

	if (!email || !password) {
		throw error(400, 'Email and password are required');
	}

	if (password.length < 8) {
		throw error(400, 'Password must be at least 8 characters');
	}

	const user = await createUser(email, displayName || email.split('@')[0], password, role || 'user');
	return json(user, { status: 201 });
};
