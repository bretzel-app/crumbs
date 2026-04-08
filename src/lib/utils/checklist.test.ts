import { describe, it, expect } from 'vitest';
import { parseChecklist, serializeChecklist, toggleItemWithCascade, indentItem, outdentItem, linkifyText, unlinkifyHtml, type ChecklistItem } from '$lib/utils/checklist.js';

describe('parseChecklist', () => {
	it('parses flat checklist items', () => {
		const items = parseChecklist('- [ ] Milk\n- [x] Eggs');
		expect(items).toHaveLength(2);
		expect(items[0]).toMatchObject({ text: 'Milk', checked: false, parentId: null });
		expect(items[1]).toMatchObject({ text: 'Eggs', checked: true, parentId: null });
	});

	it('parses nested children with 2-space prefix', () => {
		const items = parseChecklist('- [ ] Groceries\n  - [ ] Milk\n  - [x] Eggs');
		expect(items).toHaveLength(3);
		expect(items[0]).toMatchObject({ text: 'Groceries', checked: false, parentId: null });
		expect(items[1]).toMatchObject({ text: 'Milk', checked: false, parentId: items[0].id });
		expect(items[2]).toMatchObject({ text: 'Eggs', checked: true, parentId: items[0].id });
	});

	it('treats orphaned children as top-level', () => {
		const items = parseChecklist('  - [ ] Orphan\n- [ ] Parent');
		expect(items[0]).toMatchObject({ text: 'Orphan', parentId: null });
	});

	it('returns one empty item for blank content', () => {
		const items = parseChecklist('');
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ text: '', checked: false, parentId: null });
	});

	it('handles mixed top-level and nested items', () => {
		const content = '- [ ] A\n  - [ ] A1\n  - [ ] A2\n- [ ] B\n  - [x] B1';
		const items = parseChecklist(content);
		expect(items).toHaveLength(5);
		expect(items[1].parentId).toBe(items[0].id);
		expect(items[2].parentId).toBe(items[0].id);
		expect(items[4].parentId).toBe(items[3].id);
	});
});

describe('serializeChecklist', () => {
	it('serializes flat items', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'Milk', checked: false, parentId: null },
			{ id: '2', text: 'Eggs', checked: true, parentId: null }
		];
		expect(serializeChecklist(items)).toBe('- [ ] Milk\n- [x] Eggs');
	});

	it('serializes nested items with 2-space prefix', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'Groceries', checked: false, parentId: null },
			{ id: '2', text: 'Milk', checked: false, parentId: '1' },
			{ id: '3', text: 'Eggs', checked: true, parentId: '1' }
		];
		expect(serializeChecklist(items)).toBe('- [ ] Groceries\n  - [ ] Milk\n  - [x] Eggs');
	});

	it('groups children under parents regardless of array order', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'A', checked: false, parentId: null },
			{ id: '3', text: 'B', checked: false, parentId: null },
			{ id: '2', text: 'A1', checked: false, parentId: '1' }
		];
		const result = serializeChecklist(items);
		expect(result).toBe('- [ ] A\n  - [ ] A1\n- [ ] B');
	});

	it('round-trips parse then serialize', () => {
		const original = '- [ ] Groceries\n  - [ ] Milk\n  - [x] Eggs\n- [ ] Clean';
		const items = parseChecklist(original);
		expect(serializeChecklist(items)).toBe(original);
	});
});

