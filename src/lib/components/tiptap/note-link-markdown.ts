const NOTE_LINK_SCHEME = 'crumb-note://';

/** Extracts the note ID from a crumb-note:// href, or null if it's not that scheme. */
export function parseNoteLinkHref(href: string): string | null {
	if (!href.startsWith(NOTE_LINK_SCHEME)) return null;
	return href.slice(NOTE_LINK_SCHEME.length) || null;
}

/**
 * Escapes markdown-special characters the same way a plain link's visible
 * text is escaped, so a title containing `[`, `]`, `*`, etc. can't corrupt
 * the surrounding markdown syntax.
 */
function escapeMarkdownText(text: string): string {
	return text.replace(/[[\]\\*_`]/g, '\\$&');
}

/** Produces the `[title](crumb-note://id)` markdown representation of a note-link. */
export function serializeNoteLinkMarkdown(noteId: string, titleIndex: Map<string, string>): string {
	const title = titleIndex.get(noteId) ?? 'Untitled';
	return `[${escapeMarkdownText(title)}](${NOTE_LINK_SCHEME}${noteId})`;
}
