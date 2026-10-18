import { BlockList, isIP } from 'node:net';
import { createHash, timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db, type Db } from './db/index.js';
import { users } from './db/schema.js';

/**
 * Trusted header ("forward auth") login. An authenticating reverse proxy — Authelia, Authentik's
 * proxy outpost, oauth2-proxy, Zoraxy — forwards the signed-in user's email in a header, and Crumbs
 * turns it into a normal session for the matching existing user.
 *
 * The header is only believed from the proxy's own socket address. Never from X-Forwarded-For or
 * ADDRESS_HEADER: the client controls what those say.
 */

type Env = Record<string, string | undefined>;

export type ProxyAuthConfig = {
	emailHeader: string;
	trustedProxies: BlockList;
	secret: { header: string; digest: Buffer } | null;
	logoutUrl: string;
};

export type ProxyUser = { id: number; email: string; displayName: string; role: 'admin' | 'user' };

export type ProxyLoginResult =
	/** No trusted identity on this request: leave any existing session alone */
	| { kind: 'none' }
	/** The proxy names the user who already owns the session */
	| { kind: 'keep' }
	/** Start a session for this user, replacing any session owned by someone else */
	| { kind: 'login'; user: ProxyUser }
	/** The proxy vouches for an email with no Crumbs account (invite-only, nothing is created) */
	| { kind: 'unknown'; email: string };

/** Returns null when proxy auth is off. Throws on any misconfiguration so it fails closed and loud. */
export function loadProxyAuthConfig(env: Env = process.env): ProxyAuthConfig | null {
	if (env.AUTH_PROXY_ENABLED !== 'true') return null;

	const ranges = (env.AUTH_PROXY_TRUSTED_IPS ?? '')
		.split(',')
		.map((r) => r.trim())
		.filter(Boolean);
	if (ranges.length === 0) {
		throw new Error(
			'AUTH_PROXY_ENABLED is true but AUTH_PROXY_TRUSTED_IPS is empty: list the reverse proxy address(es) the identity header may come from'
		);
	}
	const trustedProxies = new BlockList();
	for (const range of ranges) addRange(trustedProxies, range);

	const logoutUrl = env.AUTH_PROXY_LOGOUT_URL?.trim();
	if (!logoutUrl) {
		throw new Error(
			"AUTH_PROXY_ENABLED is true but AUTH_PROXY_LOGOUT_URL is empty: without the proxy's logout URL, signing out of Crumbs is undone by the next request"
		);
	}

	const secretHeader = env.AUTH_PROXY_SECRET_HEADER?.trim();
	const secret = env.AUTH_PROXY_SECRET;
	if (secretHeader && !secret) {
		throw new Error('AUTH_PROXY_SECRET_HEADER is set but AUTH_PROXY_SECRET is empty');
	}
	if (secret && !secretHeader) {
		throw new Error('AUTH_PROXY_SECRET is set but AUTH_PROXY_SECRET_HEADER is empty');
	}

	return {
		emailHeader: env.AUTH_PROXY_EMAIL_HEADER?.trim() || 'Remote-Email',
		trustedProxies,
		secret: secretHeader && secret ? { header: secretHeader, digest: sha256(secret) } : null,
		logoutUrl
	};
}

function addRange(list: BlockList, range: string): void {
	const [address, prefix, ...rest] = range.split('/');
	const family = isIP(address);
	const maxBits = family === 6 ? 128 : 32;
	const bits = prefix === undefined ? maxBits : Number(prefix);
	const valid =
		family !== 0 &&
		rest.length === 0 &&
		(prefix === undefined || /^\d+$/.test(prefix)) &&
		bits >= 0 &&
		bits <= maxBits;
	if (!valid) {
		throw new Error(`AUTH_PROXY_TRUSTED_IPS: "${range}" is not an IP address or CIDR range`);
	}
	if (bits === 0) {
		throw new Error(
			`AUTH_PROXY_TRUSTED_IPS: "${range}" trusts every address, so any client could claim any identity`
		);
	}
	list.addSubnet(address, bits, family === 6 ? 'ipv6' : 'ipv4');
}

function sha256(value: string): Buffer {
	return createHash('sha256').update(value).digest();
}

function fromTrustedProxy(config: ProxyAuthConfig, remoteAddress: string | undefined): boolean {
	if (!remoteAddress) return false;
	const family = isIP(remoteAddress);
	if (family === 0) return false;
	return config.trustedProxies.check(remoteAddress, family === 6 ? 'ipv6' : 'ipv4');
}

/**
 * Decide what the proxy's identity header means for this request.
 * `remoteAddress` must be the TCP peer address, not a forwarded one.
 */
export function resolveProxyLogin(
	config: ProxyAuthConfig,
	request: { headers: Headers; remoteAddress: string | undefined },
	currentUserEmail: string | null,
	dbInstance: Db = db
): ProxyLoginResult {
	if (!fromTrustedProxy(config, request.remoteAddress)) return { kind: 'none' };

	if (config.secret) {
		const sent = request.headers.get(config.secret.header);
		// Compare digests: equal length, so timingSafeEqual never throws or leaks the secret's length
		if (sent === null || !timingSafeEqual(sha256(sent), config.secret.digest)) {
			return { kind: 'none' };
		}
	}

	const email = request.headers.get(config.emailHeader)?.trim().toLowerCase();
	// Several values arrive comma-joined: the proxy appended to a client-sent header instead of replacing it
	if (!email || /[,\s]/.test(email)) return { kind: 'none' };

	if (currentUserEmail?.toLowerCase() === email) return { kind: 'keep' };

	const user = dbInstance
		.select({ id: users.id, email: users.email, displayName: users.displayName, role: users.role })
		.from(users)
		.where(sql`lower(${users.email}) = ${email}`)
		.get();
	return user ? { kind: 'login', user } : { kind: 'unknown', email };
}
