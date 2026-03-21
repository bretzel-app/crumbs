<script lang="ts">
	import XIcon from 'lucide-svelte/icons/x';
	import Plus from 'lucide-svelte/icons/plus';
	import GripVertical from 'lucide-svelte/icons/grip-vertical';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import { onDestroy, flushSync } from 'svelte';
	import { dragHandleZone, dragHandle, type DndEvent } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { type ChecklistItem, generateId, parseChecklist, serializeChecklist, toggleItemWithCascade, indentItem, outdentItem } from '$lib/utils/checklist.js';

	interface Props {
		content: string;
		onChange: (content: string) => void;
	}

	let { content, onChange }: Props = $props();

	// svelte-ignore state_referenced_locally
	let items = $state<ChecklistItem[]>(parseChecklist(content));
	let doneExpanded = $state(true);
	const flipDurationMs = 150;

	// Track the last content we emitted so we can distinguish self-originated
	// changes from external ones (sync, history restore, etc.)
	let lastEmitted = content;

	// Re-parse items when content changes externally (not from our own emitChange)
	$effect(() => {
		if (content !== lastEmitted) {
			items = parseChecklist(content);
			lastEmitted = content;
		}
	});

	let activeItems = $derived(items.filter((i) => !i.checked));
	let doneItems = $derived(items.filter((i) => i.checked));
	let doneCount = $derived(doneItems.length);

	interface DoneSectionGroup {
		parentLabel: ChecklistItem | null;
		children: ChecklistItem[];
	}

	let doneSectionGroups = $derived.by(() => {
		const groups: DoneSectionGroup[] = [];
		const childrenByParent = new Map<string, ChecklistItem[]>();
		const topLevelDone: ChecklistItem[] = [];

		for (const item of doneItems) {
			if (item.parentId) {
				const siblings = childrenByParent.get(item.parentId) ?? [];
				siblings.push(item);
				childrenByParent.set(item.parentId, siblings);
			} else {
				topLevelDone.push(item);
			}
		}

		for (const item of topLevelDone) {
			const doneChildren = childrenByParent.get(item.id) ?? [];
			groups.push({ parentLabel: null, children: [item, ...doneChildren] });
			childrenByParent.delete(item.id);
		}

		for (const [parentId, children] of childrenByParent) {
			const parent = items.find((i) => i.id === parentId);
			if (parent) {
				groups.push({ parentLabel: parent, children });
			} else {
				groups.push({ parentLabel: null, children });
			}
		}

		return groups;
	});

	function emitChange() {
		const serialized = serializeChecklist(items);
		lastEmitted = serialized;
		onChange(serialized);
	}

	function toggleItem(id: string) {
		items = toggleItemWithCascade(id, items);
		emitChange();
	}

	function updateText(id: string, text: string) {
		const item = items.find((i) => i.id === id);
		if (item) {
			item.text = text;
			emitChange();
		}
	}

	function addItem(afterIndex: number) {
		const afterItem = items[afterIndex];
		const newItem: ChecklistItem = {
			id: generateId(),
			text: '',
			checked: false,
			parentId: afterItem?.parentId ?? null
		};
		items.splice(afterIndex + 1, 0, newItem);
		items = [...items];
		emitChange();
		const newId = newItem.id;
		setTimeout(() => {
			document.querySelector<HTMLInputElement>(`[data-item-id="${newId}"]`)?.focus();
		}, 0);
	}

	function removeItem(id: string) {
		if (items.length <= 1) {
			if (items[0].parentId) items[0].parentId = null;
			return;
		}
		items = items.map((i) => (i.parentId === id ? { ...i, parentId: null } : i));
		const index = items.findIndex((i) => i.id === id);
		items.splice(index, 1);
		items = [...items];
		emitChange();
	}

	function handleKeydown(e: KeyboardEvent, id: string) {
		const index = items.findIndex((i) => i.id === id);
		if (e.key === 'Enter') {
			e.preventDefault();
			addItem(index);
		} else if (e.key === 'Backspace' && items[index].text === '' && items.length > 1) {
			e.preventDefault();
			removeItem(id);
			setTimeout(() => {
				const inputs = document.querySelectorAll<HTMLInputElement>('[data-testid="checklist-input"]');
				inputs[Math.max(0, index - 1)]?.focus();
			}, 0);
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-testid="checklist-input"]'));
			const current = inputs.findIndex((el) => el.dataset.itemId === id);
			const target = e.key === 'ArrowUp' ? current - 1 : current + 1;
			if (target >= 0 && target < inputs.length) {
				e.preventDefault();
				inputs[target].focus();
			}
		} else if (e.key === 'Tab' && !e.shiftKey) {
			e.preventDefault();
			items = indentItem(id, items, activeItems);
			emitChange();
		} else if (e.key === 'Tab' && e.shiftKey) {
			e.preventDefault();
			items = outdentItem(id, items);
			emitChange();
		}
	}

	// --- Directional lock drag handle ---
	// Instead of blocking DnD events (which corrupts its internal state),
	// we detect horizontal intent and store the pending operation. DnD runs
	// its full course unimpeded. After DnD finalizes, we apply the indent.
	let dragStartX = 0;
	let dragStartY = 0;
	let pendingIndent: { id: string; direction: 'indent' | 'outdent' } | null = null;
	let directionLocked = false;
	const LOCK_THRESHOLD = 10;
	const INDENT_THRESHOLD = 32;

	function windowPointerMove(e: PointerEvent) {
		if (directionLocked) return;

		const dx = Math.abs(e.clientX - dragStartX);
		const dy = Math.abs(e.clientY - dragStartY);
		if (dx >= LOCK_THRESHOLD || dy >= LOCK_THRESHOLD) {
			directionLocked = true;
			if (dx <= dy) {
				// Vertical — DnD handles it, we're done
				removeWindowListeners();
			}
			// Horizontal — keep listening for pointerup to measure total dx
		}
	}

	function windowPointerUp(e: PointerEvent) {
		const dx = e.clientX - dragStartX;
		if (Math.abs(dx) > INDENT_THRESHOLD && directionLocked && currentDragItemId) {
			pendingIndent = {
				id: currentDragItemId,
				direction: dx > 0 ? 'indent' : 'outdent'
			};
		}
		removeWindowListeners();
		directionLocked = false;
	}

	function addWindowListeners() {
		window.addEventListener('pointermove', windowPointerMove, { capture: true });
		window.addEventListener('pointerup', windowPointerUp, { capture: true });
	}

	function removeWindowListeners() {
		window.removeEventListener('pointermove', windowPointerMove, { capture: true });
		window.removeEventListener('pointerup', windowPointerUp, { capture: true });
	}

	let currentDragItemId = '';
	function handleDragPointerDown(e: PointerEvent, id: string) {
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		directionLocked = false;
		pendingIndent = null;
		currentDragItemId = id;
		addWindowListeners();
	}

	onDestroy(removeWindowListeners);

	// --- DnD handlers ---
	function recomputeParentIds(reorderedItems: ChecklistItem[]): ChecklistItem[] {
		let lastTopLevelId: string | null = null;
		return reorderedItems.map((item) => {
			if (item.parentId === null) {
				lastTopLevelId = item.id;
				return item;
			}
			return { ...item, parentId: lastTopLevelId };
		});
	}

	function handleDndConsider(e: CustomEvent<DndEvent<ChecklistItem>>) {
		items = [...e.detail.items, ...items.filter((i) => i.checked)];
	}

	function handleDndFinalize(e: CustomEvent<DndEvent<ChecklistItem>>) {
		const reorderedActive = recomputeParentIds(e.detail.items);
		items = [...reorderedActive, ...items.filter((i) => i.checked)];
		emitChange();

		// Apply pending indent/outdent from horizontal drag (after DnD fully cleans up)
		if (pendingIndent && pendingIndent.id) {
			const { id, direction } = pendingIndent;
			pendingIndent = null;
			if (direction === 'indent') {
				items = indentItem(id, items, activeItems);
			} else {
				items = outdentItem(id, items);
			}
			emitChange();
		}
	}
