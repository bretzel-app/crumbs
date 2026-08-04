import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
	html: false,
	linkify: true,
	typographer: true,
	breaks: true
});

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
	return md.render(content);
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
