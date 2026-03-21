import { describe, it, expect } from 'vitest';
import { parseChecklist, serializeChecklist, toggleItemWithCascade, indentItem, outdentItem, type ChecklistItem } from '$lib/utils/checklist.js';

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