describe('toggleItemWithCascade', () => {
	it('checking a parent checks all children', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'Parent', checked: false, parentId: null },
			{ id: '2', text: 'Child A', checked: false, parentId: '1' },
			{ id: '3', text: 'Child B', checked: false, parentId: '1' }
		];
		const result = toggleItemWithCascade('1', items);
		expect(result.every((i) => i.checked)).toBe(true);
	});

	it('unchecking a parent unchecks all children', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'Parent', checked: true, parentId: null },
			{ id: '2', text: 'Child A', checked: true, parentId: '1' },
			{ id: '3', text: 'Child B', checked: true, parentId: '1' }
		];
		const result = toggleItemWithCascade('1', items);
		expect(result.every((i) => !i.checked)).toBe(true);
	});

	it('checking a child does not affect parent', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'Parent', checked: false, parentId: null },
			{ id: '2', text: 'Child', checked: false, parentId: '1' }
		];
		const result = toggleItemWithCascade('2', items);
		expect(result.find((i) => i.id === '1')!.checked).toBe(false);
		expect(result.find((i) => i.id === '2')!.checked).toBe(true);
	});

	it('unchecking a child with deleted parent orphans it', () => {
		const items: ChecklistItem[] = [
			{ id: '2', text: 'Orphan', checked: true, parentId: 'deleted-id' }
		];
		const result = toggleItemWithCascade('2', items);
		expect(result[0].checked).toBe(false);
		expect(result[0].parentId).toBeNull();
	});

	it('unchecking a child repositions it after its parent and siblings', () => {
		// Simulates: parent + 2 children, one child checked (at end of array as done item)
		const items: ChecklistItem[] = [
			{ id: '1', text: 'Parent', checked: false, parentId: null },
			{ id: '3', text: 'Child B', checked: false, parentId: '1' },
			{ id: '4', text: 'Other', checked: false, parentId: null },
			{ id: '2', text: 'Child A', checked: true, parentId: '1' }  // done, at end
		];
		const result = toggleItemWithCascade('2', items);
		// Child A should be repositioned after Child B (last sibling), not stay at end
		const ids = result.map(i => i.id);
		expect(ids).toEqual(['1', '3', '2', '4']);
		expect(result.find(i => i.id === '2')!.checked).toBe(false);
	});
});

describe('indentItem', () => {
	it('sets parentId to nearest preceding top-level item', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'A', checked: false, parentId: null },
			{ id: '2', text: 'B', checked: false, parentId: null }
		];
		const active = items.filter(i => !i.checked);
		const result = indentItem('2', items, active);
		expect(result.find((i) => i.id === '2')!.parentId).toBe('1');
	});

	it('no-op if already a child', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'A', checked: false, parentId: null },
			{ id: '2', text: 'B', checked: false, parentId: '1' }
		];
		const active = items.filter(i => !i.checked);
		const result = indentItem('2', items, active);
		expect(result).toEqual(items);
	});

	it('no-op if first item (no parent above)', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'A', checked: false, parentId: null }
		];
		const active = items.filter(i => !i.checked);
		const result = indentItem('1', items, active);
		expect(result[0].parentId).toBeNull();
	});

	it('reparents children to grandparent when indenting a parent', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'A', checked: false, parentId: null },
			{ id: '2', text: 'B', checked: false, parentId: null },
			{ id: '3', text: 'C', checked: false, parentId: '2' },
			{ id: '4', text: 'D', checked: false, parentId: '2' }
		];
		const active = items.filter(i => !i.checked);
		const result = indentItem('2', items, active);
		expect(result.find((i) => i.id === '2')!.parentId).toBe('1');
		expect(result.find((i) => i.id === '3')!.parentId).toBe('1');
		expect(result.find((i) => i.id === '4')!.parentId).toBe('1');
	});
});

describe('outdentItem', () => {
	it('sets parentId to null', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'A', checked: false, parentId: null },
			{ id: '2', text: 'B', checked: false, parentId: '1' }
		];
		const result = outdentItem('2', items);
		expect(result.find((i) => i.id === '2')!.parentId).toBeNull();
	});

	it('no-op if already top-level', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'A', checked: false, parentId: null }
		];
		const result = outdentItem('1', items);
		expect(result[0].parentId).toBeNull();
	});

	it('adopts consecutive siblings below with same parentId', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'A', checked: false, parentId: null },
			{ id: '2', text: 'B', checked: false, parentId: '1' },
			{ id: '3', text: 'C', checked: false, parentId: '1' },
			{ id: '4', text: 'D', checked: false, parentId: '1' },
			{ id: '5', text: 'E', checked: false, parentId: null }
		];
		const result = outdentItem('2', items);
		expect(result.find((i) => i.id === '2')!.parentId).toBeNull();
		expect(result.find((i) => i.id === '3')!.parentId).toBe('2');
		expect(result.find((i) => i.id === '4')!.parentId).toBe('2');
		expect(result.find((i) => i.id === '5')!.parentId).toBeNull();
	});

	it('stops adoption at first non-sibling', () => {
		const items: ChecklistItem[] = [
			{ id: '1', text: 'A', checked: false, parentId: null },
			{ id: '2', text: 'B', checked: false, parentId: '1' },
			{ id: '5', text: 'E', checked: false, parentId: null },
			{ id: '3', text: 'C', checked: false, parentId: '1' }
		];
		const result = outdentItem('2', items);
		expect(result.find((i) => i.id === '2')!.parentId).toBeNull();
		expect(result.find((i) => i.id === '5')!.parentId).toBeNull();
		expect(result.find((i) => i.id === '3')!.parentId).toBe('1');
	});
});

