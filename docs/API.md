<!-- AUTO-GENERATED from docs/openapi.yaml — do not edit manually -->
<!-- Run: pnpm docs:api -->

# Crumbs API

REST API for Crumbs by Bretzel — a self-hostable, offline-first notes app.

Base URL: `http://localhost:3000`

All endpoints require a `session` cookie (set by login) except where noted.

## Auth

### `POST /api/auth/setup`

First-time password setup

Creates the single user account. Only works once — returns 400 if already set up.

> No authentication required.

**Request:**

```json
{
  "password": "password"
}
```

**Response:** `201`

```json
{
  "success": true
}
```

**Errors:** `400` Setup already completed or invalid password

---

### `POST /api/auth/login`

Log in

> No authentication required.

**Request:**

```json
{
  "password": "password"
}
```

**Response:** `200`

```json
{
  "success": true
}
```

**Errors:** `401` Invalid password

---

### `POST /api/auth/logout`

Log out

**Response:** `200`

```json
{
  "success": true
}
```

---

## Notes

### `GET /api/notes`

List notes

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `filter` | query | string | no |  (all, archived, trashed) — default: `all` |

**Response:** `200`

```json
[
  {
    "id": "uuid",
    "title": "title",
    "content": "content",
    "color": "default",
    "pinned": true,
    "archived": true,
    "trashed": true,
    "trashedAt": "2025-01-01T00:00:00.000Z",
    "checklistMode": true,
    "sortOrder": 1,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "version": 1,
    "tags": [
      "item"
    ],
    "attachments": [
      {
        "id": "id",
        "noteId": "noteId",
        "filename": "filename",
        "mimeType": "mimeType",
        "size": 1,
        "thumbnailPath": "thumbnailPath",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
]
```

---

### `POST /api/notes`

Create a note

**Request:**

```json
{
  "id": "uuid",
  "title": "title",
  "content": "content",
  "color": "default",
  "pinned": true,
  "archived": true,
  "trashed": true,
  "checklistMode": true,
  "sortOrder": 1
}
```

**Response:** `201`

```json
{
  "id": "uuid",
  "title": "title",
  "content": "content",
  "color": "default",
  "pinned": true,
  "archived": true,
  "trashed": true,
  "trashedAt": "2025-01-01T00:00:00.000Z",
  "checklistMode": true,
  "sortOrder": 1,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "version": 1,
  "tags": [
    "item"
  ],
  "attachments": [
    {
      "id": "id",
      "noteId": "noteId",
      "filename": "filename",
      "mimeType": "mimeType",
      "size": 1,
      "thumbnailPath": "thumbnailPath",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/notes/{id}`

Get a note

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | yes |  |

**Response:** `200`

