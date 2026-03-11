# Deployment Guide

## Docker (Recommended)

### Quick Start

```bash
docker compose up -d
```

Open http://localhost:3000 and set your password.

### Custom Configuration

```yaml
# docker-compose.yml
services:
  crumbs:
    image: ghcr.io/bretzel-app/crumbs:latest
    ports:
      - "8080:3000"  # Change external port
    volumes:
      - /path/to/data:/data  # Custom data location
    environment:
      - ORIGIN=https://notes.example.com  # Your domain
    restart: unless-stopped
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name notes.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (for future live sync)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Set `ORIGIN=https://notes.example.com` in your docker-compose.yml.

### Backup

The SQLite database and attachments are stored in `/data`:

```bash
# Backup
docker compose exec crumbs tar czf - /data > crumbs-backup.tar.gz

# Or copy the volume directly
docker cp crumbs:/data ./backup
```

### Update

```bash
docker compose pull
docker compose up -d
```

## Manual Deployment (Node.js)

### Prerequisites
- Node.js 22+
- pnpm

### Steps

```bash
# Clone and install
git clone <repo-url> crumbs
cd crumbs
pnpm install

# Build
pnpm build

# Set environment
export DATABASE_URL=./data/crumbs.db
export ORIGIN=http://localhost:3000
export NODE_ENV=production

# Run
node build
```

## Environment Variables

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `./data/crumbs.db` | SQLite database path |
| `DATA_DIR` | `./data` | Directory for attachments |
| `ORIGIN` | `http://localhost:3000` | Server origin (required for CSRF) |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Set to `production` for deployment |

### OAuth / SSO (optional)

Google, GitHub, and generic OIDC (Authentik, Keycloak, Okta, etc.) are supported. Providers are auto-enabled when their env vars are set. See **[AUTH.md](AUTH.md)** for environment variables, callback URLs, provider-specific setup guides, and troubleshooting.

### Email Notifications (optional)

Email notifications are sent when a note is shared with a user. Auto-enabled when `SMTP_HOST` is set.

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | — | SMTP server hostname (e.g. `smtp.example.com`) |
| `SMTP_PORT` | `587` | SMTP port (`587` for STARTTLS, `465` for SSL) |
| `SMTP_USER` | — | SMTP username (optional for unauthenticated relays) |
| `SMTP_PASS` | — | SMTP password |
| `SMTP_FROM` | `Crumbs <noreply@localhost>` | Sender address |

Users can opt out of share notifications in **Settings > Preferences**.

## Health Check

The Docker image includes a health check that pings `/login`:

```bash
docker inspect --format='{{.State.Health.Status}}' crumbs
```

## MCP Server Configuration

Crumbs includes a built-in MCP (Model Context Protocol) server that allows AI assistants to interact with your notes. See [ARCHITECTURE.md](ARCHITECTURE.md#mcp-server) for technical details and the full tool list.

### Setup

1. Open **Settings** in the Crumbs UI
2. Create an API key (give it a name like "Claude Code")
3. Copy the key (shown only once)
4. Configure your MCP client:

```json
{
  "mcpServers": {
    "crumbs": {
      "type": "streamable-http",
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
