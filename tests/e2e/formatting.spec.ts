import { test, expect, noteCard } from './helpers/fixtures.js';
import { devices, type Page } from '@playwright/test';

/** Run a TipTap command chain via the exposed editor instance on the DOM element */
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

async function waitForTiptapEditor(page: Page) {
	await page.getByTestId('tiptap-editor').waitFor({ state: 'visible' });
	await page.waitForFunction(() => {
		const el = document.querySelector('[data-testid="tiptap-editor"]');
		return el && (el as any).__tiptapEditor != null;
	});
}

/**
 * Read the `checked` attribute of the first task item from the live ProseMirror
 * document. This reflects the editor's document state, not just the native
 * checkbox widget — so it catches a widget/document desync where the DOM
 * checkbox toggles but the transaction never updates the node.
 */
async function firstTaskItemChecked(page: Page): Promise<boolean> {
	return page.getByTestId('tiptap-editor').evaluate((el) => {
		const editor = (el as any).__tiptapEditor;
		if (!editor) throw new Error('TipTap editor not found on element');
		let checked: boolean | undefined;
		editor.state.doc.descendants((node: any) => {
			if (checked === undefined && node.type.name === 'taskItem') {
				checked = Boolean(node.attrs.checked);
				return false;
			}
			return true;
		});
		if (checked === undefined) throw new Error('No task item found in document');
		return checked;
	});
}

/** Toggle markdown mode via the overflow menu. */
async function toggleMarkdownMode(page: Page) {
	await page.getByTestId('overflow-menu-btn').click();
	await page.getByTestId('markdown-toggle').click();
}

/** Type content into the TipTap editor via markdown mode (reliable for e2e) */
async function typeViaMarkdown(page: Page, content: string) {
	await toggleMarkdownMode(page);
	await page.getByTestId('note-content-input').fill(content);
	await toggleMarkdownMode(page);
}

test.describe('Rich text formatting', () => {
	test('Scenario: Bold shortcut formats selected text in the editor', async ({ authenticatedPage: page }) => {
		// Given the user is editing a new note with content "hello world"
		await page.getByTestId('new-note-btn').click();
		await typeViaMarkdown(page, 'hello world');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');

		// When the user selects "world" and applies bold formatting
		await waitForTiptapEditor(page);
		await runTiptapCommand(page, 'editor.chain().focus().setTextSelection({from:7,to:12}).toggleBold().run()');

		// Then the selected text appears bold in the editor
		await expect(editor.locator('strong')).toHaveText('world');

		// And the markdown content contains bold syntax
		await toggleMarkdownMode(page);
		await expect(page.getByTestId('note-content-input')).toHaveValue('hello **world**');
	});

	test('Scenario: Existing note shows rich text in TipTap editor', async ({ authenticatedPage: page }) => {
		// Given a note with bold markdown content exists
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Rich Text Note');
		await typeViaMarkdown(page, 'Hello **bold** world');
		await page.getByTestId('close-editor-btn').click();

		// When the user reopens the note
		await noteCard(page, 'Rich Text Note').click();

		// Then the content is rendered as rich text in the TipTap editor
		await expect(page.getByTestId('tiptap-editor')).toBeVisible();
		await expect(page.getByTestId('tiptap-editor').locator('strong')).toHaveText('bold');
	});

	test('Scenario: Toolbar dropdown closes when clicking outside', async ({ authenticatedPage: page }) => {
		// Given the user has opened the heading dropdown
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('format-heading').click();
		await expect(page.getByTestId('format-h1')).toBeVisible();

		// When the user clicks inside the editor area
		await page.getByTestId('tiptap-editor').click();

		// Then the dropdown closes
		await expect(page.getByTestId('format-h1')).not.toBeVisible();
	});

	test('Scenario: Link popover allows inserting a link inline', async ({ authenticatedPage: page }) => {
		// Given the user is editing a note with selected text
		await page.getByTestId('new-note-btn').click();
		await typeViaMarkdown(page, 'visit example');
		await waitForTiptapEditor(page);
		await runTiptapCommand(page, 'editor.chain().focus().setTextSelection({from:7,to:14}).run()');

		// When the user opens the link popover and enters a URL
		await page.getByTestId('format-link').click();
		await expect(page.getByTestId('format-link-input')).toBeVisible();
		await page.getByTestId('format-link-input').fill('https://example.com');
		await page.getByTestId('format-link-apply').click();

		// Then the selected text becomes a link
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		const link = editor.locator('a');
		await expect(link).toHaveText('example');
		await expect(link).toHaveAttribute('href', 'https://example.com');
	});

	test('Scenario: Markdown toggle shows raw markdown content', async ({ authenticatedPage: page }) => {
		// Given the user is editing a note with bold content
		await page.getByTestId('new-note-btn').click();
		await typeViaMarkdown(page, 'Hello **bold** world');

		// Verify the rich text renders correctly first
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await expect(editor.locator('strong')).toHaveText('bold');

		// When the user toggles markdown mode
		await toggleMarkdownMode(page);

		// Then the raw markdown textarea is shown with the markdown source
		await expect(page.getByTestId('note-content-input')).toBeVisible();
		await expect(page.getByTestId('tiptap-editor')).not.toBeVisible();
		await expect(page.getByTestId('note-content-input')).toHaveValue('Hello **bold** world');
	});
});

test.describe('Rich text formatting on mobile', () => {
	const pixel7 = devices['Pixel 7'];
	test.use({
		viewport: pixel7.viewport,
		userAgent: pixel7.userAgent,
		deviceScaleFactor: pixel7.deviceScaleFactor,
		isMobile: pixel7.isMobile,
		hasTouch: pixel7.hasTouch
	});

	test('Scenario: Tapping a task-list checkbox does not focus the editor', async ({ authenticatedPage: page }) => {
		// Given a regular text note contains a task list in the rich-text editor
		await page.getByTestId('new-note-fab').click();
		await page.getByTestId('mobile-overflow-menu-btn').click();
		await page.getByTestId('markdown-toggle').click();
		await page.getByTestId('note-content-input').fill('- [ ] Mobile task');
		await page.getByTestId('mobile-overflow-menu-btn').click();
		await page.getByTestId('markdown-toggle').click();

		const richTextEditor = page.getByTestId('tiptap-editor').locator('.tiptap');
		const checkbox = richTextEditor.locator('input[type="checkbox"]');
		await expect(checkbox).not.toBeChecked();
		await expect(richTextEditor).not.toBeFocused();
		await richTextEditor.evaluate((element) => {
			element.dataset.focusCount = '0';
			element.addEventListener('focus', () => {
				element.dataset.focusCount = String(Number(element.dataset.focusCount) + 1);
			});
		});

		// When the checkbox is tapped, the change propagates to the editor's document
		// without focus ever entering the editor (which would open the mobile keyboard)
		await checkbox.tap();

		await expect(checkbox).toBeChecked();
		expect(await firstTaskItemChecked(page)).toBe(true);
		await expect(richTextEditor).not.toBeFocused();
		await expect(richTextEditor).toHaveAttribute('data-focus-count', '0');

		// And unchecking propagates to the document too, still without focusing the editor
		await checkbox.tap();

		await expect(checkbox).not.toBeChecked();
		expect(await firstTaskItemChecked(page)).toBe(false);
		await expect(richTextEditor).not.toBeFocused();
		await expect(richTextEditor).toHaveAttribute('data-focus-count', '0');
	});
});
