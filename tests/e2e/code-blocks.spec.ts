import { test, expect, noteCard } from './helpers/fixtures.js';
import type { Page } from '@playwright/test';

async function waitForTiptapEditor(page: Page) {
	await page.getByTestId('tiptap-editor').waitFor({ state: 'visible' });
	await page.waitForFunction(() => {
		const el = document.querySelector('[data-testid="tiptap-editor"]');
		return el && (el as any).__tiptapEditor != null;
	});
}

async function runTiptapCommand(page: Page, commandFn: string) {
	await page.getByTestId('tiptap-editor').evaluate(
		(el, fn) => {
			const editor = (el as any).__tiptapEditor;
			if (!editor) throw new Error('TipTap editor not found on element');
			new Function('editor', fn)(editor);
		},
		commandFn
	);
}

async function toggleMarkdownMode(page: Page) {
	await page.getByTestId('overflow-menu-btn').click();
	await page.getByTestId('markdown-toggle').click();
}

/** Write note content as markdown, then return to the rich editor. */
async function typeViaMarkdown(page: Page, content: string) {
	await toggleMarkdownMode(page);
	await page.getByTestId('note-content-input').fill(content);
	await toggleMarkdownMode(page);
}

test.describe('Code snippets', () => {
	test('Scenario: A fenced block with a language is syntax highlighted in the editor and on the card', async ({
		authenticatedPage: page
	}) => {
		// Given a note whose content is a JavaScript code block
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('JS Snippet');
		await typeViaMarkdown(page, '```js\nconst answer = 42;\n```');
		await waitForTiptapEditor(page);

		// Then the editor colours the keyword and number as separate tokens
		const editor = page.getByTestId('tiptap-editor');
		await expect(editor.locator('pre .hljs-keyword')).toHaveText('const');
		await expect(editor.locator('pre .hljs-number')).toHaveText('42');

		// When the note is closed
		await page.getByTestId('close-editor-btn').click();

		// Then the card preview shows the same highlighting
		const preview = noteCard(page, 'JS Snippet').getByTestId('note-content-preview');
		await expect(preview.locator('pre .hljs-keyword')).toHaveText('const');
		await expect(preview.locator('pre .hljs-number')).toHaveText('42');
	});

	test('Scenario: An unlabelled code block stays plain instead of guessing a language', async ({
		authenticatedPage: page
	}) => {
		// Given a note whose content is a code block with no language
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Plain Snippet');
		await typeViaMarkdown(page, '```\nSELECT * FROM users;\n```');
		await waitForTiptapEditor(page);

		// Then the editor shows the block without any token colouring
		const editor = page.getByTestId('tiptap-editor');
		await expect(editor.locator('pre code')).toHaveText('SELECT * FROM users;');
		await expect(editor.locator('pre [class*="hljs-"]')).toHaveCount(0);

		// And so does the card preview
		await page.getByTestId('close-editor-btn').click();
		const preview = noteCard(page, 'Plain Snippet').getByTestId('note-content-preview');
		await expect(preview.locator('pre code')).toHaveText('SELECT * FROM users;');
		await expect(preview.locator('pre [class*="hljs-"]')).toHaveCount(0);
	});

	test('Scenario: Choosing a language for a code block is saved in the markdown fence', async ({
		authenticatedPage: page
	}) => {
		// Given the user is editing a note with a plain code block
		await page.getByTestId('new-note-btn').click();
		await typeViaMarkdown(page, '```\ndef greet():\n    return "hi"\n```');
		await waitForTiptapEditor(page);

		// And the language picker is offered only while the cursor is in the block
		await runTiptapCommand(page, 'editor.chain().focus("start").run()');
		const picker = page.getByTestId('format-code-language');
		await expect(picker).toBeVisible();
		await expect(picker).toHaveValue('');

		// When the user picks Python
		await picker.selectOption('python');

		// Then the block is highlighted as Python
		await expect(page.getByTestId('tiptap-editor').locator('pre .hljs-keyword').first()).toHaveText('def');
		await expect(picker).toHaveValue('python');

		// And the markdown fence carries the language
		await toggleMarkdownMode(page);
		await expect(page.getByTestId('note-content-input')).toHaveValue('```python\ndef greet():\n    return "hi"\n```');
	});

	test('Scenario: The language picker is hidden outside a code block', async ({ authenticatedPage: page }) => {
		// Given the user is editing a note with a paragraph
		await page.getByTestId('new-note-btn').click();
		await typeViaMarkdown(page, 'just prose');
		await waitForTiptapEditor(page);
		await runTiptapCommand(page, 'editor.chain().focus("end").run()');

		// Then no language picker is shown
		await expect(page.getByTestId('format-code-language')).toHaveCount(0);
	});

	test('Scenario: Code keeps the body text size instead of shrinking', async ({ authenticatedPage: page }) => {
		// Given a note with a code block and a paragraph
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Sized Snippet');
		await typeViaMarkdown(page, 'Some prose\n\n```js\nconst a = 1;\n```');
		await waitForTiptapEditor(page);

		// Then the code block is set at the same size as the prose around it
		const editor = page.getByTestId('tiptap-editor');
		const fontSize = (locator: ReturnType<Page['locator']>) =>
			locator.evaluate((el) => getComputedStyle(el).fontSize);
		expect(await fontSize(editor.locator('pre code'))).toBe(await fontSize(editor.locator('p').first()));

		// And the same holds on the card preview
		await page.getByTestId('close-editor-btn').click();
		const preview = noteCard(page, 'Sized Snippet').getByTestId('note-content-preview');
		expect(await fontSize(preview.locator('pre code'))).toBe(await fontSize(preview.locator('p').first()));
	});

	test('Scenario: A long code line is clipped on the card instead of adding a scrollbar', async ({
		authenticatedPage: page
	}) => {
		// Given a note with a code line far wider than a card
		const longLine = 'const url = "https://example.com/' + 'segment/'.repeat(30) + '";';
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Wide Snippet');
		await typeViaMarkdown(page, '```js\n' + longLine + '\n```');
		await page.getByTestId('close-editor-btn').click();

		// Then the card's code block stays inside the card and does not scroll horizontally
		const preview = noteCard(page, 'Wide Snippet').getByTestId('note-content-preview');
		const pre = preview.locator('pre');
		await expect(pre).toBeVisible();
		const overflow = await pre.evaluate((el) => {
			const style = getComputedStyle(el);
			const box = el.getBoundingClientRect();
			const container = el.parentElement!.getBoundingClientRect();
			return {
				x: style.overflowX,
				wider: el.scrollWidth > el.clientWidth,
				spill: box.right - container.right
			};
		});
		expect(overflow.wider, 'the line must actually be wider than the card for this test to mean anything').toBe(true);
		expect(overflow.x).toBe('hidden');
		expect(overflow.spill).toBeLessThanOrEqual(1);
	});
});
