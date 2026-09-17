import { common, createLowlight } from 'lowlight';

/**
 * One lowlight instance shared by the TipTap editor (live decorations) and the
 * markdown-it renderer (card previews, share page), so a fence is coloured
 * identically wherever it shows up.
 *
 * There is deliberately no language auto-detection. highlight.js guesses
 * wrongly on note-sized snippets often enough (JavaScript read as CSS, SQL as
 * VB.NET) that a wrong palette is worse than none. An unlabelled fence renders
 * as plain text on the code surface; the language comes from the fence info
 * string (```ts) or the toolbar picker.
 */
export const lowlight = createLowlight(common);

type HighlightRoot = ReturnType<typeof lowlight.highlight>;
type HighlightNode = HighlightRoot['children'][number];

/** Languages offered by the editor's picker. Aliases (js, py, sh…) still highlight. */
export const CODE_LANGUAGES: readonly { id: string; label: string }[] = [
	{ id: 'bash', label: 'Bash' },
	{ id: 'c', label: 'C' },
	{ id: 'cpp', label: 'C++' },
	{ id: 'csharp', label: 'C#' },
	{ id: 'css', label: 'CSS' },
	{ id: 'diff', label: 'Diff' },
	{ id: 'go', label: 'Go' },
	{ id: 'graphql', label: 'GraphQL' },
	{ id: 'xml', label: 'HTML / XML' },
	{ id: 'ini', label: 'INI / TOML' },
	{ id: 'java', label: 'Java' },
	{ id: 'javascript', label: 'JavaScript' },
	{ id: 'json', label: 'JSON' },
	{ id: 'kotlin', label: 'Kotlin' },
	{ id: 'less', label: 'Less' },
	{ id: 'lua', label: 'Lua' },
	{ id: 'makefile', label: 'Makefile' },
	{ id: 'markdown', label: 'Markdown' },
	{ id: 'objectivec', label: 'Objective-C' },
	{ id: 'perl', label: 'Perl' },
	{ id: 'php', label: 'PHP' },
	{ id: 'python', label: 'Python' },
	{ id: 'r', label: 'R' },
	{ id: 'ruby', label: 'Ruby' },
	{ id: 'rust', label: 'Rust' },
	{ id: 'scss', label: 'SCSS' },
	{ id: 'shell', label: 'Shell session' },
	{ id: 'sql', label: 'SQL' },
	{ id: 'swift', label: 'Swift' },
	{ id: 'typescript', label: 'TypeScript' },
	{ id: 'vbnet', label: 'VB.NET' },
	{ id: 'wasm', label: 'WebAssembly' },
	{ id: 'yaml', label: 'YAML' }
];

export function isKnownLanguage(lang: string | null | undefined): lang is string {
	return typeof lang === 'string' && lang.length > 0 && lowlight.registered(lang);
}

/**
 * Highlighted HTML (spans with `hljs-*` classes, text escaped) for a code
 * block, or `null` when the language is absent or unknown so the caller can
 * fall back to plain escaped text.
 */
export function highlightCode(code: string, lang: string | null | undefined): string | null {
	if (!isKnownLanguage(lang)) return null;
	return toHtml(lowlight.highlight(lang, code).children);
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// lowlight emits only `element` (span with a className list) and `text`
// nodes, so a full hast serializer would be dead weight here.
function toHtml(nodes: HighlightNode[]): string {
	let html = '';
	for (const node of nodes) {
		if (node.type === 'text') {
			html += escapeHtml(node.value);
		} else if (node.type === 'element') {
			const classes = node.properties?.className;
			const classAttr = Array.isArray(classes) && classes.length ? ` class="${classes.join(' ')}"` : '';
			html += `<span${classAttr}>${toHtml(node.children as HighlightNode[])}</span>`;
		}
	}
	return html;
}

/**
 * What `@tiptap/extension-code-block-lowlight` needs from a lowlight instance,
 * with auto-detection stubbed out so an unlabelled block stays plain (see the
 * note at the top of this file).
 */
export const editorLowlight = {
	highlight: (language: string, value: string) => lowlight.highlight(language, value),
	highlightAuto: (value: string): HighlightRoot => ({
		type: 'root',
		children: [{ type: 'text', value }],
		data: { language: undefined, relevance: 0 }
	}),
	listLanguages: () => lowlight.listLanguages(),
	registered: (aliasOrLanguage: string) => lowlight.registered(aliasOrLanguage)
};
