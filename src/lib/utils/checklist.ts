export interface ChecklistItem {
	id: string;
	text: string;
	checked: boolean;
	parentId: string | null;
}

export function generateId(): string {
	return crypto.randomUUID();
}

export function isChild(item: ChecklistItem): boolean {
	return item.parentId !== null;
}

export function getChildren(parentId: string, items: ChecklistItem[]): ChecklistItem[] {
	return items.filter((i) => i.parentId === parentId);
}

export function getParent(item: ChecklistItem, items: ChecklistItem[]): ChecklistItem | undefined {
	return item.parentId ? items.find((i) => i.id === item.parentId) : undefined;
}

export function toggleItemWithCascade(id: string, items: ChecklistItem[]): ChecklistItem[] {
	const target = items.find((i) => i.id === id)!;
	const newChecked = !target.checked;

	let result = items.map((item) => {
		if (item.id === id) return { ...item, checked: newChecked };
		if (item.parentId === id) return { ...item, checked: newChecked };
		return item;
	});

	// When unchecking a child: reposition it after its parent/siblings in the array
	// (otherwise it stays at the end of the array where done items live)
	if (!newChecked && target.parentId) {
		const parentExists = result.some((i) => i.id === target.parentId);
		if (!parentExists) {
			// Parent deleted — orphan it
			result = result.map((i) => (i.id === id ? { ...i, parentId: null } : i));
		} else {
			// Remove the item from its current position
			const uncheckedItem = result.find((i) => i.id === id)!;
			result = result.filter((i) => i.id !== id);
			// Find the last sibling or the parent, insert after it
			let insertAfter = -1;
			for (let i = 0; i < result.length; i++) {
				if (result[i].id === target.parentId || result[i].parentId === target.parentId) {
					insertAfter = i;
				}
			}
			if (insertAfter >= 0) {
				result.splice(insertAfter + 1, 0, uncheckedItem);
			} else {
				result.push(uncheckedItem);
			}
		}
	}

	return result;
}

export function indentItem(id: string, items: ChecklistItem[], activeItems: ChecklistItem[]): ChecklistItem[] {
	const item = items.find((i) => i.id === id);
	if (!item || item.parentId !== null) return items;

	const activeIndex = activeItems.findIndex((i) => i.id === id);
	let newParentId: string | null = null;
	for (let i = activeIndex - 1; i >= 0; i--) {
		if (activeItems[i].parentId === null) {
			newParentId = activeItems[i].id;
			break;
		}
	}
	if (!newParentId) return items;

	return items.map((i) => {
		if (i.id === id) return { ...i, parentId: newParentId };
		if (i.parentId === id) return { ...i, parentId: newParentId };
		return i;
	});
}

export function outdentItem(id: string, items: ChecklistItem[]): ChecklistItem[] {
	const index = items.findIndex((i) => i.id === id);
	const item = items[index];
	if (!item || item.parentId === null) return items;

	const originalParentId = item.parentId;

	const adoptees: string[] = [];
	for (let i = index + 1; i < items.length; i++) {
		if (items[i].parentId === originalParentId) {
			adoptees.push(items[i].id);
		} else {
			break;
		}
	}

	return items.map((i) => {
		if (i.id === id) return { ...i, parentId: null };
		if (adoptees.includes(i.id)) return { ...i, parentId: id };
		return i;
	});
}

export function parseChecklist(text: string): ChecklistItem[] {
	if (!text.trim()) return [{ id: generateId(), text: '', checked: false, parentId: null }];

	let lastTopLevelId: string | null = null;
	return text.split('\n').map((line) => {
		if (line.startsWith('  - [x] ')) {
			return { id: generateId(), text: line.slice(8), checked: true, parentId: lastTopLevelId };
		}
		if (line.startsWith('  - [ ] ')) {
			return { id: generateId(), text: line.slice(8), checked: false, parentId: lastTopLevelId };
		}
		const item: ChecklistItem = { id: generateId(), text: '', checked: false, parentId: null };
		if (line.startsWith('- [x] ')) {
			item.text = line.slice(6);
			item.checked = true;
		} else if (line.startsWith('- [ ] ')) {
			item.text = line.slice(6);
		} else {
			item.text = line;
		}
		lastTopLevelId = item.id;
		return item;
	});
}

export function serializeChecklist(items: ChecklistItem[]): string {
	const topLevel = items.filter((i) => i.parentId === null);
	const childMap = new Map<string, ChecklistItem[]>();
	for (const item of items) {
		if (item.parentId) {
			const siblings = childMap.get(item.parentId) ?? [];
			siblings.push(item);
			childMap.set(item.parentId, siblings);
		}
	}

	const lines: string[] = [];
	for (const parent of topLevel) {
		lines.push(`- [${parent.checked ? 'x' : ' '}] ${parent.text}`);
		const children = childMap.get(parent.id) ?? [];
		for (const child of children) {
			lines.push(`  - [${child.checked ? 'x' : ' '}] ${child.text}`);
		}
	}
	return lines.join('\n');
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)'"}\]]/g;

export function linkifyText(text: string): string {
	if (!text) return '';

	const matches: { index: number; match: string; href: string }[] = [];
	let m: RegExpExecArray | null;
	const regex = new RegExp(URL_REGEX.source, 'g');

	while ((m = regex.exec(text)) !== null) {
		const match = m[0];
		const href = match.startsWith('www.') ? `https://${match}` : match;
		matches.push({ index: m.index, match, href });
	}

	if (matches.length === 0) return escapeHtml(text);

	let result = '';
	let lastIndex = 0;
	for (const { index, match, href } of matches) {
		result += escapeHtml(text.slice(lastIndex, index));
		result += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="checklist-link">${escapeHtml(match)}</a>`;
		lastIndex = index + match.length;
	}
	result += escapeHtml(text.slice(lastIndex));
	return result;
}

export function unlinkifyHtml(html: string): string {
	if (!html) return '';
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"');
}
