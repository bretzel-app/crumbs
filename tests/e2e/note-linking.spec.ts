import { test, expect, createNote, noteCard } from './helpers/fixtures.js';

test.describe('Note Linking', () => {
	test('Scenario: Linking to a note renders a live chip and clicking it opens that note', async ({ authenticatedPage: page }) => {
		await createNote(page, 'Target Note', 'target content');
		await createNote(page, 'Source Note', 'source content');

		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Linker Note');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await page.getByTestId('format-link').click();
		await page.getByTestId('format-link-input').fill('Target');
		await page.getByTestId('format-link-note-result').filter({ hasText: 'Target Note' }).click();

		await expect(page.getByTestId('tiptap-editor').locator('[data-note-id]')).toBeVisible();
		await page.getByTestId('tiptap-editor').locator('[data-note-id]').click();

		await expect(page.getByTestId('note-title-input').first()).toHaveValue('Target Note');
	});

	test('Scenario: Renaming a linked note updates the displayed link text', async ({ authenticatedPage: page }) => {
		await createNote(page, 'Original Title', '');
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Linker Note');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await page.getByTestId('format-link').click();
		await page.getByTestId('format-link-input').fill('Original');
		await page.getByTestId('format-link-note-result').filter({ hasText: 'Original Title' }).click();
		await page.getByTestId('close-editor-btn').click();

		await noteCard(page, 'Original Title').click();
		await page.getByTestId('note-title-input').fill('Renamed Title');
		await page.getByTestId('close-editor-btn').click();

		await noteCard(page, 'Linker Note').click();
		await expect(editor.getByText('Renamed Title')).toBeVisible();
		await expect(editor.getByText('Original Title')).not.toBeVisible();
	});

	test('Scenario: A link to a trashed note renders inert and does not navigate', async ({ authenticatedPage: page }) => {
		await createNote(page, 'Doomed Note', '');
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Linker Note');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await page.getByTestId('format-link').click();
		await page.getByTestId('format-link-input').fill('Doomed');
		await page.getByTestId('format-link-note-result').filter({ hasText: 'Doomed Note' }).click();
		await page.getByTestId('close-editor-btn').click();

		await noteCard(page, 'Doomed Note').click();
		await page.getByTestId('overflow-menu-btn').click();
		await page.getByTestId('trash-note-btn').click();
		await expect(page.getByTestId('note-editor-overlay')).toHaveCount(0);

		await noteCard(page, 'Linker Note').click();
		await expect(editor.getByText('Note not found')).toBeVisible();
		await editor.getByText('Note not found').click();
		await expect(page.getByTestId('note-title-input').first()).toHaveValue('Linker Note');
	});

	test('Scenario: The linked-to note shows a Referenced by backlink', async ({ authenticatedPage: page }) => {
		await createNote(page, 'Popular Note', '');
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Referencing Note');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await page.getByTestId('format-link').click();
		await page.getByTestId('format-link-input').fill('Popular');
		await page.getByTestId('format-link-note-result').filter({ hasText: 'Popular Note' }).click();
		await page.getByTestId('close-editor-btn').click();

		await noteCard(page, 'Popular Note').click();

		await expect(page.getByTestId('backlink-chip').filter({ hasText: 'Referencing Note' })).toBeVisible();
	});

	test('Scenario: The note-picker excludes the currently-open note from its own search results', async ({ authenticatedPage: page }) => {
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Self Reference Test');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();

		await page.getByTestId('format-link').click();
		await page.getByTestId('format-link-input').fill('Self Reference');

		await expect(page.getByTestId('format-link-note-result').filter({ hasText: 'Self Reference Test' })).toHaveCount(0);
	});

	test('Scenario: Hovering a note-link chip reveals a remove button that deletes it without navigating', async ({ authenticatedPage: page }) => {
		await createNote(page, 'Removable Target', '');
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Has A Link');
		const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
		await editor.click();
		await page.getByTestId('format-link').click();
		await page.getByTestId('format-link-input').fill('Removable');
		await page.getByTestId('format-link-note-result').filter({ hasText: 'Removable Target' }).click();

		const chip = page.getByTestId('tiptap-editor').locator('[data-note-id]');
		await expect(chip).toBeVisible();
		await chip.hover();
		await page.getByRole('button', { name: 'Remove note link' }).click();

		await expect(chip).toHaveCount(0);
		await expect(page.getByTestId('note-title-input').first()).toHaveValue('Has A Link');
	});
});
