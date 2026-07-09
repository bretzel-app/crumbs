import { describe, it, expect } from 'vitest';
import { mergeContent, mergeContentTwoWay, mergeContentUpdate } from './content-merge.js';

describe('mergeContent (3-way)', () => {
	it('should return remote when local is unchanged', () => {
		const base = '- [ ] Milk\n- [ ] Bread';
		const local = '- [ ] Milk\n- [ ] Bread';
		const remote = '- [x] Milk\n- [ ] Bread';

		expect(mergeContent(base, local, remote)).toBe('- [x] Milk\n- [ ] Bread');
	});

	it('should return local when remote is unchanged', () => {
		const base = '- [ ] Milk\n- [ ] Bread';
		const local = '- [x] Milk\n- [ ] Bread';
		const remote = '- [ ] Milk\n- [ ] Bread';

		expect(mergeContent(base, local, remote)).toBe('- [x] Milk\n- [ ] Bread');
	});

	it('should merge when User A checks an item and User B adds an item', () => {
		const base = '- [ ] Milk\n- [ ] Bread\n- [ ] Eggs';
		const local = '- [x] Milk\n- [ ] Bread\n- [ ] Eggs'; // User A checks Milk
		const remote = '- [ ] Milk\n- [ ] Bread\n- [ ] Eggs\n- [ ] Butter'; // User B adds Butter

		const result = mergeContent(base, local, remote);
		expect(result).toBe('- [x] Milk\n- [ ] Bread\n- [ ] Eggs\n- [ ] Butter');
	});

	it('should merge when both users check different items', () => {
		const base = '- [ ] Milk\n- [ ] Bread\n- [ ] Eggs';
		const local = '- [x] Milk\n- [ ] Bread\n- [ ] Eggs'; // User A checks Milk
		const remote = '- [ ] Milk\n- [x] Bread\n- [ ] Eggs'; // User B checks Bread

		const result = mergeContent(base, local, remote);
		expect(result).toBe('- [x] Milk\n- [x] Bread\n- [ ] Eggs');
	});

	it('should LWW (prefer remote) when both users edit the same line', () => {
		const base = '- [ ] Milk\n- [ ] Bread';
		const local = '- [ ] Whole Milk\n- [ ] Bread'; // User A renames Milk
		const remote = '- [x] Milk\n- [ ] Bread'; // User B checks Milk

		const result = mergeContent(base, local, remote);
		// Both changed line 1 — conflict resolved by preferring remote
		expect(result).toBe('- [x] Milk\n- [ ] Bread');
	});

	it('should handle line additions by both sides', () => {
		const base = '- [ ] Milk';
		const local = '- [ ] Milk\n- [ ] Bread'; // User A adds Bread at end
		const remote = '- [ ] Eggs\n- [ ] Milk'; // User B adds Eggs at beginning

		const result = mergeContent(base, local, remote);
		// Both additions should be preserved
		expect(result).toContain('- [ ] Milk');
		expect(result).toContain('- [ ] Bread');
		expect(result).toContain('- [ ] Eggs');
	});

	it('should handle line deletion by one side', () => {
		const base = '- [ ] Milk\n- [ ] Bread\n- [ ] Eggs';
		const local = '- [ ] Milk\n- [ ] Eggs'; // User A removes Bread
		const remote = '- [ ] Milk\n- [ ] Bread\n- [ ] Eggs'; // User B unchanged

		const result = mergeContent(base, local, remote);
		expect(result).toBe('- [ ] Milk\n- [ ] Eggs');
	});

	it('should work with non-checklist markdown (prose paragraphs)', () => {
		const base = '# Shopping\n\nBuy groceries today.\n\n## Notes\n\nNothing special.';
		const local = '# Shopping\n\nBuy groceries today.\n\n## Notes\n\nRemember coupons.'; // User A edits notes
		const remote = '# Shopping List\n\nBuy groceries today.\n\n## Notes\n\nNothing special.'; // User B edits title

		const result = mergeContent(base, local, remote);
		expect(result).toContain('# Shopping List');
		expect(result).toContain('Remember coupons.');
	});

	it('should handle empty content', () => {
		expect(mergeContent('', '', '')).toBe('');
		expect(mergeContent('', 'hello', '')).toBe('hello');
		expect(mergeContent('', '', 'hello')).toBe('hello');
	});

	it('should return remote when local equals remote', () => {
		const content = '- [ ] Milk\n- [ ] Bread';
		expect(mergeContent('old', content, content)).toBe(content);
	});
});

describe('mergeContentTwoWay', () => {
	it('should return remote when both are identical', () => {
		expect(mergeContentTwoWay('hello', 'hello')).toBe('hello');
	});

	it('should preserve the current server document when contents differ', () => {
		const local = '- [x] Milk\n- [ ] Bread';
		const remote = '- [ ] Milk\n- [ ] Bread\n- [ ] Eggs';

		expect(mergeContentTwoWay(local, remote)).toBe(remote);
	});

	it('should not resurrect content deleted from the current document', () => {
		expect(mergeContentTwoWay('deleted content', '')).toBe('');
	});
});


describe('mergeContentUpdate', () => {
	it('should merge an incoming update against current content when a base is available', () => {
		const result = mergeContentUpdate({
			baseContent: '- [ ] Milk\n- [ ] Bread',
			incomingContent: '- [x] Milk\n- [ ] Bread',
			currentContent: '- [ ] Milk\n- [x] Bread'
		});

		expect(result).toBe('- [x] Milk\n- [x] Bread');
	});

	it('should preserve current content when the base is missing', () => {
		const result = mergeContentUpdate({
			baseContent: null,
			incomingContent: '- [x] Milk',
			currentContent: '- [ ] Bread'
		});

		expect(result).toBe('- [ ] Bread');
	});
});
