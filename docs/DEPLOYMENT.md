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

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `./data/crumbs.db` | SQLite database path |
| `DATA_DIR` | `./data` | Directory for attachments |
| `ORIGIN` | `http://localhost:3000` | Server origin (required for CSRF) |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Set to `production` for deployment |

## Health Check

The Docker image includes a health check that pings `/login`:

```bash
docker inspect --format='{{.State.Health.Status}}' crumbs
```

## MCP Server Configuration

Crumbs includes a built-in MCP (Model Context Protocol) server that allows AI assistants to interact with your notes.

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

### Available Tools

| Tool | Description |
|------|-------------|
| `list_notes` | List notes (filter by status/tag) |
| `get_note` | Get a note by ID |
| `create_note` | Create a new note |
| `update_note` | Update a note |
| `trash_note` / `restore_note` | Move to/from trash |
| `archive_note` / `unarchive_note` | Archive/unarchive |
| `delete_note` | Permanently delete |
| `search_notes` | Full-text search |
| `list_tags` | List all tags |
| `pin_note` | Pin/unpin a note |
| `reorder_notes` | Set sort orders |
| `upload_image` | Attach image from URL |

## Security Notes

- Always use HTTPS in production (via reverse proxy)
- Set a strong password (min 8 characters recommended)
- The `ORIGIN` variable must match your actual domain for CSRF protection
- Sessions expire after 30 days
- Passwords are hashed with Argon2
- API keys are SHA-256 hashed (never stored in plain text)
