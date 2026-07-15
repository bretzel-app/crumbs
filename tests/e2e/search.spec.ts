import { test, expect, createNote } from './helpers/fixtures.js';

test.describe('Search', () => {
	test('Scenario: Searching by title returns the matching note', async ({ authenticatedPage: page }) => {
		// Given a note titled "Grocery Errands" and a note titled "Work Meeting" exist
		await createNote(page, 'Grocery Errands');
		await createNote(page, 'Work Meeting');

		// When the user searches for "Grocery"
		await page.getByTestId('search-input').fill('Grocery');

		// Then "Grocery Errands" is visible in the results
		await expect(page.getByText('Grocery Errands')).toBeVisible();
	});

	test('Scenario: Searching by content returns the matching note', async ({ authenticatedPage: page }) => {
		// Given a note titled "Recipe" with content "Pasta with tomato sauce" exists
		await createNote(page, 'Recipe', 'Pasta with tomato sauce');

		// When the user searches for "tomato"
		await page.getByTestId('search-input').fill('tomato');

		// Then "Recipe" is visible in the results
		await expect(page.getByText('Recipe')).toBeVisible();
	});

	test('Scenario: Searching for a nonexistent term yields no results', async ({ authenticatedPage: page }) => {
		// When the user searches for a term that matches nothing
		await page.getByTestId('search-input').fill('xyznonexistent');

		// Then no notes are displayed
		await expect(page.getByTestId('note-card')).toHaveCount(0);
	});

	test('Scenario: Background sync preserves active search results', async ({ authenticatedPage: page }) => {
		await createNote(page, 'Sync Search Target 3812925');
		await createNote(page, 'Sync Search Other 3812925');

		await page.getByTestId('search-input').fill('Sync Search Target 3812925');
		await expect(page.getByText('Sync Search Target 3812925')).toBeVisible();
		await expect(page.getByText('Sync Search Other 3812925')).not.toBeVisible();

		const notesReloaded = page.waitForResponse(
			(response) => response.url().includes('/api/notes?filter=all') && response.ok()
		);
		await page.getByTestId('sync-indicator').click();
		await notesReloaded;

		await expect(page.getByText('Sync Search Target 3812925')).toBeVisible();
		await expect(page.getByText('Sync Search Other 3812925')).not.toBeVisible();
	});

	test('Scenario: A stale response cannot replace newer search results', async ({ authenticatedPage: page }) => {
		await createNote(page, 'Race Slow 3812925');
		await createNote(page, 'Race Fast 3812925');

		const slowResponse = await page.request.get('/api/search?q=Race%20Slow%203812925');
		const fastResponse = await page.request.get('/api/search?q=Race%20Fast%203812925');
		const slowResults = await slowResponse.json();
		const fastResults = await fastResponse.json();

		await page.route('**/api/search?*', async (route) => {
			const requestQuery = new URL(route.request().url()).searchParams.get('q');
			if (requestQuery === 'Race Slow 3812925') {
				await new Promise((resolve) => setTimeout(resolve, 250));
				await route.fulfill({ json: slowResults });
				return;
			}
			await route.fulfill({ json: fastResults });
		});

		const searchInput = page.getByTestId('search-input');
		const slowRequestStarted = page.waitForRequest(
			(request) => new URL(request.url()).searchParams.get('q') === 'Race Slow 3812925'
		);
		await searchInput.fill('Race Slow 3812925');
		await slowRequestStarted;
		await searchInput.fill('Race Fast 3812925');

		await expect(page.getByText('Race Fast 3812925')).toBeVisible();
		await expect(page.getByText('Race Slow 3812925')).not.toBeVisible();
		await page.waitForTimeout(300);
		await expect(page.getByText('Race Fast 3812925')).toBeVisible();
		await expect(page.getByText('Race Slow 3812925')).not.toBeVisible();
	});

	test('Scenario: Current notes stay visible while a search request is in flight', async ({ authenticatedPage: page }) => {
		// Given two notes exist
		await createNote(page, 'Flash Alpha 771903');
		await createNote(page, 'Flash Beta 771903');

		// And the search request is held open before it can respond
		let releaseSearch: () => void = () => {};
		const searchGate = new Promise<void>((resolve) => {
			releaseSearch = resolve;
		});
		await page.route('**/api/search?*', async (route) => {
			await searchGate;
			await route.continue();
		});

		// When the user starts a search
		await page.getByTestId('search-input').fill('Flash Alpha 771903');

		// Then the current notes stay on screen instead of flashing an empty state
		await expect(page.getByText('Flash Beta 771903')).toBeVisible();
		await expect(page.getByText('Flash Alpha 771903')).toBeVisible();

		// And once the results arrive, only the match remains
		releaseSearch();
		await expect(page.getByText('Flash Alpha 771903')).toBeVisible();
		await expect(page.getByText('Flash Beta 771903')).not.toBeVisible();
	});
});
