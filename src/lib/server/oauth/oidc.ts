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
	const scopes = ['openid', 'profile', 'email'];

	const url = client.createAuthorizationURLWithPKCE(
		oidcConfig.authorizationEndpoint,
		state,
		arctic.CodeChallengeMethod.S256,
		codeVerifier,
		scopes
	);

	return { url, state, codeVerifier };
}

export async function validateOidcCallback(
	code: string,
	codeVerifier: string
): Promise<{ email: string; name: string; providerId: string } | null> {
	const client = await ensureOidcClient();
	if (!client || !oidcConfig) return null;

	const tokens = await client.validateAuthorizationCode(
		oidcConfig.tokenEndpoint,
		code,
		codeVerifier
	);

	// Try to decode ID token first
	const idToken = tokens.idToken();
	if (idToken) {
		const claims = arctic.decodeIdToken(idToken) as {
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
	const accessToken = tokens.accessToken();
	const userRes = await fetch(oidcConfig.userinfoEndpoint, {
		headers: { Authorization: `Bearer ${accessToken}` }
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
