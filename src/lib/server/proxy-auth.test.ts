import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { users } from './db/schema.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './db/schema.js';
import { loadProxyAuthConfig, resolveProxyLogin, type ProxyAuthConfig } from './proxy-auth.js';

const ENV = {
	AUTH_PROXY_ENABLED: 'true',
	AUTH_PROXY_TRUSTED_IPS: '172.18.0.5/32, fd00:1::/64',
	AUTH_PROXY_LOGOUT_URL: 'https://auth.example.com/logout'
};

const PROXY_IP = '172.18.0.5';

let db: BetterSQLite3Database<typeof schema>;
let config: ProxyAuthConfig;

function req(headers: Record<string, string>, remoteAddress: string | undefined = PROXY_IP) {
	return { headers: new Headers(headers), remoteAddress };
}

function addUser(email: string, role: 'admin' | 'user' = 'user') {
	return db
		.insert(users)
		.values({ email, displayName: email.split('@')[0], role, createdAt: new Date() })
		.returning()
		.get();
}

beforeEach(() => {
	db = createTestDb().db;
	config = loadProxyAuthConfig(ENV)!;
});

describe('loadProxyAuthConfig', () => {
	it('is off unless AUTH_PROXY_ENABLED is exactly true', () => {
		expect(loadProxyAuthConfig({})).toBeNull();
		expect(loadProxyAuthConfig({ ...ENV, AUTH_PROXY_ENABLED: 'false' })).toBeNull();
		expect(loadProxyAuthConfig({ ...ENV, AUTH_PROXY_ENABLED: '1' })).toBeNull();
	});

	it('refuses to start without a trusted proxy address, so the header is never trusted from anyone', () => {
		expect(() => loadProxyAuthConfig({ ...ENV, AUTH_PROXY_TRUSTED_IPS: '' })).toThrow(
			/AUTH_PROXY_TRUSTED_IPS/
		);
		expect(() => loadProxyAuthConfig({ ...ENV, AUTH_PROXY_TRUSTED_IPS: undefined })).toThrow(
			/AUTH_PROXY_TRUSTED_IPS/
		);
	});

	it('refuses to start on a malformed trusted address instead of silently skipping it', () => {
		expect(() =>
			loadProxyAuthConfig({ ...ENV, AUTH_PROXY_TRUSTED_IPS: '172.18.0.5/32, not-an-ip' })
		).toThrow(/not-an-ip/);
		expect(() => loadProxyAuthConfig({ ...ENV, AUTH_PROXY_TRUSTED_IPS: '10.0.0.0/33' })).toThrow(
			/10\.0\.0\.0\/33/
		);
	});

	it('refuses a range that trusts every address, which would let any client claim any identity', () => {
		expect(() => loadProxyAuthConfig({ ...ENV, AUTH_PROXY_TRUSTED_IPS: '0.0.0.0/0' })).toThrow(
			/0\.0\.0\.0\/0/
		);
		expect(() => loadProxyAuthConfig({ ...ENV, AUTH_PROXY_TRUSTED_IPS: '::/0' })).toThrow(/::\/0/);
	});

	it('refuses to start without a logout URL, since a Crumbs-only logout is undone by the next request', () => {
		expect(() => loadProxyAuthConfig({ ...ENV, AUTH_PROXY_LOGOUT_URL: '' })).toThrow(
			/AUTH_PROXY_LOGOUT_URL/
		);
	});

	it('refuses a secret header name without a secret value, and the reverse', () => {
		expect(() =>
			loadProxyAuthConfig({ ...ENV, AUTH_PROXY_SECRET_HEADER: 'X-Proxy-Secret' })
		).toThrow(/AUTH_PROXY_SECRET/);
		expect(() => loadProxyAuthConfig({ ...ENV, AUTH_PROXY_SECRET: 's3cret' })).toThrow(
			/AUTH_PROXY_SECRET_HEADER/
		);
	});
});

