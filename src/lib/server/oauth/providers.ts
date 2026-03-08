import * as arctic from 'arctic';

export type OAuthProviderInfo = {
	id: string;
	name: string;
	icon?: string;
};

let googleClient: arctic.Google | null = null;
let githubClient: arctic.GitHub | null = null;

function getBaseUrl(): string {
	return process.env.ORIGIN || process.env.AUTH_REDIRECT_BASE || 'http://localhost:5173';
}

export function getGoogleClient(): arctic.Google | null {
	if (googleClient) return googleClient;
	const clientId = process.env.AUTH_GOOGLE_CLIENT_ID;
	const clientSecret = process.env.AUTH_GOOGLE_CLIENT_SECRET;
	if (!clientId || !clientSecret) return null;
	googleClient = new arctic.Google(clientId, clientSecret, `${getBaseUrl()}/api/auth/oauth/google/callback`);
	return googleClient;
}

export function getGithubClient(): arctic.GitHub | null {
	if (githubClient) return githubClient;
	const clientId = process.env.AUTH_GITHUB_CLIENT_ID;
	const clientSecret = process.env.AUTH_GITHUB_CLIENT_SECRET;
	if (!clientId || !clientSecret) return null;
	githubClient = new arctic.GitHub(clientId, clientSecret, `${getBaseUrl()}/api/auth/oauth/github/callback`);
	return githubClient;
}

export function getEnabledProviders(): OAuthProviderInfo[] {
	const providers: OAuthProviderInfo[] = [];
	if (getGoogleClient()) providers.push({ id: 'google', name: 'Google' });
	if (getGithubClient()) providers.push({ id: 'github', name: 'GitHub' });

	const oidcIssuer = process.env.AUTH_OIDC_ISSUER;
	const oidcClientId = process.env.AUTH_OIDC_CLIENT_ID;
	const oidcClientSecret = process.env.AUTH_OIDC_CLIENT_SECRET;
	if (oidcIssuer && oidcClientId && oidcClientSecret) {
		providers.push({
			id: 'oidc',
			name: process.env.AUTH_OIDC_DISPLAY_NAME || 'SSO'
		});
	}

	return providers;
}
