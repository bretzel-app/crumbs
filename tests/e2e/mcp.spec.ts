import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { setupAndLogin } from './helpers/fixtures.js';

/**
 * MCP E2E tests exercise the full MCP protocol flow:
 * 1. Create an API key via the settings API (authenticated via session)
 * 2. Use the key to authenticate MCP requests
 * 3. Test tool invocations via JSON-RPC over Streamable HTTP
 */

const test = base.extend<{ apiKey: string }>({
	apiKey: async ({ page }, use) => {
		await setupAndLogin(page);

		// Create API key via settings endpoint (session-authenticated)
		const res = await page.request.post('/api/settings/api-keys', {
			data: { name: 'E2E Test Key' }
		});
		expect(res.ok()).toBeTruthy();
		const { key } = await res.json();
		await use(key);
	}
});

async function mcpInitialize(page: Page, apiKey: string) {
	const res = await page.request.post('/api/mcp', {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream'
		},
		data: {
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2025-03-26',
				capabilities: {},
				clientInfo: { name: 'e2e-test', version: '1.0.0' }
			}
		}
	});
	const status = res.status();
	const body = await res.text();
	if (!res.ok()) {
		throw new Error(`MCP initialize failed with status ${status}: ${body.slice(0, 500)}`);
	}
	const sessionId = res.headers()['mcp-session-id'];
	expect(sessionId).toBeTruthy();

	// Send initialized notification
	await page.request.post('/api/mcp', {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			'mcp-session-id': sessionId
		},
		data: {
			jsonrpc: '2.0',
			method: 'notifications/initialized'
		}
	});

	return sessionId;
}

async function mcpCallTool(
	page: Page,
	apiKey: string,
	sessionId: string,
	name: string,
	args: Record<string, unknown> = {},
	id = 2
) {
	const res = await page.request.post('/api/mcp', {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			'mcp-session-id': sessionId
		},
		data: {
			jsonrpc: '2.0',
			id,
			method: 'tools/call',
			params: { name, arguments: args }
		}
	});
	expect(res.ok()).toBeTruthy();

	const text = await res.text();
	// Response may be SSE format or JSON
	if (text.startsWith('event:') || text.startsWith('data:')) {
		// Parse SSE - find the last data line with actual content
		const lines = text.split('\n');
		for (const line of lines) {
			if (line.startsWith('data: ')) {
				const data = JSON.parse(line.slice(6));
				if (data.result) return data.result;
			}
		}
		throw new Error('No result found in SSE response');
	}

	return JSON.parse(text).result;
}

test.describe('MCP Server', () => {
	test('Scenario: MCP client can list notes via the protocol', async ({ page, apiKey }) => {
		const sessionId = await mcpInitialize(page, apiKey);

		// When calling list_notes tool
		const result = await mcpCallTool(page, apiKey, sessionId, 'list_notes');

		// Then the response contains notes content
		expect(result.content).toBeDefined();
		expect(result.content[0].type).toBe('text');
		const notes = JSON.parse(result.content[0].text);
		expect(Array.isArray(notes)).toBe(true);
	});

	test('Scenario: MCP client can create and retrieve a note', async ({ page, apiKey }) => {
		const sessionId = await mcpInitialize(page, apiKey);

		// When creating a note via MCP
		const createResult = await mcpCallTool(page, apiKey, sessionId, 'create_note', {
			title: 'MCP Test Note',
			content: 'Created via MCP protocol'
		});
		const created = JSON.parse(createResult.content[0].text);
		expect(created.title).toBe('MCP Test Note');

		// Then the note can be retrieved
		const getResult = await mcpCallTool(
			page,
			apiKey,
			sessionId,
			'get_note',
			{ id: created.id },
			3
		);
		const fetched = JSON.parse(getResult.content[0].text);
		expect(fetched.title).toBe('MCP Test Note');
		expect(fetched.content).toBe('Created via MCP protocol');
	});

	test('Scenario: MCP client can search notes', async ({ page, apiKey }) => {
		const sessionId = await mcpInitialize(page, apiKey);

		// Given a note with specific content exists
		await mcpCallTool(page, apiKey, sessionId, 'create_note', {
			title: 'Searchable Note',
			content: 'unique-search-term-xyz'
		});

		// When searching for it
		const searchResult = await mcpCallTool(
			page,
			apiKey,
			sessionId,
			'search_notes',
			{ query: 'unique-search-term-xyz' },
			3
		);
		const results = JSON.parse(searchResult.content[0].text);

		// Then it appears in results
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].title).toBe('Searchable Note');
	});

	test('Scenario: MCP endpoint rejects requests without API key', async ({ page }) => {
		const res = await page.request.post('/api/mcp', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
			data: {
				jsonrpc: '2.0',
				id: 1,
				method: 'initialize',
				params: {
					protocolVersion: '2025-03-26',
					capabilities: {},
					clientInfo: { name: 'test', version: '1.0.0' }
				}
			}
		});
		expect(res.status()).toBe(401);
	});
});
