import { existsSync, mkdirSync } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db/index.js';
import { attachments } from './db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import type { Attachment } from '$lib/types/index.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const ATTACHMENTS_DIR = join(DATA_DIR, 'attachments');

// Ensure attachments directory exists
if (!existsSync(ATTACHMENTS_DIR)) {
	mkdirSync(ATTACHMENTS_DIR, { recursive: true });
}

export async function saveAttachment(
	noteId: string,
	file: File,
	thumbnail?: File | Blob | null
): Promise<typeof attachments.$inferSelect> {
	const id = uuidv4();
	const ext = file.name.split('.').pop() || 'bin';
	const filename = `${id}.${ext}`;
	const filePath = join(ATTACHMENTS_DIR, filename);

	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(filePath, buffer);

	let thumbnailPath: string | null = null;
	if (thumbnail) {
		const thumbFilename = `${id}_thumb.webp`;
		thumbnailPath = join(ATTACHMENTS_DIR, thumbFilename);
		const thumbBuffer = Buffer.from(await thumbnail.arrayBuffer());
		await writeFile(thumbnailPath, thumbBuffer);
	}

	const [attachment] = await db
		.insert(attachments)
		.values({
			id,
			noteId,
			filename: file.name,
			mimeType: file.type,
			size: file.size,
			path: filePath,
			thumbnailPath,
			createdAt: new Date()
		})
		.returning();

	return attachment;
}

/**
 * Batch fetch attachments for multiple notes in a single query.
 * Returns a Map of noteId → Attachment[].
 */
export function fetchAttachmentsForNotes(noteIds: string[]): Map<string, Attachment[]> {
	if (noteIds.length === 0) return new Map();

	const rows = db
		.select()
		.from(attachments)
		.where(inArray(attachments.noteId, noteIds))
		.all();

	const map = new Map<string, Attachment[]>();
	for (const row of rows) {
		const existing = map.get(row.noteId);
		if (existing) {
			existing.push(row as Attachment);
		} else {
			map.set(row.noteId, [row as Attachment]);
		}
	}
	return map;
}

export async function getAttachment(id: string) {
	return db.select().from(attachments).where(eq(attachments.id, id)).get();
}

export async function getAttachmentsByNote(noteId: string) {
	return db.select().from(attachments).where(eq(attachments.noteId, noteId));
}

export async function updateAttachment(id: string, data: { featured: boolean }) {
	const [updated] = await db
		.update(attachments)
		.set({ featured: data.featured })
		.where(eq(attachments.id, id))
		.returning();
	return updated ?? null;
}

export async function deleteAttachment(id: string) {
	const attachment = await getAttachment(id);
	if (attachment) {
		try {
			await unlink(attachment.path);
		} catch {
			// File may already be deleted
		}
		if (attachment.thumbnailPath) {
			try {
				await unlink(attachment.thumbnailPath);
			} catch {
				// Thumbnail may already be deleted
			}
		}
		await db.delete(attachments).where(eq(attachments.id, id));
	}
}
