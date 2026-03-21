import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getSharedNote } from '$lib/server/shares-service.js';
import { getAttachment } from '$lib/server/attachments.js';
import { checkIpRateLimit } from '$lib/server/ip-rate-limit.js';
import { db } from '$lib/server/db/index.js';
import { readFile } from 'fs/promises';

export const GET: RequestHandler = async ({ params, url, getClientAddress }) => {
	const ip = getClientAddress();
	if (!checkIpRateLimit(ip)) {
		throw error(429, 'Too many requests');
	}

	const data = getSharedNote(db, params.token);
	if (!data) {
		throw error(404, 'Not found');
	}

	const attachment = await getAttachment(db, params.attachmentId, data.noteId);
	if (!attachment) {
		throw error(404, 'Attachment not found');
	}

	const wantThumb = url.searchParams.get('thumb') === '1';
	const filePath = wantThumb && attachment.thumbnailPath ? attachment.thumbnailPath : attachment.path;
	const mimeType = wantThumb && attachment.thumbnailPath ? 'image/webp' : attachment.mimeType;

	try {
		const buffer = await readFile(filePath);
		return new Response(buffer, {
			headers: {
				'Content-Type': mimeType,
				'Content-Disposition': `inline; filename="${attachment.filename}"`,
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch {
		throw error(404, 'Attachment not found');
	}
};
