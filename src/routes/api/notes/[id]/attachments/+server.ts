import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { saveAttachment, getAttachmentsByNote, getAttachment, deleteAttachment } from '$lib/server/attachments.js';
import { readFile } from 'fs/promises';

export const GET: RequestHandler = async ({ params, url }) => {
	const attachmentId = url.searchParams.get('attachmentId');

	if (attachmentId) {
		const attachment = await getAttachment(attachmentId);
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

	const list = await getAttachmentsByNote(params.id);
	return json(list);
};

export const POST: RequestHandler = async ({ params, request }) => {
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
	const attachment = await saveAttachment(params.id, file, thumbnail);
	return json(attachment, { status: 201 });
};

export const DELETE: RequestHandler = async ({ url }) => {
	const attachmentId = url.searchParams.get('attachmentId');
	if (!attachmentId) throw error(400, 'attachmentId required');

	await deleteAttachment(attachmentId);
	return json({ success: true });
};
