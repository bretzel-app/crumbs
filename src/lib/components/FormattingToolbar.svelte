<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import {
		Bold,
		Italic,
		Strikethrough,
		Underline
	} from 'lucide-svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		tick?: number;
		editor: Editor | undefined;
	}

	let { editor, tick }: Props = $props();

	function canUndo() { void tick; return editor?.can().chain().focus().undo().run() ?? false; }
	function canRedo() { void tick; return editor?.can().chain().focus().redo().run() ?? false; }
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function isActive(nameOrAttrs: any, attrs?: Record<string, any>): boolean { void tick; return editor?.isActive(nameOrAttrs, attrs) ?? false; }
	function getAttrs(type: string) { void tick; return editor?.getAttributes(type) ?? {}; }

	let openDropdown: string | null = $state(null);
	let linkUrl: string = $state('');
	let linkInput: HTMLInputElement | undefined = $state();

	function toggleDropdown(name: string) {
		if (openDropdown === name) {
			openDropdown = null;
		} else {
			openDropdown = name;
			if (name === 'link') {
				linkUrl = editor?.getAttributes('link').href ?? '';
				// Focus input after Svelte renders the popover
				requestAnimationFrame(() => linkInput?.focus());
			}
		}
	}

	function closeDropdowns() {
		openDropdown = null;
	}

	function applyLink() {
		if (!editor) return;
		const url = linkUrl.trim();
		if (url) {
			editor.chain().focus().setLink({ href: url }).run();
		}
		closeDropdowns();
	}

	function removeLink() {
		if (!editor) return;
		editor.chain().focus().unsetLink().run();
		closeDropdowns();
	}

	function openLink() {
		const href = editor?.getAttributes('link').href;
		if (href) window.open(href, '_blank', 'noopener');
	}

	const iconSize = 18;
	const chevronSize = 14;

	function btnClass(active: boolean = false, disabled: boolean = false): string {
		return `shrink-0 rounded p-1.5 text-[var(--text)] hover:bg-[var(--border)]/10 ${active ? 'text-[var(--primary)] bg-[var(--border)]/10' : ''} ${disabled ? 'opacity-30' : ''}`;
	}

	function dropdownBtnClass(active: boolean = false): string {
		return `shrink-0 flex items-center gap-0.5 rounded p-1.5 text-[var(--text)] hover:bg-[var(--border)]/10 ${active ? 'text-[var(--primary)] bg-[var(--border)]/10' : ''}`;
	}

	function dropdownItemClass(active: boolean = false): string {
		return `flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--border)]/5 ${active ? 'bg-[var(--border)]/5' : ''}`;
	}

	function handlePointerDown(event: PointerEvent) {
		if (!openDropdown) return;
		const target = event.target as HTMLElement;
		if (!target.closest('[data-dropdown]')) {
			closeDropdowns();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && openDropdown) {
			closeDropdowns();
		}
	}
</script>

<svelte:document onpointerdown={handlePointerDown} onkeydown={handleKeydown} />

<div
	class="flex flex-wrap items-center gap-0.5 border-b border-[var(--border-subtle)] px-2 py-1"
	data-testid="formatting-toolbar"
