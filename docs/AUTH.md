# Authentication

Crumbs supports password-based authentication, optional OAuth/SSO via Google, GitHub, or any OpenID Connect (OIDC) provider (e.g. Authentik, Keycloak, Okta, Auth0), and optional single sign-on through an authenticating reverse proxy ([trusted header authentication](#reverse-proxy-trusted-header-authentication)).

## First-run setup

On first launch, Crumbs presents a setup screen to create the initial admin account with email and password (minimum 8 characters). This account becomes the instance administrator.

## Password authentication

- Passwords are hashed with **Argon2** (argon2id variant)
- Sessions use httpOnly cookies with 30-day expiry
- Admins can revoke the sessions of, and reset the password of, users other than themselves via **Settings > Users** — see [Admin password resets](#admin-password-resets)

### Admin password resets

An admin can reset the password of any user other than themselves. Crumbs generates the new password and shows it once in that user's row — copy it and pass it to the user out of band, because it is not stored anywhere and cannot be shown again once dismissed. If SMTP is configured Crumbs also tries to notify the user that their password was reset, but the attempt is best-effort: a delivery failure is logged on the server and never surfaced in the UI, so a successful reset is not evidence the user was told. The notification never contains the password.

The control appears on every row, but is unavailable in two cases:

- **Your own row** — change your own password in **Settings > Profile**, which verifies your current password first.
- **While a generated password is still on screen** — dismiss it first if you need to generate another.

A reset enables password login for that account if it was not already enabled — including OAuth-only accounts — without removing their SSO link. Both sign-in methods can coexist.

A reset **revokes all of the user's sessions** — they must sign in again with the new password (or via OAuth if linked). **Disable password login** is a separate action on rows where password login is enabled; it clears the stored hash, turns off password login, and revokes all sessions. It is not offered on your own row.

A displayed password is only good until that account's password changes again: any later reset — by another admin, or by the user themselves from **Settings > Profile** — silently invalidates one still on screen, and nothing marks it as stale. Separately, if Crumbs cannot confirm a reset it says so and shows the password anyway; keep that one, since it may or may not have been applied, and reset again if the user cannot sign in.

> **No password recovery.** Crumbs has no forgot-password flow. An admin who forgets their own password cannot reset it themselves: the admin control excludes their own row, and the profile flow requires the current password. Another admin can reset you, so keep a second admin account as cheap insurance. Failing that, if an OAuth/SSO provider is configured and your account's email matches your identity there, signing in with that provider gets you back in without a password. An admin can also enable password login on an OAuth-linked account via **Settings > Users**. With no other admin and no provider configured, there is no way back in through the app.

## OAuth / SSO

OAuth providers are **auto-enabled** when their environment variables are set — no code changes needed. The login page dynamically shows buttons for each configured provider.

### How it works

1. User clicks an OAuth button on the login page
2. Crumbs redirects to the provider's authorization endpoint (with PKCE for Google and OIDC)
3. Provider authenticates the user and redirects back to Crumbs
4. Crumbs validates the response, extracts the user's email and name
5. If a matching user exists (by provider ID or email), a session is created
6. If no matching user exists, the login is rejected (invite-only model)

### Invite-only model

OAuth does **not** auto-create accounts. Users must be pre-created by an admin:

1. Go to **Settings > Users** and fill in the **Create User** form
2. Create the user with the **same email** they use on the OAuth provider
3. The user can now log in via OAuth — their account is automatically linked on first sign-in

After initial linking, the user is identified by their provider-specific ID (`sub` claim), so email changes on the provider side won't break login.

Tick **OAuth-only (no password)** when creating these accounts — the provider is how they will sign in. An admin can later enable password login via **Settings > Users** if the IdP becomes unavailable. If you set a password at invite time, it keeps working after the user's first OAuth sign-in — both methods coexist independently.

### Environment variables

#### Google OAuth

| Variable | Description |
|----------|-------------|
| `AUTH_GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `AUTH_GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |

**Callback URL:** `https://<your-domain>/api/auth/oauth/google/callback`

Setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add the callback URL above as an authorized redirect URI
4. Copy the client ID and secret into your environment

#### GitHub OAuth

| Variable | Description |
|----------|-------------|
| `AUTH_GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `AUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |

**Callback URL:** `https://<your-domain>/api/auth/oauth/github/callback`

Setup:
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set the authorization callback URL to the callback URL above
4. Copy the client ID and secret into your environment

#### Generic OIDC

Any OpenID Connect-compliant provider works via the generic OIDC integration. Crumbs automatically discovers endpoints via the provider's `/.well-known/openid-configuration` document.

| Variable | Description |
|----------|-------------|
| `AUTH_OIDC_ISSUER` | OIDC issuer URL (must serve `/.well-known/openid-configuration`) |
| `AUTH_OIDC_CLIENT_ID` | OIDC client ID |
| `AUTH_OIDC_CLIENT_SECRET` | OIDC client secret |
| `AUTH_OIDC_DISPLAY_NAME` | Button label on login page (default: `SSO`) |

**Callback URL:** `https://<your-domain>/api/auth/oauth/oidc/callback`

**Required scopes:** `openid`, `profile`, `email`

### Provider guides

#### Authentik

[Authentik](https://goauthentik.io/) is a self-hosted identity provider that works with Crumbs via the generic OIDC integration.

**1. Create a provider in Authentik:**

1. Open the Authentik admin panel
2. Go to **Applications > Providers > Create**
3. Select **OAuth2/OpenID Connect**
4. Configure:
   - **Name:** `Crumbs`
   - **Authorization flow:** `default-provider-authorization-implicit-consent` (or `explicit-consent` to prompt users)
   - **Client type:** `Confidential`
   - **Redirect URIs:** `https://<your-crumbs-domain>/api/auth/oauth/oidc/callback`
   - **Scopes:** `openid`, `profile`, `email`
5. Save and note the **Client ID** and **Client Secret**

**2. Create an application in Authentik:**

1. Go to **Applications > Applications > Create**
2. Configure:
   - **Name:** `Crumbs`
   - **Slug:** `crumbs`
   - **Provider:** Select the `Crumbs` provider you just created
   - **Launch URL:** `https://<your-crumbs-domain>` (optional, for Authentik's app dashboard)
3. Save

**3. Configure Crumbs:**

```yaml
# docker-compose.yml
services:
  crumbs:
    image: ghcr.io/bretzel-app/crumbs:latest
    environment:
      - ORIGIN=https://notes.example.com
      - AUTH_OIDC_ISSUER=https://authentik.example.com/application/o/crumbs/
      - AUTH_OIDC_CLIENT_ID=<client-id>
      - AUTH_OIDC_CLIENT_SECRET=<client-secret>
      - AUTH_OIDC_DISPLAY_NAME=Authentik
```

> **Note:** The issuer URL for Authentik follows the pattern `https://<authentik-domain>/application/o/<app-slug>/`. This URL must serve a valid `/.well-known/openid-configuration` document — you can verify by visiting `https://<authentik-domain>/application/o/crumbs/.well-known/openid-configuration` in your browser.

**4. Pre-create users:**

In Crumbs, go to **Settings > Users** and create accounts with emails matching your Authentik users, ticking **OAuth-only (no password)**. They can then log in via the "Authentik" button on the login page.

#### Keycloak

1. Create a new client in your Keycloak realm
2. Set **Client type** to `OpenID Connect`, **Client authentication** to `On`
3. Add the callback URL: `https://<your-crumbs-domain>/api/auth/oauth/oidc/callback`
4. Set the issuer URL to `https://<keycloak-domain>/realms/<realm-name>`

```env
AUTH_OIDC_ISSUER=https://keycloak.example.com/realms/myrealm
AUTH_OIDC_CLIENT_ID=crumbs
AUTH_OIDC_CLIENT_SECRET=<client-secret>
AUTH_OIDC_DISPLAY_NAME=Keycloak
```

#### Okta / Auth0

Use the issuer URL from your Okta org or Auth0 tenant:

```env
# Okta
AUTH_OIDC_ISSUER=https://your-org.okta.com

# Auth0
AUTH_OIDC_ISSUER=https://your-tenant.auth0.com
```

### Docker example with multiple providers

```yaml
services:
  crumbs:
    image: ghcr.io/bretzel-app/crumbs:latest
    ports:
      - "3000:3000"
    volumes:
      - crumbs-data:/data
    environment:
      - ORIGIN=https://notes.example.com
      # Google
      - AUTH_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
      - AUTH_GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
      # GitHub
      - AUTH_GITHUB_CLIENT_ID=Iv1.abc123
      - AUTH_GITHUB_CLIENT_SECRET=abc123secret
      # Authentik (OIDC)
      - AUTH_OIDC_ISSUER=https://authentik.example.com/application/o/crumbs/
      - AUTH_OIDC_CLIENT_ID=crumbs-client-id
      - AUTH_OIDC_CLIENT_SECRET=crumbs-client-secret
      - AUTH_OIDC_DISPLAY_NAME=Authentik
    restart: unless-stopped

volumes:
  crumbs-data:
```

All configured providers will appear as buttons on the login page.

## Reverse proxy (trusted header) authentication

If an authenticating reverse proxy already signs your users in, Crumbs can trust the identity that
proxy forwards and skip its own login. This covers Authelia, Authentik's proxy outpost, oauth2-proxy,
Zoraxy's SSO, and Caddy or Traefik forward auth. It is meant for proxies that are not OIDC providers,
or setups where you don't want users to sign in twice.

If your identity provider speaks OIDC, prefer [Generic OIDC](#generic-oidc). It doesn't depend on
your network layout being right. This mode trusts whatever the proxy says, so it is only as safe as
the rules in [Securing the setup](#securing-the-setup).

### How it works

1. The proxy authenticates the user and forwards the request with their email in a header
   (`Remote-Email` by default).
2. Crumbs only believes that header when the TCP connection comes from an address in
   `AUTH_PROXY_TRUSTED_IPS`, and, if configured, when the shared secret header matches. Forwarded
   addresses (`X-Forwarded-For`, `ADDRESS_HEADER`) never count for this check, because the client
   controls them.
3. The email is matched to an **existing** user, ignoring case. As with OAuth this is
   [invite-only](#invite-only-model): an email with no Crumbs account gets the login page's
   "No account found" message, and no account is created.
4. Crumbs starts an ordinary 30-day session. A request that carries the session cookie but no
   identity header keeps working, so routes your proxy leaves unauthenticated still work, and so
   does offline sync.
5. **The proxy's identity always wins.** If the proxy names a different user from the one who owns
   the current session, Crumbs ends that session and signs the new user in. This also applies to a
   session started with a password or OAuth.
6. Signing out in Crumbs ends the Crumbs session and sends the browser to `AUTH_PROXY_LOGOUT_URL`,
   so the proxy's session ends too. Otherwise the next request would sign the user straight back in.

Password and OAuth login keep working alongside this, for example when Crumbs is reached without
the proxy during maintenance.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_PROXY_ENABLED` | yes | `true` turns it on. Any other value, or unset, leaves it off. |
| `AUTH_PROXY_TRUSTED_IPS` | yes | Comma-separated addresses or CIDR ranges the proxy connects **from**, as Crumbs sees the connection. Example: `172.30.0.10` or `172.30.0.10, fd00::10`. A bare address means that one host. `0.0.0.0/0` and `::/0` are refused. |
| `AUTH_PROXY_LOGOUT_URL` | yes | Your proxy's sign-out URL. |
| `AUTH_PROXY_EMAIL_HEADER` | no | Header holding the user's email. Default: `Remote-Email`. |
| `AUTH_PROXY_SECRET_HEADER` | no | Header carrying a shared secret the proxy adds to every request. Set this and `AUTH_PROXY_SECRET` together, or neither. |
| `AUTH_PROXY_SECRET` | no | The shared secret's value. Compared in constant time. |

If `AUTH_PROXY_ENABLED=true` and a required variable is missing or invalid, Crumbs **refuses to
start**, and the error names the variable. A misconfiguration never quietly falls back to trusting
the header from anyone.

Proxy auth needs the production server (`node build`, which the Docker image uses), because only
that exposes the real connection address. Under `pnpm dev` or `pnpm preview` the header is always
ignored.

### Securing the setup

The identity header is just a claim ("I am alice@example.com"). Anyone who can make a request
appear to come from a trusted address can claim to be anyone. Three rules make that impossible:

1. **Crumbs is reachable only through the proxy.** In Docker, remove `ports:` from the Crumbs service
   and put Crumbs and the proxy on a shared network (see the example below). If the port stays
   published, anyone who reaches it bypasses the proxy entirely.
2. **Trust exactly the proxy, nothing wider.** Give the proxy container a fixed address and trust
   that single address. **Do not trust a whole Docker subnet such as `172.18.0.0/16`.** That range
   contains the network's gateway (`172.18.0.1`). Connections through published ports can arrive
   from the gateway: always when they come from the host itself, and usually for every outside
   connection on Docker Desktop and rootless Docker. Trusting the subnet lets each of them claim any
   identity.
3. **The proxy must strip client-sent identity headers on every route**, including routes it doesn't
   authenticate (health checks, public paths, bypass rules). Crumbs refuses a header that holds
   several comma-joined values, which is what a proxy that *appends* to a client's header produces.
   A proxy that passes a client's header through untouched on an unauthenticated route can't be
   detected, so check your bypass rules.

The optional shared secret protects against other containers on the same network that can reach
Crumbs directly. It does **not** replace rule 3: a proxy that adds the secret to every request
also adds it to requests where a client forged the identity header.

### Example: Docker Compose

```yaml
services:
  crumbs:
    image: ghcr.io/bretzel-app/crumbs:<version>
    # No "ports:". Only the proxy can reach Crumbs.
    volumes:
      - crumbs-data:/data
    environment:
      - ORIGIN=https://notes.example.com
      - AUTH_PROXY_ENABLED=true
      - AUTH_PROXY_TRUSTED_IPS=172.30.0.10
      - AUTH_PROXY_EMAIL_HEADER=Remote-Email
      - AUTH_PROXY_LOGOUT_URL=https://auth.example.com/logout
    networks:
      - edge
    restart: unless-stopped

  proxy:
    image: <your authenticating proxy>
    ports:
      - "443:443"
    networks:
      edge:
        ipv4_address: 172.30.0.10   # the address Crumbs trusts

networks:
  edge:
    ipam:
      config:
        - subnet: 172.30.0.0/24

volumes:
  crumbs-data:
```

If the proxy runs on the host rather than in Docker, bind Crumbs to loopback only
(`ports: ["127.0.0.1:3000:3000"]`). Its connections then usually arrive from the Docker network's
gateway address. The `[proxy-auth]` log line (see [Troubleshooting](#troubleshooting)) shows the address Crumbs actually sees, so trust
that single address. Any process on the host can then also claim identities, so keep this to hosts
you control.

### Proxy settings

The header name and logout URL depend on the proxy. Common defaults are below. Check your proxy's
documentation for the exact values in your setup.

| Proxy | `AUTH_PROXY_EMAIL_HEADER` | `AUTH_PROXY_LOGOUT_URL` |
|-------|---------------------------|-------------------------|
| Authelia (with Traefik, Caddy or nginx forward auth) | `Remote-Email` | `https://<authelia-domain>/logout` |
| Authentik proxy outpost | `X-authentik-email` | `https://<crumbs-domain>/outpost.goauthentik.io/sign_out` |
| oauth2-proxy (reverse proxy mode) | `X-Forwarded-Email` | `https://<crumbs-domain>/oauth2/sign_out` |
| oauth2-proxy (nginx `auth_request`, `--set-xauthrequest`) | `X-Auth-Request-Email` | `https://<crumbs-domain>/oauth2/sign_out` |
| Zoraxy SSO | `Remote-Email` | Your Zoraxy SSO portal's logout URL |

With forward auth, the proxy only passes on the identity headers it is told to copy from the auth
server's response, so include the email header there. Examples: Traefik's
`authResponseHeaders=Remote-Email`, Caddy's `copy_headers Remote-Email`, nginx's
`auth_request_set` + `proxy_set_header`.

### Users

Create users in **Settings > Users** with the same email the proxy sends. Tick **OAuth-only (no
password)** if they should only ever sign in through the proxy.

## Security notes

- Google and OIDC flows use **PKCE** (Proof Key for Code Exchange) with the S256 challenge method. GitHub OAuth apps are protected by the `state` parameter only
- OAuth state and code verifier are stored as httpOnly cookies (10-minute expiry)
- Passwords are hashed with **Argon2** (never stored in plain text)
- Sessions expire after **30 days**
- The `ORIGIN` environment variable must match your actual domain for CSRF protection
- Always use **HTTPS** in production (via reverse proxy)
- Reverse proxy authentication trusts the proxy's identity header, so it is only safe when Crumbs is reachable exclusively through that proxy. See [Securing the setup](#securing-the-setup)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| OAuth button doesn't appear | Provider env vars not set or missing a required variable | Check all required env vars are set and restart |
| "No account found" after OAuth | User doesn't exist in Crumbs | Create the user via Settings with matching email |
| OIDC discovery fails | Issuer URL is wrong or unreachable | Verify `AUTH_OIDC_ISSUER` serves `/.well-known/openid-configuration` |
| Redirect URI mismatch | Callback URL in provider doesn't match `ORIGIN` | Ensure `ORIGIN` matches your domain and the callback URL uses the same origin |
| PKCE error | Provider doesn't support S256 PKCE | Most modern providers support it; check provider docs |
| Crumbs won't start after enabling proxy auth | A required `AUTH_PROXY_*` variable is missing or invalid | The startup error names the variable; see [Environment variables](#environment-variables-1) |
| Login page still appears after signing in at the proxy | Crumbs ignored the identity header | Check the server log for `[proxy-auth] Ignoring identity header: …`. It names the address Crumbs saw, or says the secret didn't match. Trust that exact address, not the subnet |
| No log line, and the login page still appears | The header never reaches Crumbs | Make the proxy forward the email header (e.g. Traefik `authResponseHeaders`, Caddy `copy_headers`) and match its name in `AUTH_PROXY_EMAIL_HEADER` |
| "No account found" through the proxy | No Crumbs user has the email the proxy sends | Create the user in **Settings > Users** with that email (case doesn't matter) |
| Signing out lands back in Crumbs, still signed in | `AUTH_PROXY_LOGOUT_URL` doesn't end the proxy's session | Use the proxy's real sign-out URL (see [Proxy settings](#proxy-settings)) |