describe('linkifyText', () => {
	it('converts https URLs to anchor tags', () => {
		expect(linkifyText('visit https://example.com today')).toBe(
			'visit <a href="https://example.com" target="_blank" rel="noopener noreferrer" class="checklist-link">https://example.com</a> today'
		);
	});

	it('converts http URLs to anchor tags', () => {
		expect(linkifyText('go to http://example.com')).toBe(
			'go to <a href="http://example.com" target="_blank" rel="noopener noreferrer" class="checklist-link">http://example.com</a>'
		);
	});

	it('converts bare www URLs with https href', () => {
		expect(linkifyText('check www.example.com')).toBe(
			'check <a href="https://www.example.com" target="_blank" rel="noopener noreferrer" class="checklist-link">www.example.com</a>'
		);
	});

	it('handles multiple URLs in one string', () => {
		const result = linkifyText('see https://a.com and https://b.com');
		expect(result).toContain('href="https://a.com"');
		expect(result).toContain('href="https://b.com"');
	});

	it('returns plain text unchanged when no URLs present', () => {
		expect(linkifyText('just some text')).toBe('just some text');
	});

	it('HTML-escapes user content to prevent XSS', () => {
		expect(linkifyText('<script>alert("xss")</script>')).toBe(
			'&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
		);
	});

	it('HTML-escapes text around URLs', () => {
		expect(linkifyText('<b>bold</b> https://example.com')).toContain('&lt;b&gt;bold&lt;/b&gt;');
		expect(linkifyText('<b>bold</b> https://example.com')).toContain('href="https://example.com"');
	});

	it('handles URL at start of string', () => {
		expect(linkifyText('https://example.com is great')).toContain('href="https://example.com"');
	});

	it('handles URL at end of string', () => {
		expect(linkifyText('visit https://example.com')).toContain('href="https://example.com"');
	});

	it('does not linkify partial matches without protocol or www', () => {
		expect(linkifyText('example.com is not linked')).toBe('example.com is not linked');
	});

	it('handles URLs with paths and query strings', () => {
		const url = 'https://example.com/path?q=1&b=2';
		const result = linkifyText(url);
		expect(result).toContain('href="https://example.com/path?q=1&amp;b=2"');
	});

	it('strips trailing punctuation from URLs', () => {
		expect(linkifyText('see https://example.com.')).toBe(
			'see <a href="https://example.com" target="_blank" rel="noopener noreferrer" class="checklist-link">https://example.com</a>.'
		);
	});

	it('returns empty string for empty input', () => {
		expect(linkifyText('')).toBe('');
	});
});

describe('unlinkifyHtml', () => {
	it('strips anchor tags and returns text content', () => {
		expect(unlinkifyHtml('visit <a href="https://example.com">https://example.com</a> today'))
			.toBe('visit https://example.com today');
	});

	it('returns plain text unchanged', () => {
		expect(unlinkifyHtml('just text')).toBe('just text');
	});

	it('handles multiple anchor tags', () => {
		expect(unlinkifyHtml('<a href="https://a.com">https://a.com</a> and <a href="https://b.com">https://b.com</a>'))
			.toBe('https://a.com and https://b.com');
	});

	it('returns empty string for empty input', () => {
		expect(unlinkifyHtml('')).toBe('');
	});

	it('handles div and br tags from contenteditable', () => {
		expect(unlinkifyHtml('line1<br>line2')).toBe('line1line2');
	});

	it('decodes HTML entities after stripping tags', () => {
		expect(unlinkifyHtml('Tom &amp; Jerry')).toBe('Tom & Jerry');
		expect(unlinkifyHtml('&lt;b&gt;bold&lt;/b&gt;')).toBe('<b>bold</b>');
		expect(unlinkifyHtml('say &quot;hello&quot;')).toBe('say "hello"');
	});
});
