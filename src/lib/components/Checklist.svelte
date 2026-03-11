<script lang="ts">
	import XIcon from 'lucide-svelte/icons/x';
	import Plus from 'lucide-svelte/icons/plus';
	import GripVertical from 'lucide-svelte/icons/grip-vertical';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import { dragHandleZone, dragHandle, type DndEvent } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

	interface ChecklistItem {
		id: string;
		text: string;
		checked: boolean;
	}

	interface Props {
		content: string;
		onChange: (content: string) => void;
	}

	let { content, onChange }: Props = $props();

	// svelte-ignore state_referenced_locally
	let items = $state<ChecklistItem[]>(parseChecklist(content));
	let doneExpanded = $state(true);
	const flipDurationMs = 150;

	let activeItems = $derived(items.filter((i) => !i.checked));
	let doneItems = $derived(items.filter((i) => i.checked));
	let doneCount = $derived(doneItems.length);

	function generateId(): string {
		return crypto.randomUUID();
	}

	function parseChecklist(text: string): ChecklistItem[] {
		if (!text.trim()) return [{ id: generateId(), text: '', checked: false }];
		const lines = text.split('\n');
		return lines.map((line) => {
			if (line.startsWith('- [x] ')) return { id: generateId(), text: line.slice(6), checked: true };
			if (line.startsWith('- [ ] ')) return { id: generateId(), text: line.slice(6), checked: false };
			return { id: generateId(), text: line, checked: false };
		});
	}

	function serializeChecklist(list: ChecklistItem[]): string {
		return list
			.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
			.join('\n');
	}

	function emitChange() {
		onChange(serializeChecklist(items));
	}

	function toggleItem(id: string) {
		const item = items.find((i) => i.id === id);
		if (item) {
			item.checked = !item.checked;
			emitChange();
		}
	}

	function updateText(id: string, text: string) {
		const item = items.find((i) => i.id === id);
		if (item) {
			item.text = text;
			emitChange();
		}
	}

	function addItem(afterIndex: number) {
		const newItem = { id: generateId(), text: '', checked: false };
		items.splice(afterIndex + 1, 0, newItem);
		items = [...items];
		emitChange();
		setTimeout(() => {
			const inputs = document.querySelectorAll<HTMLInputElement>('[data-testid="checklist-input"]');
			inputs[afterIndex + 1]?.focus();
		}, 0);
	}

	function removeItem(id: string) {
		if (items.length <= 1) return;
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
		}
	}

	function handleDndConsider(e: CustomEvent<DndEvent<ChecklistItem>>) {
		// Merge reordered active items with done items
		items = [...e.detail.items, ...items.filter((i) => i.checked)];
	}

	function handleDndFinalize(e: CustomEvent<DndEvent<ChecklistItem>>) {
		items = [...e.detail.items, ...items.filter((i) => i.checked)];
		emitChange();
	}
</script>

<div class="space-y-0.5" data-testid="checklist">
	<section
		use:dragHandleZone={{ items: activeItems, flipDurationMs, dropTargetStyle: {} }}
		onconsider={handleDndConsider}
		onfinalize={handleDndFinalize}
		class="space-y-0.5"
	>
		{#each activeItems as item (item.id)}
			<div class="group flex items-center gap-2 py-1.5" animate:flip={{ duration: flipDurationMs }}>
				<div use:dragHandle aria-label="drag handle" class="drag-handle cursor-grab max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150" data-testid="checklist-drag-handle">
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
		class="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
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
				<div class="mt-1 space-y-0.5 pl-5" data-testid="checklist-done-section">
					{#each doneItems as item (item.id)}
						<div class="group flex items-center gap-2 py-1.5">
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
				</div>
			{/if}
		</div>
	{/if}
</div>
