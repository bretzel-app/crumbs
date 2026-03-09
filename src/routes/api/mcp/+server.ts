import type { RequestHandler } from './$types.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '$lib/server/mcp/server.js';
import { getUserId } from '$lib/server/api-utils.js';

const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

export const POST: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const sessionId = request.headers.get('mcp-session-id');
	const body = await request.json();

	// Reuse existing session
	if (sessionId && transports.has(sessionId)) {
		const transport = transports.get(sessionId)!;
		return transport.handleRequest(request, { parsedBody: body });
	}

	// New session (initialize request)
	if (!sessionId && isInitializeRequest(body)) {
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: () => crypto.randomUUID(),
			enableJsonResponse: true,
			onsessioninitialized: (id) => {
				transports.set(id, transport);
			}
		});

		transport.onclose = () => {
			if (transport.sessionId) {
				transports.delete(transport.sessionId);
			}
		};

		const server = createMcpServer(userId);
		await server.connect(transport);

		return transport.handleRequest(request, { parsedBody: body });
	}

	// Invalid request
	return new Response(
		JSON.stringify({
			jsonrpc: '2.0',
			error: { code: -32000, message: 'Invalid session' },
			id: null
		}),
		{
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		}
	);
};

export const GET: RequestHandler = async ({ request }) => {
	const sessionId = request.headers.get('mcp-session-id');

	if (sessionId && transports.has(sessionId)) {
		return transports.get(sessionId)!.handleRequest(request);
	}

	return new Response(JSON.stringify({ error: 'Invalid session' }), {
		status: 400,
		headers: { 'Content-Type': 'application/json' }
	});
};

export const DELETE: RequestHandler = async ({ request }) => {
	const sessionId = request.headers.get('mcp-session-id');

	if (sessionId && transports.has(sessionId)) {
		return transports.get(sessionId)!.handleRequest(request);
	}

	return new Response(JSON.stringify({ error: 'Invalid session' }), {
		status: 400,
		headers: { 'Content-Type': 'application/json' }
	});
};
