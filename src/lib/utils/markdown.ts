import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

const md = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
	breaks: true
});

// Raw HTML has to render (not just be escaped as visible text): a table with
// a list in a cell can't be expressed in plain GFM, so the editor falls back
// to embedding it as an HTML block (see tiptap/Table.ts). Note content also
// isn't only ever written through that editor - the MCP server and the notes
// API accept a raw markdown string directly - so any HTML this renders has to
// be sanitized regardless of where it came from.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [...sanitizeHtml.defaults.allowedTags, 'input'],
	allowedAttributes: {
		...sanitizeHtml.defaults.allowedAttributes,
		input: ['type', 'checked', 'disabled', 'class'],
		ul: ['class']
	},
	// Keep markdown-it's bare void-element style (<br>, not <br />) so
	// sanitizing doesn't change output for content that had no raw HTML to
	// begin with.
	selfClosing: []
};

// Add task list support
md.core.ruler.after('inline', 'task-lists', (state) => {
	const tokens = state.tokens;
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i].type !== 'inline') continue;
		const content = tokens[i].content;
		if (content.startsWith('[ ] ') || content.startsWith('[x] ')) {
			const checked = content.startsWith('[x] ');
			const checkbox = checked
				? '<input type="checkbox" checked disabled class="task-checkbox" /> '
				: '<input type="checkbox" disabled class="task-checkbox" /> ';
			tokens[i].content = content.slice(4);
			tokens[i].children = md.parseInline(tokens[i].content, state.env)[0].children;
			// Prepend checkbox
			const token = new state.Token('html_inline', '', 0);
			token.content = checkbox;
			tokens[i].children!.unshift(token);

			// Add task-list class to parent <ul> (once)
			for (let j = i - 1; j >= 0; j--) {
				if (tokens[j].type === 'bullet_list_open') {
					const cls = tokens[j].attrGet('class') ?? '';
					if (!cls.includes('task-list')) {
						tokens[j].attrJoin('class', 'task-list');
					}
					break;
				}
			}
		}
	}
});

md.core.ruler.after('task-lists', 'note-links', (state) => {
	for (const token of state.tokens) {
		if (token.type !== 'inline' || !token.children) continue;

		const children = token.children;
		for (let i = 0; i < children.length; i++) {
			if (children[i].type !== 'link_open') continue;
			const href = children[i].attrGet('href') ?? '';
			if (!href.startsWith('crumb-note://')) continue;

			let closeIndex = i + 1;
			while (closeIndex < children.length && children[closeIndex].type !== 'link_close') closeIndex++;
			children.splice(closeIndex, 1);
			children.splice(i, 1);
			i -= 1;
		}
	}
});

export function renderMarkdown(content: string): string {
	return sanitizeHtml(md.render(content), SANITIZE_OPTIONS);
}

export function stripMarkdown(content: string): string {
	// Simple strip for preview - remove markdown syntax
	return content
		.replace(/```[\s\S]*?```/g, '')
		.replace(/`[^`]*`/g, '')
		.replace(/!\[.*?\]\(.*?\)/g, '')
		.replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
		.replace(/[#*_~\[\]]/g, '')
		.trim();
}
