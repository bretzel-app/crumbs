# Deployment Guide

Crumbs is a single Node.js server with an embedded SQLite database. Everything it stores lives in one
data folder: the database and uploaded attachments. You can run it with Docker (recommended) or
directly with Node.js.

- [Docker](#docker-recommended): quick start, configuration, updates
- [HTTPS, `ORIGIN` and reverse proxies](#https-origin-and-reverse-proxies): required before anyone
  other than you uses it
- [Backups](#backups)
- [Manual deployment (Node.js)](#manual-deployment-nodejs)
- [Environment variables](#environment-variables)
- [Production checklist](#production-checklist)

## Docker (recommended)

Images are published to `ghcr.io/bretzel-app/crumbs` for `linux/amd64` and `linux/arm64`, tagged
with every release (`0.35.2`), every minor line (`0.35`), and `latest`.

### Quick start

```bash
mkdir crumbs && cd crumbs
curl -fsSLO https://raw.githubusercontent.com/bretzel-app/crumbs/main/docker-compose.yml
docker compose up -d
```

Open http://localhost:3000 and create the admin account (email, display name and a password of at
least 8 characters).

> **The first visitor becomes the admin.** Until an account exists, the setup page is open to
> anyone who can reach the server. Create the admin account before exposing the port to a network.

This works as-is on the machine running Docker. To use Crumbs from other devices, read
[HTTPS, `ORIGIN` and reverse proxies](#https-origin-and-reverse-proxies) first: plain
`http://<server-ip>:3000` will not keep you signed in.

### Configuration

The downloaded `docker-compose.yml` is a working starting point. A typical production version:

```yaml
services:
  crumbs:
    image: ghcr.io/bretzel-app/crumbs:0.35.2   # pin a release; see "Updating"
    container_name: crumbs
    ports:
      - "127.0.0.1:3000:3000"   # only the reverse proxy on this host can reach it
    volumes:
      - crumbs-data:/data        # or a host folder: /srv/crumbs:/data
    environment:
      - ORIGIN=https://notes.example.com
      - ADDRESS_HEADER=X-Forwarded-For
      - XFF_DEPTH=1
    restart: unless-stopped

volumes:
  crumbs-data:
```

To change the port, change the host side of the mapping (`"127.0.0.1:8080:3000"`), not `PORT`: the
image's health check always probes port 3000 inside the container.

The app runs as the image's `node` user (uid 1000). On startup the container hands ownership of the
data folder to uid 1000, so a host folder created by any user works as-is. If you set `user:` in
compose, that step is skipped and the folder must already be writable by that user.

Optional features are configured with more environment variables. See
[Environment variables](#environment-variables), and [AUTH.md](AUTH.md) for OAuth/SSO.

### Updating

The repository's `docker-compose.yml` pins an exact version, so `docker compose pull` alone does
not upgrade anything. To update:

1. [Back up](#backups) the data folder. Schema upgrades are one-way.
2. Change the `image:` tag to the new version (see
   [Releases](https://github.com/bretzel-app/crumbs/releases)).
3. Apply it:

   ```bash
   docker compose pull
   docker compose up -d
   ```

The database schema is created and upgraded automatically when the server starts. There is no
migration command to run. (The `pnpm db:*` scripts are development tools; don't run them against a
production database.)

If you prefer to always follow the newest release, use the `latest` tag. Then `docker compose pull`
followed by `docker compose up -d` does upgrade.

### Health check

The image has a built-in health check that requests `/login` every 30 seconds:

```bash
docker inspect --format='{{.State.Health.Status}}' "$(docker compose ps -q crumbs)"
```

## HTTPS, `ORIGIN` and reverse proxies

### Why HTTPS is required

Crumbs marks its session cookie `Secure` everywhere except `http://localhost`. Browsers refuse to
store a `Secure` cookie over plain HTTP. So on `http://192.168.1.10:3000` the login appears to
succeed and then lands you back on the login page. Installing the app as a PWA and using it offline
also require HTTPS.

Put Crumbs behind a reverse proxy that terminates TLS (nginx, Caddy, Traefik, …). For a quick test
from another machine without TLS, tunnel to localhost instead: `ssh -L 3000:localhost:3000 server`,
then open http://localhost:3000.

### `ORIGIN` must match the browser's address bar exactly

Set `ORIGIN` to the exact URL users type: scheme, host, and port if not the default, **without a
trailing slash**. For example `ORIGIN=https://notes.example.com`.

When it doesn't match:

- Image uploads fail with `403 Cross-site POST form submissions are forbidden`, because SvelteKit's
  CSRF check compares the request's origin to `ORIGIN`.
- OAuth callback URLs are built from `ORIGIN`, so providers report a redirect URI mismatch.
- Links in notification emails point to the wrong host.

### What the proxy must do

1. **Be the only way in.** Publish Crumbs on `127.0.0.1` (or not at all, when the proxy runs in the
   same Docker network) so nobody can bypass the proxy.
2. **Pass the client address, and tell Crumbs to read it.** Login lockout (5 failed attempts in 15
   minutes locks out that address for 15 minutes) and the public share-link rate limit (60 requests
   per minute) are keyed by client IP. By default Crumbs sees the proxy's IP for every request, so
   one user's typos lock out everyone. Set `ADDRESS_HEADER=X-Forwarded-For` and `XFF_DEPTH` to the
   number of proxies in front of Crumbs (usually `1`). Only do this when Crumbs is reachable solely
   through the proxy, since otherwise clients could forge the header.
3. **Allow uploads up to 12 MB.** Attachments can be 10 MB, plus a thumbnail and multipart framing.
   nginx's default limit is 1 MB. Caddy and Traefik don't limit request bodies by default.

### nginx

```nginx
server {
    listen 443 ssl;
    server_name notes.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy

Caddy obtains certificates automatically and sets `X-Forwarded-For`:

```caddyfile
notes.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

With either proxy, set `ORIGIN=https://notes.example.com`, `ADDRESS_HEADER=X-Forwarded-For` and
`XFF_DEPTH=1` on Crumbs.

## Backups

Everything lives in the data folder (`/data` in Docker):

| Path | Contents |
|------|----------|
| `crumbs.db` | SQLite database: users, notes, versions, sessions, settings |
| `crumbs.db-wal`, `crumbs.db-shm` | SQLite write-ahead log. Part of the database while the server runs |
| `attachments/` | Uploaded images and their thumbnails |

The database runs in WAL mode, so copying the files while the server is writing can produce a
backup that doesn't open. Stop the container for the copy; it takes a few seconds:

```bash
docker compose stop crumbs
docker cp "$(docker compose ps -aq crumbs)":/data ./crumbs-backup-$(date +%F)
docker compose start crumbs
```

To restore, stop the container, copy a backup's contents back into `/data`, and start it again.
File ownership is fixed automatically on start:

```bash
docker compose stop crumbs
docker cp ./crumbs-backup-2026-10-18/. "$(docker compose ps -aq crumbs)":/data
docker compose start crumbs
```

Attachment locations are stored in the database as full paths under `DATA_DIR`. Restore into a
server with the same `DATA_DIR` (`/data` in Docker), or images won't load. This also applies when
moving between Docker and a manual install.

## Manual deployment (Node.js)

### Prerequisites

- **Node.js 22**, the version the Docker image and CI use (pinned in `.nvmrc`). `better-sqlite3`
  ships prebuilt binaries only for supported Node versions. On others, `pnpm install` tries to
  compile it and fails unless `python3`, `make` and a C++ compiler are installed.
- **pnpm**: `corepack enable` installs the version pinned in `package.json`.

### Install and build

```bash
git clone https://github.com/bretzel-app/crumbs.git
cd crumbs
git checkout v0.35.2            # optional: build a specific release
pnpm install --frozen-lockfile
pnpm build
```

Keep the checkout: `node build` loads its dependencies from `node_modules`.

### Configure

The server reads configuration from environment variables only. It does not load `.env` files by
itself, but Node can: create `/opt/crumbs/.env` (or wherever you cloned it):

```bash
DATABASE_URL=/var/lib/crumbs/crumbs.db
DATA_DIR=/var/lib/crumbs
ORIGIN=https://notes.example.com
HOST=127.0.0.1
PORT=3000
BODY_SIZE_LIMIT=12M
ADDRESS_HEADER=X-Forwarded-For
XFF_DEPTH=1
```

- Use **absolute paths**. Relative ones resolve against the directory you start the server from,
  and attachment paths are stored in the database (see [Backups](#backups)).
- `BODY_SIZE_LIMIT` is needed here. Without it the server rejects request bodies over 512 KB, so
  larger attachment uploads fail. The Docker image already sets it.

### Run

```bash
node --env-file=.env build
```

As a systemd service (`/etc/systemd/system/crumbs.service`):

```ini
[Unit]
Description=Crumbs
After=network.target

[Service]
User=crumbs
WorkingDirectory=/opt/crumbs
ExecStart=/usr/bin/node --env-file=/opt/crumbs/.env build
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

The `crumbs` user must exist and own the data folder (`/var/lib/crumbs` above). Then
`systemctl enable --now crumbs`. Put a reverse proxy in front as described in
[HTTPS, `ORIGIN` and reverse proxies](#https-origin-and-reverse-proxies).

### Update

```bash
cd /opt/crumbs
git fetch --tags
git checkout v0.36.0            # the release to upgrade to
pnpm install --frozen-lockfile
pnpm build
systemctl restart crumbs
```

Back up first: the schema upgrades automatically on start and can't be downgraded.

## Environment variables

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `ORIGIN` | Docker: `http://localhost:3000` | Public URL of the app, exactly as typed in the browser, no trailing slash. Used for the CSRF check, OAuth callbacks and email links. See [above](#origin-must-match-the-browsers-address-bar-exactly) |
| `DATABASE_URL` | Docker: `/data/crumbs.db`, else `./data/crumbs.db` | SQLite database file |
| `DATA_DIR` | Docker: `/data`, else `./data` | Folder for attachments |
| `PORT` | `3000` | HTTP port. In Docker, change the published port instead |
| `HOST` | `0.0.0.0` | Address to listen on. Use `127.0.0.1` when the proxy runs on the same host |
| `BODY_SIZE_LIMIT` | Docker: `12M`, else `512K` | Largest accepted request body. Must exceed the 10 MB attachment limit |
| `ADDRESS_HEADER` | — | Header holding the real client IP when behind a proxy, usually `X-Forwarded-For`. See [What the proxy must do](#what-the-proxy-must-do) |
| `XFF_DEPTH` | `1` | Number of trusted proxies in front of Crumbs, when `ADDRESS_HEADER=X-Forwarded-For` |

`ORIGIN`, `PORT`, `HOST`, `BODY_SIZE_LIMIT`, `ADDRESS_HEADER` and `XFF_DEPTH` are handled by
SvelteKit's Node adapter. See its
[documentation](https://svelte.dev/docs/kit/adapter-node#Environment-variables) for the others
(`PROTOCOL_HEADER`, `HOST_HEADER`, `SHUTDOWN_TIMEOUT`, …).

### OAuth / SSO (optional)

Google, GitHub and generic OIDC (Authentik, Keycloak, Okta, …) are supported, and each is enabled
when its variables are set. See **[AUTH.md](AUTH.md)** for variables, callback URLs, provider guides
and troubleshooting.

### Email notifications (optional)

Email notifications turn on when `SMTP_HOST` is set. See
[FEATURES.md](FEATURES.md#note-sharing--collaboration) for the notification types.

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | — | SMTP server hostname (e.g. `smtp.example.com`) |
| `SMTP_PORT` | `587` | `465` connects with TLS. Any other port connects in plain text and upgrades with STARTTLS when the server offers it |
| `SMTP_USER` | — | SMTP username. Leave unset for unauthenticated relays |
| `SMTP_PASS` | — | SMTP password |
| `SMTP_FROM` | `Crumbs <noreply@localhost>` | Sender address |

Sending failures are only logged on the server; the UI never reports them. After configuring SMTP,
check that mail arrives, for example by creating a test user (which sends a welcome email).

Users can opt out of share notifications in **Settings > Preferences**.

## Production checklist

- [ ] Admin account created before the server was reachable from the network
- [ ] Served over HTTPS by a reverse proxy, and `ORIGIN` is exactly the public URL
- [ ] Port published on `127.0.0.1` only (or not at all), so the proxy is the only way in
- [ ] `ADDRESS_HEADER=X-Forwarded-For` and `XFF_DEPTH` set, so lockouts and rate limits apply per client
- [ ] Proxy accepts 12 MB request bodies (nginx: `client_max_body_size 12m`)
- [ ] Backups scheduled, and a restore tried once
- [ ] Image pinned to a version, with a plan for [updating](#updating)

## MCP Server Configuration

Crumbs includes a built-in MCP (Model Context Protocol) server that allows AI assistants to interact
with your notes. See [ARCHITECTURE.md](ARCHITECTURE.md#mcp-server) for technical details and the
full tool list.

### Setup

1. Open **Settings** in the Crumbs UI
2. Create an API key (give it a name like "Claude Code")
3. Copy the key (shown only once)
4. Configure your MCP client:

```json
{
  "mcpServers": {
    "crumbs": {
      "type": "http",
      "url": "https://your-crumbs-instance/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

## Security Notes

- Always use HTTPS in production (via reverse proxy)
- The `ORIGIN` variable must match your actual domain for CSRF protection
- API keys are SHA-256 hashed (never stored in plain text)
- See [AUTH.md](AUTH.md#security-notes) for authentication security details (password hashing, session expiry, PKCE)