>
	<!-- Undo/Redo -->
	<button
		onclick={() => editor?.chain().focus().undo().run()}
		disabled={!canUndo()}
		class={btnClass(false, !canUndo())}
		title="Undo"
		data-testid="format-undo"
	>
		<Icon icon="pixelarticons:undo" width={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().redo().run()}
		disabled={!canRedo()}
		class={btnClass(false, !canRedo())}
		title="Redo"
		data-testid="format-redo"
	>
		<Icon icon="pixelarticons:redo" width={iconSize} />
	</button>

	<div class="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]"></div>

	<!-- Inline -->
	<button
		onclick={() => editor?.chain().focus().toggleBold().run()}
		class={btnClass(isActive('bold'))}
		title="Bold (Ctrl+B)"
		data-testid="format-bold"
	>
		<Bold size={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().toggleItalic().run()}
		class={btnClass(isActive('italic'))}
		title="Italic (Ctrl+I)"
		data-testid="format-italic"
	>
		<Italic size={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().toggleStrike().run()}
		class={btnClass(isActive('strike'))}
		title="Strikethrough (Ctrl+Shift+X)"
		data-testid="format-strikethrough"
	>
		<Strikethrough size={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().toggleUnderline().run()}
		class={btnClass(isActive('underline'))}
		title="Underline (Ctrl+U)"
		data-testid="format-underline"
	>
		<Underline size={iconSize} />
	</button>

	<div class="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]"></div>

	<!-- Heading dropdown -->
	<div class="relative" data-dropdown="heading">
		<button
			onclick={() => toggleDropdown('heading')}
			class={dropdownBtnClass(isActive('heading'))}
			title="Heading"
			data-testid="format-heading"
		>
			<Icon icon="pixelarticons:heading" width={iconSize} />
			<Icon icon="pixelarticons:chevron-down" width={chevronSize} />
		</button>
		{#if openDropdown === 'heading'}
			<div class="absolute left-0 bottom-full z-50 mb-1 min-w-[150px] rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] py-1">
				<button
					onclick={() => { editor?.chain().focus().toggleHeading({ level: 1 }).run(); closeDropdowns(); }}
					class={dropdownItemClass(isActive('heading', { level: 1 }))}
					data-testid="format-h1"
				>
					<span class="w-6 text-xs font-semibold text-[var(--text-muted)]">H1</span>
					<span class="font-semibold">Heading 1</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().toggleHeading({ level: 2 }).run(); closeDropdowns(); }}
					class={dropdownItemClass(isActive('heading', { level: 2 }))}
					data-testid="format-h2"
				>
					<span class="w-6 text-xs font-semibold text-[var(--text-muted)]">H2</span>
					<span>Heading 2</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().toggleHeading({ level: 3 }).run(); closeDropdowns(); }}
					class={dropdownItemClass(isActive('heading', { level: 3 }))}
					data-testid="format-h3"
				>
					<span class="w-6 text-xs font-semibold text-[var(--text-muted)]">H3</span>
					<span>Heading 3</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- List dropdown -->
	<div class="relative" data-dropdown="list">
		<button
			onclick={() => toggleDropdown('list')}
			class={dropdownBtnClass(isActive('bulletList') || isActive('orderedList') || isActive('taskList'))}
			title="Lists"
			data-testid="format-list"
		>
			<Icon icon="pixelarticons:list" width={iconSize} />
			<Icon icon="pixelarticons:chevron-down" width={chevronSize} />
		</button>
		{#if openDropdown === 'list'}
			<div class="absolute left-0 bottom-full z-50 mb-1 min-w-[170px] rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] py-1">
				<button
					onclick={() => { editor?.chain().focus().toggleBulletList().run(); closeDropdowns(); }}
					class={dropdownItemClass(isActive('bulletList'))}
					data-testid="format-bullet-list"
				>
					<Icon icon="pixelarticons:list" width={iconSize} />
					<span>Bullet list</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().toggleOrderedList().run(); closeDropdowns(); }}
					class={dropdownItemClass(isActive('orderedList'))}
					data-testid="format-ordered-list"
				>
					<Icon icon="pixelarticons:bulletlist" width={iconSize} />
					<span>Ordered list</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().toggleTaskList().run(); closeDropdowns(); }}
					class={dropdownItemClass(isActive('taskList'))}
					data-testid="format-task-list"
				>
					<Icon icon="pixelarticons:checklist" width={iconSize} />
					<span>Task list</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- Link popover -->
	<div class="relative" data-dropdown="link">
		<button
			onclick={() => toggleDropdown('link')}
			class={btnClass(isActive('link'))}
			title="Insert link (Ctrl+K)"
			data-testid="format-link"
		>
			<Icon icon="pixelarticons:link" width={iconSize} />
		</button>
		{#if openDropdown === 'link'}
			<div class="absolute left-1/2 bottom-full z-50 mb-1 -translate-x-1/2 rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5">
				<form
					class="flex items-center gap-1"
					onsubmit={(e) => { e.preventDefault(); applyLink(); }}
				>
					<input
						bind:this={linkInput}
						bind:value={linkUrl}
						type="url"
						placeholder="Paste a link..."
						class="w-44 bg-transparent px-1.5 py-1 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
						data-testid="format-link-input"
					/>
					<button
						type="submit"
						class="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]/5 hover:text-[var(--text)]"
						title="Apply link"
						data-testid="format-link-apply"
					>
						<Icon icon="pixelarticons:corner-down-left" width={16} />
					</button>
					<div class="mx-0.5 h-4 w-px bg-[var(--border-subtle)]"></div>
					<button
						type="button"
						onclick={openLink}
						disabled={!getAttrs('link').href}
						class="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]/5 hover:text-[var(--text)] disabled:opacity-30"
						title="Open link"
						data-testid="format-link-open"
					>
						<Icon icon="pixelarticons:external-link" width={16} />
					</button>
					<button
						type="button"
						onclick={removeLink}
						disabled={!isActive('link')}
						class="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]/5 hover:text-red-500 disabled:opacity-30"
						title="Remove link"
						data-testid="format-unlink"
					>
						<Icon icon="pixelarticons:trash" width={16} />
					</button>
				</form>
			</div>
		{/if}
	</div>

	<!-- Table dropdown -->
	<div class="relative" data-dropdown="table">
		<button
			onclick={() => toggleDropdown('table')}
			class={dropdownBtnClass(isActive('table'))}
			title="Table"
			data-testid="format-table"
		>
			<Icon icon="pixelarticons:table" width={iconSize} />
			<Icon icon="pixelarticons:chevron-down" width={chevronSize} />
		</button>
		{#if openDropdown === 'table'}
			<div class="absolute left-0 bottom-full z-50 mb-1 min-w-[190px] rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] py-1">
				<button
					onclick={() => { editor?.chain().focus().insertTable({ rows: 3, cols: 3 }).run(); closeDropdowns(); }}
					class={dropdownItemClass()}
					data-testid="format-table-insert"
				>
					<Icon icon="pixelarticons:table" width={iconSize} />
					<span>Insert table</span>
				</button>
				{#if isActive('table')}
					<div class="my-1 h-px bg-[var(--border-subtle)]"></div>
					<button
						onclick={() => { editor?.chain().focus().addRowAfter().run(); closeDropdowns(); }}
						class={dropdownItemClass()}
						data-testid="format-table-add-row"
					>
						<Icon icon="pixelarticons:add-row" width={iconSize} />
						<span>Add row</span>
					</button>
					<button
						onclick={() => { editor?.chain().focus().addColumnAfter().run(); closeDropdowns(); }}
						class={dropdownItemClass()}
						data-testid="format-table-add-col"
					>
						<Icon icon="pixelarticons:add-col" width={iconSize} />
						<span>Add column</span>
					</button>
					<div class="my-1 h-px bg-[var(--border-subtle)]"></div>
					<button
						onclick={() => { editor?.chain().focus().deleteRow().run(); closeDropdowns(); }}
						class={dropdownItemClass()}
						data-testid="format-table-delete-row"
					>
						<Icon icon="pixelarticons:minus" width={iconSize} />
						<span>Delete row</span>
					</button>
					<button
						onclick={() => { editor?.chain().focus().deleteColumn().run(); closeDropdowns(); }}
						class={dropdownItemClass()}
						data-testid="format-table-delete-col"
					>
						<Icon icon="pixelarticons:minus" width={iconSize} />
						<span>Delete column</span>
					</button>
					<button
						onclick={() => { editor?.chain().focus().deleteTable().run(); closeDropdowns(); }}
						class={`${dropdownItemClass()} text-[var(--destructive)]`}
						data-testid="format-table-delete"
					>
						<Icon icon="pixelarticons:remove-box" width={iconSize} />
						<span>Delete table</span>
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Alignment dropdown -->
	<div class="relative" data-dropdown="align">
		<button
			onclick={() => toggleDropdown('align')}
			class={dropdownBtnClass(isActive({ textAlign: 'center' }) || isActive({ textAlign: 'right' }) || isActive({ textAlign: 'justify' }))}
			title="Text alignment"
			data-testid="format-align"
		>
			{#if isActive({ textAlign: 'center' })}
				<Icon icon="pixelarticons:text-align-center" width={iconSize} />
			{:else if isActive({ textAlign: 'right' })}
				<Icon icon="pixelarticons:text-align-right" width={iconSize} />
			{:else if isActive({ textAlign: 'justify' })}
				<Icon icon="pixelarticons:text-align-justify" width={iconSize} />
			{:else}
				<Icon icon="pixelarticons:text-align-left" width={iconSize} />
			{/if}
			<Icon icon="pixelarticons:chevron-down" width={chevronSize} />
		</button>
		{#if openDropdown === 'align'}
			<div class="absolute right-0 bottom-full z-50 mb-1 min-w-[160px] rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] py-1">
				<button
					onclick={() => { editor?.chain().focus().setTextAlign('left').run(); closeDropdowns(); }}
					class={dropdownItemClass(isActive({ textAlign: 'left' }))}
					data-testid="format-align-left"
				>
					<Icon icon="pixelarticons:text-align-left" width={iconSize} />
					<span>Left</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().setTextAlign('center').run(); closeDropdowns(); }}
					class={dropdownItemClass(isActive({ textAlign: 'center' }))}
					data-testid="format-align-center"
				>
					<Icon icon="pixelarticons:text-align-center" width={iconSize} />
					<span>Center</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().setTextAlign('right').run(); closeDropdowns(); }}
					class={dropdownItemClass(isActive({ textAlign: 'right' }))}
					data-testid="format-align-right"
				>
					<Icon icon="pixelarticons:text-align-right" width={iconSize} />
					<span>Right</span>
				</button>
				<button
					onclick={() => { editor?.chain().focus().setTextAlign('justify').run(); closeDropdowns(); }}
					class={dropdownItemClass(isActive({ textAlign: 'justify' }))}
					data-testid="format-align-justify"
				>
					<Icon icon="pixelarticons:text-align-justify" width={iconSize} />
					<span>Justify</span>
				</button>
			</div>
		{/if}
	</div>

	<div class="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]"></div>

	<!-- Block-level formatting -->
	<button
		onclick={() => editor?.chain().focus().toggleCode().run()}
		class={btnClass(isActive('code'))}
		title="Inline code"
		data-testid="format-code"
	>
		<Icon icon="pixelarticons:braces" width={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().toggleBlockquote().run()}
		class={btnClass(isActive('blockquote'))}
		title="Blockquote"
		data-testid="format-blockquote"
	>
		<Icon icon="pixelarticons:quote-text-inline" width={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
		class={btnClass(isActive('codeBlock'))}
		title="Code block"
		data-testid="format-code-block"
	>
		<Icon icon="pixelarticons:braces" width={iconSize} />
	</button>
	<button
		onclick={() => editor?.chain().focus().setHorizontalRule().run()}
		class={btnClass()}
		title="Divider"
		data-testid="format-hr"
	>
		<Icon icon="pixelarticons:minus" width={iconSize} />
	</button>
</div>
