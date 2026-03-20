import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to re-import for each test to get a fresh module state
let checkIpRateLimit: (ip: string) => boolean;

beforeEach(async () => {
	vi.resetModules();
	const mod = await import('./ip-rate-limit.js');
	checkIpRateLimit = mod.checkIpRateLimit;
});

describe('checkIpRateLimit', () => {
	it('allows requests under the limit', () => {
		for (let i = 0; i < 60; i++) {
			expect(checkIpRateLimit('1.2.3.4')).toBe(true);
		}
	});

	it('blocks requests over the limit', () => {
		for (let i = 0; i < 60; i++) {
			checkIpRateLimit('1.2.3.4');
		}
		expect(checkIpRateLimit('1.2.3.4')).toBe(false);
	});

	it('tracks different IPs independently', () => {
		for (let i = 0; i < 60; i++) {
			checkIpRateLimit('1.1.1.1');
		}
		expect(checkIpRateLimit('1.1.1.1')).toBe(false);
		expect(checkIpRateLimit('2.2.2.2')).toBe(true);
	});

	it('resets after the window expires', () => {
		vi.useFakeTimers();
		for (let i = 0; i < 60; i++) {
			checkIpRateLimit('1.2.3.4');
		}
		expect(checkIpRateLimit('1.2.3.4')).toBe(false);

		// Advance past the 1-minute window
		vi.advanceTimersByTime(61_000);
		expect(checkIpRateLimit('1.2.3.4')).toBe(true);
		vi.useRealTimers();
	});
});
