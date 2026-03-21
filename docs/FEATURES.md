# Features

## Core Features (MVP)

### Notes CRUD
- Create, read, update, and delete notes
- Notes have a title and content body
- Content supports full Markdown syntax
- Auto-save on editor close

### Rich Text Editor
- WYSIWYG editing powered by Tiptap
- Formatting toolbar with visual controls
- Raw Markdown mode toggle for direct editing
- Undo/Redo with keyboard shortcuts

### Text Formatting
- **Bold** (`**text**` / Ctrl+B)
- *Italic* (`*text*` / Ctrl+I)
- Underline (Ctrl+U)
- ~~Strikethrough~~ (`~~text~~` / Ctrl+Shift+X)
- Headings (`# H1` through `###### H6`)
- Blockquotes (`> quote`)
- Unordered lists (`- item`)
- Ordered lists (`1. item`)
- Code blocks (triple backtick)
- Inline code (single backtick)
- Links — insert, edit, and remove with URL input
- Tables (insert, add/delete rows and columns)
- Dividers (horizontal rules)
- Text alignment (left, center, right, justify)
- Line breaks

### Checklists / Task Lists
- Toggle between regular note and checklist mode
- Add, remove, reorder checklist items
- Check/uncheck items with checkboxes
- Checked items get strikethrough styling
- Enter key adds new item, Backspace removes empty items
- **Nested checklists**: single-level nesting for sub-tasks
  - Tab / Shift+Tab to indent or outdent an item (keyboard)
  - Drag handle horizontal swipe for mobile indentation
  - Checking a parent item checks all its children
  - Done section groups checked children under their parent label

### Image Attachments
- Upload images via file picker or drag-and-drop
- Supports JPEG, PNG, GIF, WebP, SVG
- Max file size: 10MB
- **Client-side optimization**: images resized to fit 1920×1920, compressed to WebP (~80% quality), transparent PNGs preserved
- **Auto-generated thumbnails**: 200×200 WebP at 60% quality for fast card previews
- Thumbnail strip on note cards (up to 3 images, "+N" badge for more)
- Full-size images in editor, thumbnails on cards (`&thumb=1`)
- **Offline support**: optimized blobs stored in IndexedDB, displayed via blob URLs, auto-synced on reconnect
- Pending upload indicator on offline-queued images
- Service worker CacheFirst caching for previously-viewed images
- Remove attachments from editor

### Tag Organization
- Inline `#hashtag` extraction from note content
- Tags automatically parsed from title and content
- Filter notes by tag (sidebar + tag chips)
- Tags are case-insensitive and deduplicated
- Tags inside code blocks and URLs are ignored

### Color-Coded Notes
12 note colors:
- Default, Coral, Peach, Sand, Mint, Sage
- Fog, Storm, Dusk, Blossom, Clay, Chalk
- Colors adapt to note theme

### Dark Mode
- Three-way theme toggle: System / Light / Dark (in Settings > Preferences)
- Dark mode uses a warm parchment variant — retro aesthetic preserved in both themes
- Respects system `prefers-color-scheme` preference by default
- FOUC-free: theme applied before first paint via a blocking inline script

### Pin Notes
- Pin important notes to always appear at top
- Pinned section separated from unpinned notes
- Toggle pin from note card hover actions

### Archive
- Archive notes to declutter main view
- Archived notes accessible from sidebar
- Unarchive to restore to main view

### Trash
- Soft delete moves notes to trash
- Trash view accessible from sidebar
- Restore notes from trash
- Permanently delete from trash

### Note Sharing / Collaboration
- **Public link sharing**: share any note via a public URL — no login required for viewers
  - Toggle public link on/off from the share dialog
  - Copy shareable URL with one click
  - Read-only public page with full markdown/checklist/image rendering
  - Public links are automatically invalidated when a note is trashed
  - Rate-limited public endpoints (60 req/min per IP)
  - Globe icon on note cards indicates a public link is active
- Share notes with other users on the same instance
- User search autocomplete for adding collaborators
- Full collaboration: both owner and collaborators can edit content, color, and checklist mode
- Per-user state: pin, archive, and sort order are independent per user
- Owner-only actions: trash, delete, share/unshare
- Sharing indicator on note cards (Globe for public, Users for collaborators-only)
- Hover popover showing sharing status and collaborator names
- Share dialog accessible from editor toolbar
- Collaborators can leave shared notes
- Shared notes appear mixed in main list alongside owned notes
- Email notifications (requires SMTP config, opt-out in preferences):
  - Share notifications when a note is shared with you
  - Welcome email when admin creates your account
  - Password reset notification
  - Account deletion confirmation
  - Email address change notification
  - Role change notification (admin/user)
  - Removed from shared note notification
  - Shared note permanently deleted notification
  - Account locked alert (after failed login attempts)

### Note Version History
- Browse previous versions of any note
- Versions are automatically saved when content changes
- Restore any previous version with one click
- Version snapshots are only created when content actually changes (not on metadata-only updates)

### Full-Text Search
- Search across note titles, content, and tags
- Real-time search results as you type
- Clear search to restore original view
- Case-insensitive matching

### Authentication & OAuth / SSO
- Multi-user with role-based access (admin / user)
- Password auth (Argon2) + optional OAuth/SSO (Google, GitHub, any OIDC provider)
- Session-based auth with active session management
- Invite-only OAuth model with PKCE-secured flows
- See [AUTH.md](AUTH.md) for full details and provider setup guides

### User Management (admin)
- Admin dashboard to create, list, and delete users
- Assign roles (admin / user)
- Reset passwords for any user
- Revoke all sessions (force logout) for any user

### PWA / Offline-First
- Installable as standalone app
- Web app manifest with icons
- Service worker for asset caching (CacheFirst for attachments, NetworkFirst for API)
- IndexedDB for local data storage (notes + pending attachments)
- Background sync every 30 seconds (notes + offline attachments)
- LWW conflict resolution for multi-device use
- Sync status indicator (synced/syncing/offline/error)

### MCP Server (Model Context Protocol)
- Built-in MCP endpoint at `POST /api/mcp` (Streamable HTTP transport)
- 14 tools: list, get, create, update, trash, restore, archive, unarchive, delete, search notes; list tags; pin, reorder notes; upload images
- API key authentication (Bearer token)
- Compatible with Claude Code, Claude Desktop, and other MCP clients
- Stateful sessions with automatic cleanup

### API Key Management
- Generate API keys from the Settings page
- Keys use `crumbs_` prefix for easy identification
- SHA-256 hashed storage (keys shown once at creation)
- Track last-used timestamps
- Revoke keys with confirmation dialog
- MCP client config example shown in Settings

### Docker Deployment
- Multi-stage Dockerfile (build + slim runtime)
- docker-compose.yml with persistent volume
- Health check endpoint
- Runs as non-root user
- Configurable via environment variables