```json
{
  "id": "uuid",
  "title": "title",
  "content": "content",
  "color": "default",
  "pinned": true,
  "archived": true,
  "trashed": true,
  "trashedAt": "2025-01-01T00:00:00.000Z",
  "checklistMode": true,
  "sortOrder": 1,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "version": 1,
  "tags": [
    "item"
  ],
  "attachments": [
    {
      "id": "id",
      "noteId": "noteId",
      "filename": "filename",
      "mimeType": "mimeType",
      "size": 1,
      "thumbnailPath": "thumbnailPath",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**Errors:** `404` Note not found

---

### `PATCH /api/notes/{id}`

Update a note

Partial update — only include changed fields.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | yes |  |

**Request:**

```json
{
  "id": "uuid",
  "title": "title",
  "content": "content",
  "color": "default",
  "pinned": true,
  "archived": true,
  "trashed": true,
  "checklistMode": true,
  "sortOrder": 1
}
```

**Response:** `200`

```json
{
  "id": "uuid",
  "title": "title",
  "content": "content",
  "color": "default",
  "pinned": true,
  "archived": true,
  "trashed": true,
  "trashedAt": "2025-01-01T00:00:00.000Z",
  "checklistMode": true,
  "sortOrder": 1,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "version": 1,
  "tags": [
    "item"
  ],
  "attachments": [
    {
      "id": "id",
      "noteId": "noteId",
      "filename": "filename",
      "mimeType": "mimeType",
      "size": 1,
      "thumbnailPath": "thumbnailPath",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**Errors:** `404` Note not found

---

### `DELETE /api/notes/{id}`

Permanently delete a note

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | yes |  |

**Response:** `200`

```json
{
  "success": true
}
```

**Errors:** `404` Note not found

---

## Attachments

### `GET /api/notes/{id}/attachments`

List or download attachments

Without `attachmentId`, lists all attachments. With `attachmentId`, returns the file.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | yes |  |
| `attachmentId` | query | string | no |  |
| `thumb` | query | string | no | Set to "1" to return the thumbnail instead of the full image (requires attachmentId) (1) |

**Response:** `200`

```json
[
  {
    "id": "id",
    "noteId": "noteId",
    "filename": "filename",
    "mimeType": "mimeType",
    "size": 1,
    "thumbnailPath": "thumbnailPath",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### `POST /api/notes/{id}/attachments`

Upload an image attachment

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | yes |  |

**Request:** `multipart/form-data` with `file` field.

**Response:** `201`

```json
{
  "id": "id",
  "noteId": "noteId",
  "filename": "filename",
  "mimeType": "mimeType",
  "size": 1,
  "thumbnailPath": "thumbnailPath",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Errors:** `400` Invalid file

---

### `DELETE /api/notes/{id}/attachments`

Delete an attachment

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | yes |  |
| `attachmentId` | query | string | yes |  |

**Response:** `200`

```json
{
  "success": true
}
```

---

## Search

### `GET /api/search`

Full-text search

Searches across note titles, content, and tags. Excludes trashed notes.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `q` | query | string | yes |  |

**Response:** `200`

```json
[
  {
    "id": "uuid",
    "title": "title",
    "content": "content",
    "color": "default",
    "pinned": true,
    "archived": true,
    "trashed": true,
    "trashedAt": "2025-01-01T00:00:00.000Z",
    "checklistMode": true,
    "sortOrder": 1,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "version": 1,
    "tags": [
      "item"
    ],
    "attachments": [
      {
        "id": "id",
        "noteId": "noteId",
        "filename": "filename",
        "mimeType": "mimeType",
        "size": 1,
        "thumbnailPath": "thumbnailPath",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
]
```

---

## Tags

### `GET /api/tags`

List all tags

**Response:** `200`

```json
[
  {
    "id": 1,
    "name": "name"
  }
]
```

---

## Sync

### `GET /api/sync`

Pull changes since timestamp

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `since` | query | integer | yes | Unix timestamp in milliseconds |

**Response:** `200`

```json
[
  {
    "id": "uuid",
    "title": "title",
    "content": "content",
    "color": "default",
    "pinned": true,
    "archived": true,
    "trashed": true,
    "trashedAt": "2025-01-01T00:00:00.000Z",
    "checklistMode": true,
    "sortOrder": 1,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "version": 1,
    "tags": [
      "item"
    ],
    "attachments": [
      {
        "id": "id",
        "noteId": "noteId",
        "filename": "filename",
        "mimeType": "mimeType",
        "size": 1,
        "thumbnailPath": "thumbnailPath",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
]
```

---

### `POST /api/sync`

Push local changes

**Request:**

```json
{
  "changes": [
    {
      "noteId": "uuid",
      "operation": "create",
      "timestamp": 1,
      "data": {
        "id": "uuid",
        "title": "title",
        "content": "content",
        "color": "default",
        "pinned": true,
        "archived": true,
        "trashed": true,
        "checklistMode": true,
        "sortOrder": 1
      }
    }
  ]
}
```

**Response:** `200`

```json
{
  "success": true
}
```

**Errors:** `400` Invalid changes payload

---

## Settings

### `GET /api/settings/api-keys`

List API keys

**Response:** `200`

```json
[
  {
    "id": "uuid",
    "name": "name",
    "keyPrefix": "keyPrefix",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastUsedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### `POST /api/settings/api-keys`

Create API key

**Request:**

```json
{
  "name": "name"
}
```

**Response:** `201`

```json
{
  "id": "id",
  "key": "key",
  "name": "name",
  "keyPrefix": "keyPrefix"
}
```

---

### `DELETE /api/settings/api-keys/{id}`

Revoke API key

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | yes |  |

**Response:** `200`

```json
{
  "success": true
}
```

**Errors:** `404` Key not found

---

## MCP

### `POST /api/mcp`

MCP Streamable HTTP endpoint

Model Context Protocol endpoint. Accepts JSON-RPC 2.0 messages. Authenticate via Bearer token (API key).

**Request:**

```json
{}
```

**Response:** `200`

**Errors:** `400` Invalid session, `401` Invalid or missing API key

---
