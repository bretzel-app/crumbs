import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { deleteSession } from '$lib/server/auth.js';
import { getProxyAuthConfig } from '$lib/server/proxy-auth.js';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('session');
	if (token) {
		await deleteSession(token);
	}
	cookies.delete('session', { path: '/' });
	// Behind an authenticating proxy, the next request would sign the user straight back in,
	// so the browser must also end the proxy's session
	const redirectTo = getProxyAuthConfig()?.logoutUrl ?? '/login';
	return json({ success: true, redirectTo });
};
