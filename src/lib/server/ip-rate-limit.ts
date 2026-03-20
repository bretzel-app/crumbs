const store = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60;

export function checkIpRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = store.get(ip);
	if (!entry || now - entry.windowStart > WINDOW_MS) {
		store.set(ip, { count: 1, windowStart: now });
		return true;
	}
	entry.count++;
	return entry.count <= MAX_REQUESTS;
}
