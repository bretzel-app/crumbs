/**
 * Extract #hashtags from text content.
 * Matches hashtags that start with # followed by word characters.
 * Does not match inside code blocks or URLs.
 */
export function extractTags(content: string): string[] {
	if (!content) return [];

	// Remove code blocks (``` ... ```) to avoid matching inside them
	const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
	// Remove inline code (` ... `)
	const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]*`/g, '');
	// Remove URLs
	const withoutUrls = withoutInlineCode.replace(/https?:\/\/\S+/g, '');

	const matches = withoutUrls.match(/(?:^|\s)#([\w-]+)/g);
	if (!matches) return [];

	const tags = matches.map((m) => m.trim().slice(1).toLowerCase());
	return [...new Set(tags)];
}

/** Whether `name` is a tag extractTags could produce: a lowercased run of word characters or dashes. */
export function isTagName(name: string): boolean {
	return /^[a-z0-9_-]+$/.test(name);
}
