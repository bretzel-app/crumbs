import type { Handle, RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, isSetupComplete, createSession, deleteSession } from '$lib/server/auth.js';
import { validateApiKey, getUserForApiKey } from '$lib/server/api-keys.js';
import { getProxyAuthConfig, resolveProxyLogin, type ProxyAuthConfig } from '$lib/server/proxy-auth.js';
import { recordLoginAttempt } from '$lib/server/rate-limit.js';
import { db } from '$lib/server/db/index.js';

// Read at startup so a misconfigured proxy auth stops the server instead of failing open later
const proxyAuth = getProxyAuthConfig();

// Why an identity header was not believed is the first thing an admin needs when setting this up.
// Each distinct reason is logged once; the cap keeps a flood of spoofing addresses from growing it.
const loggedProxyWarnings = new Set<string>();
const MAX_PROXY_WARNINGS = 100;

const PUBLIC_PATHS = [
	'/login',
	'/setup',
	'/api/auth/login',
	'/api/auth/setup',
	'/api/auth/oauth',
	'/s/',
	'/api/shared'
];

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Initialize locals
	event.locals.user = null;

	// Allow public paths
	if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
		return resolve(event);
	}

	// API routes: authenticate via Bearer token if present
	if (pathname.startsWith('/api/')) {
		const authHeader = event.request.headers.get('authorization');
		const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

		if (token) {
			const { valid, userId } = validateApiKey(token);
			if (!valid || !userId) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			const user = getUserForApiKey(userId);
			if (!user) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			event.locals.user = user;
			return resolve(event);
		}
	}

	// Check if setup is complete
	const setupDone = await isSetupComplete();
	if (!setupDone) {
		if (pathname !== '/setup') {
			throw redirect(302, '/setup');
		}
		return resolve(event);
	}

	// Validate session and populate user
	const sessionToken = event.cookies.get('session');
	if (sessionToken) {
		const result = await validateSession(sessionToken);
		if (result.valid && result.user) {
			event.locals.user = result.user;
		}
	}

	if (proxyAuth && (await applyProxyAuth(event, proxyAuth)) === 'unknown') {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		throw redirect(302, '/login?error=no_account');
	}

	if (!event.locals.user) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		throw redirect(302, '/login');
	}

	return resolve(event);
};

/**
 * Trusted header auth: when the reverse proxy vouches for a user, that identity wins over any
 * existing session, so a session never outlives a switch of user at the proxy.
 */
async function applyProxyAuth(
	event: RequestEvent,
	config: ProxyAuthConfig
): Promise<'unknown' | void> {
	const result = resolveProxyLogin(
		config,
		{ headers: event.request.headers, remoteAddress: event.platform?.req?.socket.remoteAddress },
		event.locals.user?.email ?? null
	);
	if (result.kind === 'ignored') {
		if (!loggedProxyWarnings.has(result.reason) && loggedProxyWarnings.size < MAX_PROXY_WARNINGS) {
			loggedProxyWarnings.add(result.reason);
			console.warn(`[proxy-auth] Ignoring identity header: ${result.reason}`);
		}
		return;
	}
	if (result.kind === 'none' || result.kind === 'keep') return;

	const previous = event.cookies.get('session');
	if (previous) await deleteSession(previous);
	event.locals.user = null;

	if (result.kind === 'unknown') {
		event.cookies.delete('session', { path: '/' });
		return 'unknown';
	}

	const ip = event.getClientAddress();
	const token = await createSession(result.user.id, {
		userAgent: event.request.headers.get('user-agent') || undefined,
		ip
	});
	event.cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 30 * 24 * 60 * 60
	});
	recordLoginAttempt(db, ip, result.user.email, true);
	event.locals.user = result.user;
}
