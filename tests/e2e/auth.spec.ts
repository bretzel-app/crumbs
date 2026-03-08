import { test, expect } from '@playwright/test';

test.describe.serial('Authentication', () => {
	test('Scenario: Unauthenticated user is prompted to set up or log in', async ({ page }) => {
		// Given a user has not authenticated
		// When they access the application
		await page.goto('/');

		// Then they are directed to the setup or login page
		await expect(page).toHaveURL(/\/(setup|login)/);
	});

	test('Scenario: First-time user sees the account creation form', async ({ page }) => {
		// Given no account has been created yet
		// When the user visits the setup page
		await page.goto('/setup');

		// Then the email, password, and confirmation fields and setup action are available
		await expect(page.getByTestId('email-input')).toBeVisible();
		await expect(page.getByTestId('password-input')).toBeVisible();
		await expect(page.getByTestId('confirm-password-input')).toBeVisible();
		await expect(page.getByTestId('setup-btn')).toBeVisible();
	});

	test('Scenario: Account creation is rejected for a password below minimum length', async ({ page }) => {
		// Given the user is setting up their account
		await page.goto('/setup');

		// When they submit a password shorter than 8 characters
		await page.getByTestId('email-input').fill('test@test.com');
		await page.getByTestId('password-input').fill('short');
		await page.getByTestId('confirm-password-input').fill('short');
		await page.getByTestId('setup-btn').click();

		// Then a validation error is shown
		await expect(page.getByTestId('error-message')).toBeVisible();
	});

	test('Scenario: Account creation is rejected when passwords do not match', async ({ page }) => {
		// Given the user is setting up their account
		await page.goto('/setup');

		// When they submit two different passwords
		await page.getByTestId('email-input').fill('test@test.com');
		await page.getByTestId('password-input').fill('longpassword1');
		await page.getByTestId('confirm-password-input').fill('longpassword2');
		await page.getByTestId('setup-btn').click();

		// Then a validation error is shown
		await expect(page.getByTestId('error-message')).toBeVisible();
	});

	test('Scenario: User creates an account and gains access to the application', async ({ page }) => {
		// Given the user accesses the setup page
		await page.goto('/setup');

		// When they authenticate with valid credentials
		await page.getByTestId('email-input').fill('admin@test.com');
		await page.getByTestId('display-name-input').fill('Admin');
		await page.getByTestId('password-input').fill('testpassword123');
		await page.getByTestId('confirm-password-input').fill('testpassword123');
		await page.getByTestId('setup-btn').click();

		// Then they have access to the main application
		await page.waitForURL('/');
		await expect(page.getByTestId('new-note-btn')).toBeVisible();
	});

	test('Scenario: Logged-out user loses access to the application', async ({ page }) => {
		// Given the user is authenticated
		await page.goto('/');
		const url = page.url();

		if (url.includes('/setup')) {
			await page.getByTestId('email-input').fill('admin@test.com');
			await page.getByTestId('display-name-input').fill('Admin');
			await page.getByTestId('password-input').fill('testpassword123');
			await page.getByTestId('confirm-password-input').fill('testpassword123');
			await page.getByTestId('setup-btn').click();
			await page.waitForURL('/');
		} else if (url.includes('/login')) {
			await page.getByTestId('email-input').fill('admin@test.com');
			await page.getByTestId('password-input').fill('testpassword123');
			await page.getByTestId('login-btn').click();
			await page.waitForURL('/');
		}

		// When they log out
		await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }));

		// Then they are redirected to the login page
		await page.goto('/');
		await expect(page).toHaveURL(/\/login/);
	});
});

test.describe('Multi-user', () => {
	test('admin can create a new user via API', async ({ page }) => {
		// Ensure setup/login
		await page.goto('/');
		const url = page.url();

		if (url.includes('/setup')) {
			await page.getByTestId('email-input').fill('admin@test.com');
			await page.getByTestId('display-name-input').fill('Admin');
			await page.getByTestId('password-input').fill('testpassword123');
			await page.getByTestId('confirm-password-input').fill('testpassword123');
			await page.getByTestId('setup-btn').click();
			await page.waitForURL('/');
		} else if (url.includes('/login')) {
			await page.getByTestId('email-input').fill('admin@test.com');
			await page.getByTestId('password-input').fill('testpassword123');
			await page.getByTestId('login-btn').click();
			await page.waitForURL('/');
		}

		// Create a new user via admin API
		const response = await page.evaluate(() =>
			fetch('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'user2@test.com',
					displayName: 'User Two',
					password: 'userpassword123',
					role: 'user'
				})
			}).then((r) => ({ status: r.status, body: r.json() }))
		);

		expect(response.status).toBe(201);
	});
});
