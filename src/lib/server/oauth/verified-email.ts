/**
 * Deciding whether an address an identity provider hands us is trustworthy enough
 * to claim a Crumbs account.
 *
 * This matters because sign-in falls back to matching on the asserted address when
 * no provider identity is on file: an address we accept here can log the bearer
 * into whichever account already holds it. An IdP that lets a user set an arbitrary
 * unverified address — the default posture of a self-hosted Keycloak or Authentik —
 * could otherwise hand out someone else's account.
 *
 * Pure by design, and deliberately separate from the provider adapters, which reach
 * the network and so cannot be exercised directly in a unit test.
 */

/** Non-empty trimmed form of `value`, or null. */
function cleanAddress(value: string | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

/**
 * The verified address from an OIDC-style claim set (Google and generic OIDC), or
 * null if there isn't one.
 *
 * An absent `email_verified` yields null rather than being treated as verified: a
 * missing claim is not evidence, and OIDC's userinfo response frequently omits it.
 * The comparison is strictly against `true`, since some providers serialise the
 * claim as the string `"true"`, which is truthy but says nothing we checked.
 */
export function verifiedEmailFromClaims(claims: {
	email?: string;
	email_verified?: boolean;
}): string | null {
	if (claims.email_verified !== true) return null;
	return cleanAddress(claims.email);
}

/**
 * The verified address from GitHub's `/user/emails` list, preferring the primary
 * one, or null if none is verified.
 *
 * GitHub's `/user` profile also carries an `email`, but with no verification flag
 * beside it, so it is not usable for this decision — this list is the only source
 * that says whether GitHub actually confirmed the address.
 */
export function verifiedGithubEmail(
	emails: { email: string; primary: boolean; verified: boolean }[]
): string | null {
	const verified = emails.filter((entry) => entry.verified && cleanAddress(entry.email));
	const chosen = verified.find((entry) => entry.primary) ?? verified[0];
	return chosen ? cleanAddress(chosen.email) : null;
}
