import type { Page } from 'playwright';
import { join } from 'path';
import { BASE_URL, OUTPUT_DIR } from './constants';

async function screenshot(page: Page, name: string): Promise<void> {
	await page.screenshot({ path: join(OUTPUT_DIR, name), type: 'png' });
	console.log(`  captured ${name}`);
}

async function waitForApp(page: Page): Promise<void> {
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(300);
}

export async function captureDesktop(page: Page): Promise<void> {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	console.log('Capturing desktop screenshots...');

	// D1: Grid view (also used as hero)
	await page.goto(BASE_URL);
	await waitForApp(page);
	await screenshot(page, 'screenshot-grid.png');

	// D2: Rich text editor — open "Self-Hosting Stack"
	await page.getByText('Self-Hosting Stack').first().click();
	await page.waitForSelector('[data-testid="note-editor"]');
	await waitForApp(page);
	await screenshot(page, 'screenshot-editor.png');
	await page.getByTestId('close-editor-btn').click();
	await waitForApp(page);

	// D3: Checklist — open "Bretzel Ingredients"
	await page.getByText('Bretzel Ingredients').first().click();
	await page.waitForSelector('[data-testid="note-editor"]');
	await waitForApp(page);
	await screenshot(page, 'screenshot-checklist.png');
	await page.getByTestId('close-editor-btn').click();
	await waitForApp(page);

	// D4: Sharing dialog — open "Weekend Plans", click share
	await page.getByText('Weekend Plans').first().click();
	await page.waitForSelector('[data-testid="note-editor"]');
	await page.getByTestId('share-toggle').click();
	await page.waitForSelector('[data-testid="share-dialog"]');
	await waitForApp(page);
	await screenshot(page, 'screenshot-sharing.png');
	await page.getByTestId('share-dialog-overlay').click({ position: { x: 10, y: 10 } });
	await page.getByTestId('close-editor-btn').click();
	await waitForApp(page);

	// D5: Version history — open "Self-Hosting Stack", click history
	await page.getByText('Self-Hosting Stack').first().click();
	await page.waitForSelector('[data-testid="note-editor"]');
	await page.getByTestId('history-toggle').click();
	await page.waitForSelector('[data-testid="history-panel"]');
	const versionItems = page.getByTestId('version-item');
	if ((await versionItems.count()) > 1) {
		await versionItems.nth(1).click();
	}
	await waitForApp(page);
	await screenshot(page, 'screenshot-history.png');
	await page.getByTestId('close-editor-btn').click();
	await waitForApp(page);

	// D6: Attachments — open "Bretzel Ingredients" (has featured bretzel image)
	await page.getByText('Bretzel Ingredients').first().click();
	await page.waitForSelector('[data-testid="note-editor"]');
	await page.getByTestId('image-toggle').click();
	await page.waitForSelector('[data-testid="image-upload"]');
	await waitForApp(page);
	await screenshot(page, 'screenshot-attachments.png');
	await page.getByTestId('close-editor-btn').click();
	await waitForApp(page);

	// D7: API/MCP settings
	await page.goto(`${BASE_URL}/settings/mcp`);
	await waitForApp(page);
	await screenshot(page, 'screenshot-api.png');
}

export async function captureMobile(page: Page): Promise<void> {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	console.log('Capturing mobile screenshots...');

	// M1: Mobile grid view
	await page.goto(BASE_URL);
	await waitForApp(page);
	await screenshot(page, 'screenshot-mobile-grid.png');

	// M2: Mobile editor — open "Self-Hosting Stack"
	await page.getByText('Self-Hosting Stack').first().click();
	await page.waitForSelector('[data-testid="note-editor"]');
	await waitForApp(page);
	await screenshot(page, 'screenshot-mobile-editor.png');
	await page.getByTestId('close-editor-btn').click();
	await waitForApp(page);

	// M3: Mobile checklist — open "Bretzel Ingredients"
	await page.getByText('Bretzel Ingredients').first().click();
	await page.waitForSelector('[data-testid="note-editor"]');
	await waitForApp(page);
	await screenshot(page, 'screenshot-mobile-checklist.png');
}
