const store = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60;
const MAX_ENTRIES = 10_000;
let cleanupCounter = 0;

export function checkIpRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = store.get(ip);
	if (!entry || now - entry.windowStart > WINDOW_MS) {
		store.set(ip, { count: 1, windowStart: now });
		pruneIfNeeded(now);
		return true;
	}
	entry.count++;
	return entry.count <= MAX_REQUESTS;
}

function pruneIfNeeded(now: number) {
	cleanupCounter++;
	if (cleanupCounter < 100 || store.size < MAX_ENTRIES) {
		return;
	}
	cleanupCounter = 0;
	for (const [key, entry] of store) {
		if (now - entry.windowStart > WINDOW_MS) {
			store.delete(key);
		}
	}
}
