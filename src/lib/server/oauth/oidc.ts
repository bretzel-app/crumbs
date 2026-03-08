import * as arctic from 'arctic';

let oidcClient: arctic.OAuth2Client | null = null;
let oidcConfig: {
	authorizationEndpoint: string;
	tokenEndpoint: string;
	userinfoEndpoint: string;
} | null = null;

function getOidcEnv() {
	return {
		issuer: process.env.AUTH_OIDC_ISSUER || '',
		clientId: process.env.AUTH_OIDC_CLIENT_ID || '',
		clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET || ''
	};
}

function getBaseUrl(): string {
	return process.env.ORIGIN || process.env.AUTH_REDIRECT_BASE || 'http://localhost:5173';
}

async function ensureOidcClient(): Promise<arctic.OAuth2Client | null> {
	const env = getOidcEnv();
	if (!env.issuer || !env.clientId || !env.clientSecret) return null;
	if (oidcClient && oidcConfig) return oidcClient;

	// Discover OIDC endpoints
	const discoveryUrl = env.issuer.replace(/\/$/, '') + '/.well-known/openid-configuration';
	const res = await fetch(discoveryUrl);
	if (!res.ok) return null;

	const config = (await res.json()) as {
		authorization_endpoint: string;
		token_endpoint: string;
		userinfo_endpoint: string;
	};

	oidcConfig = {
		authorizationEndpoint: config.authorization_endpoint,
		tokenEndpoint: config.token_endpoint,
		userinfoEndpoint: config.userinfo_endpoint
	};

	const redirectURI = `${getBaseUrl()}/api/auth/oauth/oidc/callback`;
	oidcClient = new arctic.OAuth2Client(env.clientId, env.clientSecret, redirectURI);

	return oidcClient;
}

export async function createOidcAuthUrl(): Promise<{ url: URL; state: string; codeVerifier: string } | null> {
	const client = await ensureOidcClient();
	if (!client || !oidcConfig) return null;

	const state = arctic.generateState();
	const codeVerifier = arctic.generateCodeVerifier();

	const url = new URL(oidcConfig.authorizationEndpoint);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('client_id', getOidcEnv().clientId);
	url.searchParams.set('redirect_uri', `${getBaseUrl()}/api/auth/oauth/oidc/callback`);
	url.searchParams.set('state', state);
	url.searchParams.set('scope', 'openid profile email');

	// PKCE
	const codeChallenge = await arctic.generateCodeChallenge(codeVerifier);
	url.searchParams.set('code_challenge', codeChallenge);
	url.searchParams.set('code_challenge_method', 'S256');

	return { url, state, codeVerifier };
}

export async function validateOidcCallback(
	code: string,
	codeVerifier: string
): Promise<{ email: string; name: string; providerId: string } | null> {
	const client = await ensureOidcClient();
	if (!client || !oidcConfig) return null;

	const env = getOidcEnv();
	const redirectURI = `${getBaseUrl()}/api/auth/oauth/oidc/callback`;

	// Exchange code for tokens
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: redirectURI,
		client_id: env.clientId,
		client_secret: env.clientSecret,
		code_verifier: codeVerifier
	});

	const tokenRes = await fetch(oidcConfig.tokenEndpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString()
	});
	if (!tokenRes.ok) return null;

	const tokenData = (await tokenRes.json()) as {
		access_token: string;
		id_token?: string;
	};

	// Try to decode ID token first
	if (tokenData.id_token) {
		const claims = arctic.decodeIdToken(tokenData.id_token) as {
			sub: string;
			email?: string;
			name?: string;
		};
		if (claims.email) {
			return {
				email: claims.email,
				name: claims.name || claims.email.split('@')[0],
				providerId: claims.sub
			};
		}
	}

	// Fallback to userinfo endpoint
	const userRes = await fetch(oidcConfig.userinfoEndpoint, {
		headers: { Authorization: `Bearer ${tokenData.access_token}` }
	});
	if (!userRes.ok) return null;

	const userInfo = (await userRes.json()) as {
		sub: string;
		email?: string;
		name?: string;
	};

	if (!userInfo.email) return null;

	return {
		email: userInfo.email,
		name: userInfo.name || userInfo.email.split('@')[0],
		providerId: userInfo.sub
	};
}
