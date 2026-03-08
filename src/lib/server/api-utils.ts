import { error } from '@sveltejs/kit';

type EventWithLocals = {
	locals: App.Locals;
};

export function getUserId(event: EventWithLocals): number {
	if (!event.locals.user) throw error(401, 'Unauthorized');
	return event.locals.user.id;
}

export function requireAdmin(event: EventWithLocals) {
	const user = event.locals.user;
	if (!user || user.role !== 'admin') throw error(403, 'Forbidden');
	return user;
}
