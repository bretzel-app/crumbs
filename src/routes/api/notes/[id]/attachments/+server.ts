import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { saveAttachment, getAttachmentsByNote, getAttachment, deleteAttachment, updateAttachment } from '$lib/server/attachments.js';
import { readFile } from 'fs/promises';
import { db } from '$lib/server/db/index.js';
import { getUserId, requireNoteAccess } from '$lib/server/api-utils.js';

export const GET: RequestHandler = async ({ params, url, ...event }) => {
	const userId = getUserId(event);
	requireNoteAccess(db, params.id, userId);

	const attachmentId = url.searchParams.get('attachmentId');

	if (attachmentId) {
		const attachment = await getAttachment(db, attachmentId, params.id);
		if (!attachment) throw error(404, 'Attachment not found');

		const wantThumb = url.searchParams.get('thumb') === '1';
		const filePath = wantThumb && attachment.thumbnailPath ? attachment.thumbnailPath : attachment.path;
		const mimeType = wantThumb && attachment.thumbnailPath ? 'image/webp' : attachment.mimeType;

		const buffer = await readFile(filePath);
		return new Response(buffer, {
			headers: {
				'Content-Type': mimeType,
				'Content-Disposition': `inline; filename="${attachment.filename}"`,
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	}

	const list = await getAttachmentsByNote(db, params.id);
	return json(list);
};

export const POST: RequestHandler = async ({ params, request, ...event }) => {
	const userId = getUserId(event);
	requireNoteAccess(db, params.id, userId);

	const formData = await request.formData();
	const file = formData.get('file') as File;

	if (!file) {
		throw error(400, 'No file provided');
	}

	if (!file.type.startsWith('image/')) {
		throw error(400, 'Only image files are allowed');
	}

	const maxSize = 10 * 1024 * 1024; // 10MB
	if (file.size > maxSize) {
		throw error(400, 'File too large (max 10MB)');
	}

	const thumbnail = formData.get('thumbnail') as File | null;
	const attachment = await saveAttachment(db, params.id, file, userId, thumbnail);
	return json(attachment, { status: 201 });
};

export const PATCH: RequestHandler = async ({ params, url, request, ...event }) => {
	const userId = getUserId(event);
	requireNoteAccess(db, params.id, userId);

	const attachmentId = url.searchParams.get('attachmentId');
	if (!attachmentId) throw error(400, 'attachmentId required');

	const body = await request.json();
	if (typeof body.featured !== 'boolean') throw error(400, 'featured (boolean) required');

	const updated = await updateAttachment(db, attachmentId, params.id, { featured: body.featured });
	if (!updated) throw error(404, 'Attachment not found');

	return json(updated);
};

export const DELETE: RequestHandler = async ({ params, url, ...event }) => {
	const userId = getUserId(event);
	requireNoteAccess(db, params.id, userId);

	const attachmentId = url.searchParams.get('attachmentId');
	if (!attachmentId) throw error(400, 'attachmentId required');

	await deleteAttachment(db, attachmentId, params.id);
	return json({ success: true });
};
