import { describe, it, expect } from 'vitest';
import { toTagColorMap } from './tag-colors.svelte.js';

describe('toTagColorMap', () => {
	it('maps each coloured tag to its colour', () => {
		expect(
			toTagColorMap([
				{ name: 'network', color: 'sand' },
				{ name: 'info', color: 'mint' }
			])
		).toEqual({ network: 'sand', info: 'mint' });
	});

	it('leaves out tags without a colour', () => {
		expect(toTagColorMap([{ name: 'plain', color: null }])).toEqual({});
	});

	it('leaves out colours the palette no longer has', () => {
		expect(toTagColorMap([{ name: 'old', color: 'magenta' }])).toEqual({});
	});
});
