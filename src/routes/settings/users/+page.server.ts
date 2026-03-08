import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { listUsers } from '$lib/server/auth.js';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw redirect(302, '/settings');
	}
	return { users: listUsers() };
};
