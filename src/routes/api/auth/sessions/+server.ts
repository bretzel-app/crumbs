import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getUserId } from '$lib/server/api-utils.js';
import { listUserSessions, revokeSession, revokeAllSessions } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
	const userId = getUserId(event);
	const currentToken = event.cookies.get('session') || '';
	const sessions = listUserSessions(userId, currentToken);
	return json(sessions);
};

export const DELETE: RequestHandler = async (event) => {
	const userId = getUserId(event);
	const { sessionId, all } = await event.request.json();

	if (all) {
		const currentToken = event.cookies.get('session') || '';
		revokeAllSessions(userId, currentToken);
		return json({ success: true });
	}

	if (!sessionId) {
		throw error(400, 'sessionId is required');
	}

	const revoked = revokeSession(userId, sessionId);
	if (!revoked) {
		throw error(404, 'Session not found');
	}

	return json({ success: true });
};
