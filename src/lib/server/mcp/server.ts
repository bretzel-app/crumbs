import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NoteFilter } from '$lib/types/index.js';
import {
	listNotes,
	getNote,
	createNote,
	updateNote,
	deleteNote,
	searchNotes,
	listAllTags,
	reorderNotes
} from '../notes-service.js';
import { saveAttachment } from '../attachments.js';
import { db } from '../db/index.js';

const NOTE_COLORS = [
	'default',
	'coral',
	'peach',
	'sand',
	'mint',
	'sage',
	'fog',
	'storm',
	'dusk',
	'blossom',
	'clay',
	'chalk'
] as const;

export function createMcpServer(userId: number): McpServer {
	const server = new McpServer({
		name: 'crumbs',
		version: '0.7.2'
	});

	server.tool(
		'list_notes',
		'List notes with optional filter (all, archived, trashed) and tag filter',
		{
			filter: z
				.enum(['all', 'archived', 'trashed'])
				.optional()
				.describe('Filter notes by status'),
			tag: z.string().optional().describe('Filter by tag name')
		},
		async ({ filter = 'all', tag }: { filter?: string; tag?: string }) => {
			let result = listNotes(db, userId, filter as NoteFilter);

			if (tag) {
				result = result.filter((n) =>
					(n.tags ?? []).some((t: string) => t.toLowerCase() === tag.toLowerCase())
				);
			}

			return {
				content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
			};
		}
	);

	server.tool(
		'get_note',
		'Get a single note by ID with its tags and attachments',
		{ id: z.string().describe('Note ID') },
		async ({ id }: { id: string }) => {
			const note = getNote(db, userId, id);
			if (!note) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}

			return {
				content: [{ type: 'text' as const, text: JSON.stringify(note, null, 2) }]
			};
		}
	);

	server.tool(
		'create_note',
		'Create a new note',
		{
			title: z.string().optional().describe('Note title'),
			content: z.string().optional().describe('Note content (supports markdown)'),
			color: z.enum(NOTE_COLORS).optional().describe('Note color'),
			checklistMode: z.boolean().optional().describe('Enable checklist mode')
		},
		async ({ title, content, color, checklistMode }: { title?: string; content?: string; color?: string; checklistMode?: boolean }) => {
			const note = createNote(db, userId, { title, content, color, checklistMode });
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(note, null, 2) }]
			};
		}
	);

	server.tool(
		'update_note',
		'Update an existing note',
		{
			id: z.string().describe('Note ID'),
			title: z.string().optional().describe('New title'),
			content: z.string().optional().describe('New content'),
			color: z.enum(NOTE_COLORS).optional().describe('New color'),
			pinned: z.boolean().optional().describe('Pin/unpin'),
			checklistMode: z.boolean().optional().describe('Enable/disable checklist mode')
		},
		async ({ id, ...updates }: { id: string; title?: string; content?: string; color?: string; pinned?: boolean; checklistMode?: boolean }) => {
			const result = updateNote(db, userId, id, updates);
			if (!result) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}

			return {
				content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
			};
		}
	);

	server.tool(
		'trash_note',
		'Move a note to trash',
		{ id: z.string().describe('Note ID') },
		async ({ id }: { id: string }) => {
			const result = updateNote(db, userId, id, { trashed: true });
			if (!result) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}
			return {
				content: [{ type: 'text' as const, text: `Note "${result.title}" trashed` }]
			};
		}
	);

	server.tool(
		'restore_note',
		'Restore a note from trash',
		{ id: z.string().describe('Note ID') },
		async ({ id }: { id: string }) => {
			const result = updateNote(db, userId, id, { trashed: false });
			if (!result) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}
			return {
				content: [{ type: 'text' as const, text: `Note "${result.title}" restored` }]
			};
		}
	);

	server.tool(
		'archive_note',
		'Archive a note',
		{ id: z.string().describe('Note ID') },
		async ({ id }: { id: string }) => {
			const result = updateNote(db, userId, id, { archived: true });
			if (!result) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}
			return {
				content: [{ type: 'text' as const, text: `Note "${result.title}" archived` }]
			};
		}
	);

	server.tool(
		'unarchive_note',
		'Unarchive a note',
		{ id: z.string().describe('Note ID') },
		async ({ id }: { id: string }) => {
			const result = updateNote(db, userId, id, { archived: false });
			if (!result) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}
			return {
				content: [{ type: 'text' as const, text: `Note "${result.title}" unarchived` }]
			};
		}
	);

	server.tool(
		'delete_note',
		'Permanently delete a note',
		{ id: z.string().describe('Note ID') },
		async ({ id }: { id: string }) => {
			const existing = getNote(db, userId, id);
			if (!existing) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}

			deleteNote(db, userId, id);
			return {
				content: [
					{
						type: 'text' as const,
						text: `Note "${existing.title}" permanently deleted`
					}
				]
			};
		}
	);

	server.tool(
		'search_notes',
		'Search notes by title, content, or tag name',
		{ query: z.string().describe('Search query') },
		async ({ query }: { query: string }) => {
			const results = searchNotes(db, userId, query);
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }]
			};
		}
	);

	server.tool('list_tags', 'List all tags', {}, async () => {
		const allTags = listAllTags(db, userId);
		return {
			content: [{ type: 'text' as const, text: JSON.stringify(allTags, null, 2) }]
		};
	});

	server.tool(
		'pin_note',
		'Pin or unpin a note',
		{
			id: z.string().describe('Note ID'),
			pinned: z.boolean().describe('Whether to pin (true) or unpin (false)')
		},
		async ({ id, pinned }: { id: string; pinned: boolean }) => {
			const result = updateNote(db, userId, id, { pinned });
			if (!result) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}
			return {
				content: [
					{
						type: 'text' as const,
						text: `Note "${result.title}" ${pinned ? 'pinned' : 'unpinned'}`
					}
				]
			};
		}
	);

	server.tool(
		'reorder_notes',
		'Reorder notes by setting sort orders',
		{
			orders: z
				.array(
					z.object({
						id: z.string().describe('Note ID'),
						sortOrder: z.number().describe('New sort order')
					})
				)
				.describe('Array of note IDs with their new sort orders')
		},
		async ({ orders }: { orders: { id: string; sortOrder: number }[] }) => {
			reorderNotes(db, userId, orders);
			return {
				content: [{ type: 'text' as const, text: `Reordered ${orders.length} notes` }]
			};
		}
	);

	server.tool(
		'upload_image',
		'Attach an image to a note by fetching it from a URL',
		{
			noteId: z.string().describe('Note ID to attach the image to'),
			imageUrl: z.string().url().describe('URL of the image to fetch')
		},
		async ({ noteId, imageUrl }: { noteId: string; imageUrl: string }) => {
			const existing = getNote(db, userId, noteId);
			if (!existing) {
				return {
					content: [{ type: 'text' as const, text: 'Note not found' }],
					isError: true
				};
			}

			try {
				const response = await fetch(imageUrl);
				if (!response.ok) {
					return {
						content: [
							{
								type: 'text' as const,
								text: `Failed to fetch image: ${response.status} ${response.statusText}`
							}
						],
						isError: true
					};
				}

				const contentType = response.headers.get('content-type') || 'image/png';
				const buffer = Buffer.from(await response.arrayBuffer());
				const ext = contentType.split('/')[1]?.split(';')[0] || 'png';
				const filename = `upload_${Date.now()}.${ext}`;

				const file = new File([buffer], filename, { type: contentType });
				const attachment = await saveAttachment(db, noteId, file, userId);

				return {
					content: [{ type: 'text' as const, text: JSON.stringify(attachment, null, 2) }]
				};
			} catch (err) {
				return {
					content: [
						{
							type: 'text' as const,
							text: `Failed to upload image: ${err instanceof Error ? err.message : String(err)}`
						}
					],
					isError: true
				};
			}
		}
	);

	return server;
}
