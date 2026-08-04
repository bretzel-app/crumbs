/**
 * Extract crumb-note://<id> references from markdown content.
 * Mirrors extractTags' code-block/inline-code exclusion so a reference
 * mentioned as an example inside a code sample isn't treated as a real link.
 */
export function extractNoteLinks(content: string): string[] {
	if (!content) return [];

	const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
	const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]*`/g, '');

	const matches = withoutInlineCode.match(/crumb-note:\/\/([\w-]+)/g);
	if (!matches) return [];

	const ids = matches.map((m) => m.replace('crumb-note://', ''));
	return [...new Set(ids)];
}
