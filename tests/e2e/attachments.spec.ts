import { test, expect, noteCard } from './helpers/fixtures.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE_PATH = join(__dirname, 'helpers', 'test-image.png');

/** Helper: create a note, close editor, reopen it */
async function createAndReopenNote(page: import('@playwright/test').Page, title: string) {
	await page.getByTestId('new-note-btn').click();
	await page.getByTestId('note-title-input').fill(title);
	const editor = page.getByTestId('tiptap-editor').locator('.tiptap');
	await editor.click();
	await editor.pressSequentially('Test content');
	await page.getByTestId('close-editor-btn').click();
	await expect(noteCard(page, title)).toBeVisible();

	// Reopen for attachment work (note must be saved first)
	await noteCard(page, title).click();
	await expect(page.getByTestId('note-editor')).toBeVisible();
}

test.describe('Image Attachments', () => {
	test('Scenario: Uploaded image appears as thumbnail in the editor', async ({ authenticatedPage: page }) => {
		// Given a saved note exists
		await createAndReopenNote(page, 'Attachment Test');

		// When the user opens the image panel and uploads an image
		await page.getByTestId('image-toggle').click();
		const fileInput = page.getByTestId('file-input');
		await fileInput.setInputFiles(TEST_IMAGE_PATH);

		// Then a thumbnail appears in the editor
		await expect(page.getByTestId('attachment-thumbnail')).toBeVisible();
	});

	test('Scenario: Image persists after closing and reopening a note', async ({ authenticatedPage: page }) => {
		// Given a note with an uploaded image exists
		await createAndReopenNote(page, 'Persist Test');
		await page.getByTestId('image-toggle').click();
		await page.getByTestId('file-input').setInputFiles(TEST_IMAGE_PATH);
		await expect(page.getByTestId('attachment-thumbnail')).toBeVisible();

		// When the user closes and reopens the note
		await page.getByTestId('close-editor-btn').click();
		await noteCard(page, 'Persist Test').click();

		// Then the image is still visible in the editor
		await expect(page.getByTestId('note-editor').locator('img')).toBeVisible();
	});

	test('Scenario: Image thumbnail appears on the note card', async ({ authenticatedPage: page }) => {
		// Given a note with an uploaded image exists
		await createAndReopenNote(page, 'Card Thumb Test');
		await page.getByTestId('image-toggle').click();
		await page.getByTestId('file-input').setInputFiles(TEST_IMAGE_PATH);
		await expect(page.getByTestId('attachment-thumbnail')).toBeVisible();

		// When the user closes the editor
		await page.getByTestId('close-editor-btn').click();

		// Then a thumbnail strip appears on the note card
		const card = noteCard(page, 'Card Thumb Test');
		await expect(card.getByTestId('card-thumbnail')).toBeVisible();
	});

	test('Scenario: Removed image disappears from editor and card', async ({ authenticatedPage: page }) => {
		// Given a note with an uploaded image exists
		await createAndReopenNote(page, 'Remove Test');
		await page.getByTestId('image-toggle').click();
		await page.getByTestId('file-input').setInputFiles(TEST_IMAGE_PATH);
		await expect(page.getByTestId('attachment-thumbnail')).toBeVisible();

		// When the user removes the image
		await page.getByTestId('attachment-thumbnail').hover();
		await page.getByTestId('remove-attachment').click();

		// Then the thumbnail is gone from the editor
		await expect(page.getByTestId('attachment-thumbnail')).not.toBeVisible();

		// And after closing, no thumbnail strip on the card
		await page.getByTestId('close-editor-btn').click();
		const card = noteCard(page, 'Remove Test');
		await expect(card.getByTestId('card-thumbnail')).not.toBeVisible();
	});

	test('Scenario: Image toggle is disabled for new unsaved notes', async ({ authenticatedPage: page }) => {
		// When the user opens a new note editor
		await page.getByTestId('new-note-btn').click();

		// Then the image toggle button is disabled
		await expect(page.getByTestId('image-toggle')).toBeDisabled();

		// Cleanup
		await page.getByTestId('close-editor-btn').click();
	});
});
