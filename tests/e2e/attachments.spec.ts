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

	test('Scenario: Uploaded images are hidden from card header by default', async ({ authenticatedPage: page }) => {
		// Given a note with an uploaded image exists
		await createAndReopenNote(page, 'Hidden Default Test');
		await page.getByTestId('image-toggle').click();
		await page.getByTestId('file-input').setInputFiles(TEST_IMAGE_PATH);
		await expect(page.getByTestId('attachment-thumbnail')).toBeVisible();

		// When the user closes the editor without featuring the image
		await page.getByTestId('close-editor-btn').click();

		// Then the card does NOT show a thumbnail strip
		const card = noteCard(page, 'Hidden Default Test');
		await expect(card).toBeVisible();
		await expect(card.getByTestId('card-thumbnails')).not.toBeVisible();
	});

	test('Scenario: Featuring an image makes it appear on the card header', async ({ authenticatedPage: page }) => {
		// Given a note with an uploaded image exists
		await createAndReopenNote(page, 'Feature Test');
		await page.getByTestId('image-toggle').click();
		await page.getByTestId('file-input').setInputFiles(TEST_IMAGE_PATH);
		await expect(page.getByTestId('attachment-thumbnail')).toBeVisible();

		// When the user features the image by clicking the star
		await page.getByTestId('attachment-thumbnail').hover();
		await page.getByTestId('toggle-featured').click();

		// And closes the editor
		await page.getByTestId('close-editor-btn').click();

		// Then the card shows the featured image in its header
		const card = noteCard(page, 'Feature Test');
		await expect(card.getByTestId('card-thumbnails')).toBeVisible();
		await expect(card.getByTestId('card-thumbnail')).toBeVisible();
	});

	test('Scenario: Unfeaturing an image removes it from the card header', async ({ authenticatedPage: page }) => {
		// Given a note with a featured image exists
		await createAndReopenNote(page, 'Unfeature Test');
		await page.getByTestId('image-toggle').click();
		await page.getByTestId('file-input').setInputFiles(TEST_IMAGE_PATH);
		await expect(page.getByTestId('attachment-thumbnail')).toBeVisible();

		// Feature the image
		await page.getByTestId('attachment-thumbnail').hover();
		await page.getByTestId('toggle-featured').click();
		await page.getByTestId('close-editor-btn').click();

		const card = noteCard(page, 'Unfeature Test');
		await expect(card.getByTestId('card-thumbnails')).toBeVisible();

		// When the user unfeatures the image
		await card.getByText('Unfeature Test').click();
		await expect(page.getByTestId('note-editor')).toBeVisible();
		await page.getByTestId('image-toggle').click();
		await page.getByTestId('attachment-thumbnail').hover();
		await page.getByTestId('toggle-featured').click();
		await page.getByTestId('close-editor-btn').click();

		// Then the card no longer shows the thumbnail strip
		await expect(card.getByTestId('card-thumbnails')).not.toBeVisible();
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

	test('Scenario: Clicking an image thumbnail opens a full-size lightbox', async ({ authenticatedPage: page }) => {
		// Given a note with an uploaded image exists
		await createAndReopenNote(page, 'Lightbox Test');
		await page.getByTestId('image-toggle').click();
		await page.getByTestId('file-input').setInputFiles(TEST_IMAGE_PATH);
		await expect(page.getByTestId('attachment-thumbnail').first()).toBeVisible();

		// When the user clicks the thumbnail
		await page.getByTestId('attachment-thumbnail').first().click();

		// Then a full-size lightbox overlay is displayed
		await expect(page.getByTestId('image-lightbox')).toBeVisible();
		await expect(page.getByTestId('lightbox-image')).toBeVisible();

		// When the user presses Escape
		await page.keyboard.press('Escape');

		// Then the lightbox closes but the editor remains open
		await expect(page.getByTestId('image-lightbox')).not.toBeVisible();
		await expect(page.getByTestId('note-editor')).toBeVisible();
	});

	test('Scenario: Image toggle on new note auto-saves and opens upload panel', async ({ authenticatedPage: page }) => {
		// When the user opens a new note and clicks the image toggle
		await page.getByTestId('new-note-btn').click();
		await page.getByTestId('note-title-input').fill('Auto-Save Test');
		await page.getByTestId('image-toggle').click();

		// Then the upload panel is visible (note was auto-saved)
		await expect(page.getByTestId('image-upload')).toBeVisible();

		// Cleanup
		await page.getByTestId('close-editor-btn').click();

		// And the note exists in the list
		await expect(noteCard(page, 'Auto-Save Test')).toBeVisible();
	});
});