describe('resolveProxyLogin', () => {
	it('logs in the user whose email the trusted proxy forwards', () => {
		const alice = addUser('alice@example.com');
		const result = resolveProxyLogin(config, req({ 'Remote-Email': 'alice@example.com' }), null, db);
		expect(result).toEqual({
			kind: 'login',
			user: { id: alice.id, email: 'alice@example.com', displayName: 'alice', role: 'user' }
		});
	});

	it('reads the email from Remote-Email unless another header is configured', () => {
		addUser('alice@example.com');
		const custom = loadProxyAuthConfig({ ...ENV, AUTH_PROXY_EMAIL_HEADER: 'X-Forwarded-Email' })!;
		expect(
			resolveProxyLogin(custom, req({ 'X-Forwarded-Email': 'alice@example.com' }), null, db).kind
		).toBe('login');
		expect(
			resolveProxyLogin(custom, req({ 'Remote-Email': 'alice@example.com' }), null, db).kind
		).toBe('none');
	});

	it('ignores the header when the connection does not come from a trusted proxy, naming the address', () => {
		addUser('alice@example.com');
		const headers = { 'Remote-Email': 'alice@example.com' };
		expect(resolveProxyLogin(config, req(headers, '172.18.0.1'), null, db)).toEqual({
			kind: 'ignored',
			reason: expect.stringContaining('172.18.0.1')
		});
		expect(resolveProxyLogin(config, req(headers, '192.168.1.20'), null, db)).toEqual({
			kind: 'ignored',
			reason: expect.stringContaining('192.168.1.20')
		});
	});

	it('treats an untrusted connection without the header as ordinary traffic', () => {
		expect(resolveProxyLogin(config, req({}, '192.168.1.20'), null, db)).toEqual({ kind: 'none' });
	});

	it('ignores the header when the peer address is unknown (dev server, no socket)', () => {
		addUser('alice@example.com');
		const headers = new Headers({ 'Remote-Email': 'alice@example.com' });
		expect(resolveProxyLogin(config, { headers, remoteAddress: undefined }, null, db)).toMatchObject({
			kind: 'ignored'
		});
	});

	it('trusts an IPv4 proxy that reaches a dual-stack server as an IPv4-mapped IPv6 address', () => {
		addUser('alice@example.com');
		const result = resolveProxyLogin(
			config,
			req({ 'Remote-Email': 'alice@example.com' }, '::ffff:172.18.0.5'),
			null,
			db
		);
		expect(result.kind).toBe('login');
	});

	it('trusts IPv6 proxies inside a configured IPv6 range', () => {
		addUser('alice@example.com');
		const headers = { 'Remote-Email': 'alice@example.com' };
		expect(resolveProxyLogin(config, req(headers, 'fd00:1::42'), null, db).kind).toBe('login');
		expect(resolveProxyLogin(config, req(headers, 'fd00:2::42'), null, db).kind).toBe('ignored');
	});

	it('accepts a bare address in the trusted list as a single host', () => {
		addUser('alice@example.com');
		const single = loadProxyAuthConfig({ ...ENV, AUTH_PROXY_TRUSTED_IPS: '10.0.0.7' })!;
		const headers = { 'Remote-Email': 'alice@example.com' };
		expect(resolveProxyLogin(single, req(headers, '10.0.0.7'), null, db).kind).toBe('login');
		expect(resolveProxyLogin(single, req(headers, '10.0.0.8'), null, db).kind).toBe('ignored');
	});

	it('does nothing when a trusted request carries no identity header', () => {
		addUser('alice@example.com');
		expect(resolveProxyLogin(config, req({}), null, db)).toEqual({ kind: 'none' });
		expect(resolveProxyLogin(config, req({ 'Remote-Email': '  ' }), null, db)).toEqual({
			kind: 'none'
		});
	});

	it('rejects a header that carries several values, as when a proxy appends instead of replacing a client-sent one', () => {
		addUser('alice@example.com');
		addUser('mallory@example.com');
		const headers = new Headers();
		headers.append('Remote-Email', 'alice@example.com');
		headers.append('Remote-Email', 'mallory@example.com');
		expect(resolveProxyLogin(config, { headers, remoteAddress: PROXY_IP }, null, db)).toEqual({
			kind: 'ignored',
			reason: expect.stringContaining('Remote-Email')
		});
	});

	it('matches the stored email regardless of case and surrounding whitespace', () => {
		const alice = addUser('Alice@Example.com');
		const result = resolveProxyLogin(config, req({ 'Remote-Email': ' ALICE@example.COM ' }), null, db);
		expect(result).toMatchObject({ kind: 'login', user: { id: alice.id } });
	});

	it('reports an unknown identity instead of creating an account (invite-only)', () => {
		const result = resolveProxyLogin(config, req({ 'Remote-Email': 'stranger@example.com' }), null, db);
		expect(result).toEqual({ kind: 'unknown', email: 'stranger@example.com' });
		expect(db.select().from(users).all()).toHaveLength(0);
	});

	it('keeps the current session when the proxy names the same user', () => {
		addUser('alice@example.com');
		expect(
			resolveProxyLogin(config, req({ 'Remote-Email': 'alice@example.com' }), 'Alice@example.com', db)
		).toEqual({ kind: 'keep' });
	});

	it('switches user when the proxy names someone other than the session owner', () => {
		addUser('alice@example.com');
		const bob = addUser('bob@example.com');
		const result = resolveProxyLogin(
			config,
			req({ 'Remote-Email': 'bob@example.com' }),
			'alice@example.com',
			db
		);
		expect(result).toMatchObject({ kind: 'login', user: { id: bob.id } });
	});

	describe('with a shared secret', () => {
		let withSecret: ProxyAuthConfig;

		beforeEach(() => {
			addUser('alice@example.com');
			withSecret = loadProxyAuthConfig({
				...ENV,
				AUTH_PROXY_SECRET_HEADER: 'X-Proxy-Secret',
				AUTH_PROXY_SECRET: 'correct horse battery staple'
			})!;
		});

		it('logs in when the proxy sends the right secret', () => {
			const result = resolveProxyLogin(
				withSecret,
				req({ 'Remote-Email': 'alice@example.com', 'X-Proxy-Secret': 'correct horse battery staple' }),
				null,
				db
			);
			expect(result.kind).toBe('login');
		});

		it('ignores the identity when the secret is wrong, missing, or a prefix of the real one', () => {
			for (const secret of ['wrong', '', 'correct horse']) {
				const headers: Record<string, string> = { 'Remote-Email': 'alice@example.com' };
				if (secret) headers['X-Proxy-Secret'] = secret;
				expect(resolveProxyLogin(withSecret, req(headers), null, db)).toEqual({
					kind: 'ignored',
					reason: expect.stringContaining('X-Proxy-Secret')
				});
			}
		});
	});
});
