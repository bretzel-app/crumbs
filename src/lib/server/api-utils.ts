import { error, type RequestEvent } from '@sveltejs/kit';

export function getUserId(event: RequestEvent): number {
	if (!event.locals.user) throw error(401, 'Unauthorized');
	return event.locals.user.id;
}

export function requireAdmin(event: RequestEvent) {
	const user = event.locals.user;
	if (!user || user.role !== 'admin') throw error(403, 'Forbidden');
	return user;
}