</script>

<div class="space-y-0.5" data-testid="checklist">
	<section
		use:dragHandleZone={{ items: activeItems, flipDurationMs, dropTargetStyle: { outline: 'none' } }}
		onconsider={handleDndConsider}
		onfinalize={handleDndFinalize}
		class="space-y-0.5"
	>
		{#each activeItems as item (item.id)}
			<div class="group flex items-center gap-2 py-1.5 outline-none {item.parentId ? 'pl-8' : ''}"
				data-testid={item.parentId ? 'checklist-child-row' : undefined}
				animate:flip={{ duration: flipDurationMs }}>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div use:dragHandle
					aria-label="drag handle"
					role="button"
					tabindex="-1"
					onpointerdown={(e) => handleDragPointerDown(e, item.id)}
					class="drag-handle cursor-grab max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 touch-none outline-none"
					data-testid="checklist-drag-handle">
					<GripVertical class="h-4 w-4 text-[var(--text-muted)]" />
				</div>
				<input
					type="checkbox"
					checked={item.checked}
					onchange={() => toggleItem(item.id)}
					class="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--primary)] focus:ring-[var(--primary)]"
					data-testid="checklist-checkbox"
				/>
				<input
					type="text"
					value={item.text}
					oninput={(e) => updateText(item.id, (e.target as HTMLInputElement).value)}
					onkeydown={(e) => handleKeydown(e, item.id)}
					class="flex-1 min-w-0 bg-transparent text-sm outline-none {item.checked ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text)]'}"
					placeholder="List item"
					data-testid="checklist-input"
					data-item-id={item.id}
				/>
				<button
					onclick={() => removeItem(item.id)}
					class="max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
					aria-label="Remove item"
					data-testid="checklist-remove"
				>
					<XIcon class="h-4 w-4 text-[var(--text-muted)]" />
				</button>
			</div>
		{/each}
	</section>

	<button
		onclick={() => addItem(items.length - 1)}
		class="flex items-center gap-2 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
		data-testid="checklist-add"
	>
		<Plus class="h-4 w-4" />
		Add item
	</button>

	{#if doneCount > 0}
		<div class="mt-2 border-t border-[var(--border-subtle)] pt-2">
			<button
				onclick={() => (doneExpanded = !doneExpanded)}
				class="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
				data-testid="checklist-toggle-done"
			>
				<ChevronRight class="h-3 w-3 transition-transform duration-150 {doneExpanded ? 'rotate-90' : ''}" />
				{doneCount} done
			</button>

			{#if doneExpanded}
				<div class="mt-1 space-y-0.5" data-testid="checklist-done-section">
					{#each doneSectionGroups as group}
						{#if group.parentLabel}
							<div class="flex items-center gap-2 py-1.5 pl-5" data-testid="checklist-done-parent-label">
								<input type="checkbox" disabled class="h-4 w-4 rounded border-[var(--border-subtle)] opacity-50" />
								<span class="text-sm text-[var(--text-muted)]">{group.parentLabel.text}</span>
							</div>
						{/if}
						{#each group.children as item (item.id)}
							<div class="group flex items-center gap-2 py-1.5 {item.parentId ? 'pl-10' : 'pl-5'}">
								<input
									type="checkbox"
									checked={item.checked}
									onchange={() => toggleItem(item.id)}
									class="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--primary)] focus:ring-[var(--primary)]"
									data-testid="checklist-done-checkbox"
								/>
								<span class="flex-1 text-sm text-[var(--text-muted)] line-through">{item.text}</span>
								<button
									onclick={() => removeItem(item.id)}
									class="max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
									aria-label="Remove item"
									data-testid="checklist-done-remove"
								>
									<XIcon class="h-4 w-4 text-[var(--text-muted)]" />
								</button>
							</div>
						{/each}
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

