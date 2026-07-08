<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import {
		Undo2,
		Redo2,
		Heading,
		List,
		ListOrdered,
		ListChecks,
		TextQuote,
		CodeXml,
		Bold,
		Italic,
		Strikethrough,
		Code,
		Underline,
		Link,
		CornerDownLeft,
		ExternalLink,
		Trash2,
		AlignLeft,
		AlignCenter,
		AlignRight,
		AlignJustify,
		Minus,
		ChevronDown,
		Table2,
		BetweenHorizontalEnd,
		BetweenVerticalEnd,
		RemoveFormatting
	} from 'lucide-svelte';

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
	let dropdownAnchorEl: HTMLElement | null = $state(null);
	let linkUrl: string = $state('');
	let linkInput: HTMLInputElement | undefined = $state();
	let ignorePositionInvalidationUntil = 0;

	const dropdownGap = 4;
	const viewportMargin = 10;

	function toggleDropdown(name: string, anchorEl: HTMLElement) {
		if (openDropdown === name) {
			closeDropdowns();
		} else {
			ignorePositionInvalidationUntil = performance.now() + 600;
			openDropdown = name;
			dropdownAnchorEl = anchorEl;
			if (name === 'link') {
				linkUrl = editor?.getAttributes('link').href ?? '';
				requestAnimationFrame(() => linkInput?.focus());
			}
		}
	}

	function handleDropdownClick(name: string, event: MouseEvent) {
		toggleDropdown(name, event.currentTarget as HTMLElement);
	}

	function preventToolbarMouseFocus(event: MouseEvent) {
		if (event.button === 0) event.preventDefault();
	}

	function handleCommandClick(command: () => void) {
		command();
	}

	function closeDropdowns() {
		openDropdown = null;
		dropdownAnchorEl = null;
	}

	function closeDropdownsAfterPositionChange() {
		if (!openDropdown || performance.now() < ignorePositionInvalidationUntil) return;
		closeDropdowns();
	}

	function getViewportHeight(): number {
		return window.visualViewport?.height ?? window.innerHeight;
	}

	function getDropdownStyle(rect: DOMRect, width: number): string {
		const left = Math.max(viewportMargin, Math.min(rect.left, window.innerWidth - width - viewportMargin));
		const bottom = getViewportHeight() - rect.top + dropdownGap;
		return `bottom: ${bottom}px; left: ${left}px;`;
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

	$effect(() => {
		if (!openDropdown || !window.visualViewport) return;

		window.visualViewport.addEventListener('resize', closeDropdownsAfterPositionChange);
		window.visualViewport.addEventListener('scroll', closeDropdownsAfterPositionChange);
		return () => {
			window.visualViewport?.removeEventListener('resize', closeDropdownsAfterPositionChange);
			window.visualViewport?.removeEventListener('scroll', closeDropdownsAfterPositionChange);
		};
	});
</script>

<svelte:document onpointerdown={handlePointerDown} onkeydown={handleKeydown} />
<svelte:window onscroll={closeDropdownsAfterPositionChange} onresize={closeDropdownsAfterPositionChange} />

<div
	class="flex overflow-x-auto md:flex-wrap items-center gap-0.5 border-b border-[var(--border-subtle)] px-2 py-1 scrollbar-hide"
	style="scrollbar-width: none; -ms-overflow-style: none;"
	data-testid="formatting-toolbar"
	onscroll={closeDropdownsAfterPositionChange}
>
	<!-- Undo/Redo -->
	<button
		onmousedown={preventToolbarMouseFocus}
		onclick={() => handleCommandClick(() => editor?.chain().focus().undo().run())}
		disabled={!canUndo()}
		class={btnClass(false, !canUndo())}
		title="Undo"
		data-testid="format-undo"
	>
		<Undo2 size={iconSize} />
	</button>
	<button
		onmousedown={preventToolbarMouseFocus}
		onclick={() => handleCommandClick(() => editor?.chain().focus().redo().run())}
		disabled={!canRedo()}
		class={btnClass(false, !canRedo())}
		title="Redo"
		data-testid="format-redo"
	>
		<Redo2 size={iconSize} />
	</button>

	<div class="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]"></div>

	<!-- Inline -->
	<button
		onmousedown={preventToolbarMouseFocus}
		onclick={() => handleCommandClick(() => editor?.chain().focus().toggleBold().run())}
		class={btnClass(isActive('bold'))}
		title="Bold (Ctrl+B)"
		data-testid="format-bold"
	>
		<Bold size={iconSize} />
	</button>
	<button
		onmousedown={preventToolbarMouseFocus}
		onclick={() => handleCommandClick(() => editor?.chain().focus().toggleItalic().run())}
		class={btnClass(isActive('italic'))}
		title="Italic (Ctrl+I)"
		data-testid="format-italic"
	>
		<Italic size={iconSize} />
	</button>
	<button
		onmousedown={preventToolbarMouseFocus}
		onclick={() => handleCommandClick(() => editor?.chain().focus().toggleStrike().run())}
		class={btnClass(isActive('strike'))}
		title="Strikethrough (Ctrl+Shift+X)"
		data-testid="format-strikethrough"
	>
		<Strikethrough size={iconSize} />
	</button>
	<button
		onmousedown={preventToolbarMouseFocus}
		onclick={() => handleCommandClick(() => editor?.chain().focus().toggleUnderline().run())}
		class={btnClass(isActive('underline'))}
		title="Underline (Ctrl+U)"
		data-testid="format-underline"
	>
		<Underline size={iconSize} />
	</button>

	<div class="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]"></div>

	<!-- Heading dropdown -->
	<div data-dropdown="heading">
		<button
			onmousedown={preventToolbarMouseFocus}
			onclick={(e) => handleDropdownClick('heading', e)}
			class={dropdownBtnClass(isActive('heading'))}
			title="Heading"
			data-testid="format-heading"
		>
			<Heading size={iconSize} />
			<ChevronDown size={chevronSize} />
		</button>
	</div>

	<!-- List dropdown -->
	<div data-dropdown="list">
		<button
			onmousedown={preventToolbarMouseFocus}
			onclick={(e) => handleDropdownClick('list', e)}
			class={dropdownBtnClass(isActive('bulletList') || isActive('orderedList') || isActive('taskList'))}
			title="Lists"
			data-testid="format-list"
		>
			<List size={iconSize} />
			<ChevronDown size={chevronSize} />
		</button>
	</div>

	<!-- Link popover -->
	<div data-dropdown="link">
		<button
			onmousedown={preventToolbarMouseFocus}
			onclick={(e) => handleDropdownClick('link', e)}
			class={btnClass(isActive('link'))}
			title="Insert link (Ctrl+K)"
			data-testid="format-link"
		>
			<Link size={iconSize} />
		</button>
	</div>

	<!-- Table dropdown -->
	<div data-dropdown="table">
		<button
			onmousedown={preventToolbarMouseFocus}
			onclick={(e) => handleDropdownClick('table', e)}
			class={dropdownBtnClass(isActive('table'))}
			title="Table"
			data-testid="format-table"
		>
			<Table2 size={iconSize} />
			<ChevronDown size={chevronSize} />
		</button>
	</div>

	<!-- Alignment dropdown -->
	<div data-dropdown="align">
		<button
			onmousedown={preventToolbarMouseFocus}
			onclick={(e) => handleDropdownClick('align', e)}
			class={dropdownBtnClass(isActive({ textAlign: 'center' }) || isActive({ textAlign: 'right' }) || isActive({ textAlign: 'justify' }))}
			title="Text alignment"
			data-testid="format-align"
		>
			{#if isActive({ textAlign: 'center' })}
				<AlignCenter size={iconSize} />
			{:else if isActive({ textAlign: 'right' })}
				<AlignRight size={iconSize} />
			{:else if isActive({ textAlign: 'justify' })}
				<AlignJustify size={iconSize} />
			{:else}
				<AlignLeft size={iconSize} />
			{/if}
			<ChevronDown size={chevronSize} />
		</button>
	</div>

	<div class="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]"></div>

	<!-- Block-level formatting -->
	<button
		onmousedown={preventToolbarMouseFocus}
		onclick={() => handleCommandClick(() => editor?.chain().focus().toggleCode().run())}
		class={btnClass(isActive('code'))}
		title="Inline code"
		data-testid="format-code"
	>
		<Code size={iconSize} />
	</button>
	<button
		onmousedown={preventToolbarMouseFocus}
		onclick={() => handleCommandClick(() => editor?.chain().focus().toggleBlockquote().run())}
		class={btnClass(isActive('blockquote'))}
		title="Blockquote"
		data-testid="format-blockquote"
	>
		<TextQuote size={iconSize} />
	</button>
	<button
		onmousedown={preventToolbarMouseFocus}
		onclick={() => handleCommandClick(() => editor?.chain().focus().toggleCodeBlock().run())}
		class={btnClass(isActive('codeBlock'))}
		title="Code block"
		data-testid="format-code-block"
	>
		<CodeXml size={iconSize} />
	</button>
	<button
		onmousedown={preventToolbarMouseFocus}
		onclick={() => handleCommandClick(() => editor?.chain().focus().setHorizontalRule().run())}
		class={btnClass()}
		title="Divider"
		data-testid="format-hr"
	>
		<Minus size={iconSize} />
	</button>
</div>

<!-- Render dropdown menus in a fixed portal so they aren't clipped by overflow-x-auto -->
{#if openDropdown && dropdownAnchorEl}
	{@const rect = dropdownAnchorEl.getBoundingClientRect()}
	
	{#if openDropdown === 'heading'}
		<div
			class="fixed z-50 mb-1 min-w-[150px] rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] py-1"
			style={getDropdownStyle(rect, 170)}
			data-dropdown="true"
		>
			<button
				onmousedown={preventToolbarMouseFocus}
				onclick={() => { editor?.chain().focus().toggleHeading({ level: 1 }).run(); closeDropdowns(); }}
				class={dropdownItemClass(isActive('heading', { level: 1 }))}
				data-testid="format-h1"
			>
				<span class="w-6 text-xs font-semibold text-[var(--text-muted)]">H1</span>
				<span class="font-semibold">Heading 1</span>
			</button>
			<button
				onmousedown={preventToolbarMouseFocus}
				onclick={() => { editor?.chain().focus().toggleHeading({ level: 2 }).run(); closeDropdowns(); }}
				class={dropdownItemClass(isActive('heading', { level: 2 }))}
				data-testid="format-h2"
			>
				<span class="w-6 text-xs font-semibold text-[var(--text-muted)]">H2</span>
				<span>Heading 2</span>
			</button>
			<button
				onmousedown={preventToolbarMouseFocus}
				onclick={() => { editor?.chain().focus().toggleHeading({ level: 3 }).run(); closeDropdowns(); }}
				class={dropdownItemClass(isActive('heading', { level: 3 }))}
				data-testid="format-h3"
			>
				<span class="w-6 text-xs font-semibold text-[var(--text-muted)]">H3</span>
				<span>Heading 3</span>
			</button>
		</div>
	{:else if openDropdown === 'list'}
		<div
			class="fixed z-50 mb-1 min-w-[170px] rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] py-1"
			style={getDropdownStyle(rect, 190)}
			data-dropdown="true"
		>
			<button
				onmousedown={preventToolbarMouseFocus}
				onclick={() => { editor?.chain().focus().toggleBulletList().run(); closeDropdowns(); }}
				class={dropdownItemClass(isActive('bulletList'))}
				data-testid="format-bullet-list"
			>
				<List size={iconSize} />
				<span>Bullet list</span>
			</button>
			<button
				onmousedown={preventToolbarMouseFocus}
				onclick={() => { editor?.chain().focus().toggleOrderedList().run(); closeDropdowns(); }}
				class={dropdownItemClass(isActive('orderedList'))}
				data-testid="format-ordered-list"
			>
				<ListOrdered size={iconSize} />
				<span>Ordered list</span>
			</button>
			<button
				onmousedown={preventToolbarMouseFocus}
				onclick={() => { editor?.chain().focus().toggleTaskList().run(); closeDropdowns(); }}
				class={dropdownItemClass(isActive('taskList'))}
				data-testid="format-task-list"
			>
				<ListChecks size={iconSize} />
				<span>Task list</span>
			</button>
		</div>
	{:else if openDropdown === 'link'}
		<div
			class="fixed z-50 mb-1 min-w-[200px] rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5"
			style={getDropdownStyle(rect, 220)}
			data-dropdown="true"
		>
			<form
				class="flex items-center gap-1"
				onsubmit={(e) => { e.preventDefault(); applyLink(); }}
			>
				<input
					bind:this={linkInput}
					bind:value={linkUrl}
					type="url"
					placeholder="Paste a link..."
					class="w-44 bg-transparent px-1.5 py-1 text-base md:text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
					data-testid="format-link-input"
				/>
				<button
					onmousedown={preventToolbarMouseFocus}
					type="submit"
					class="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]/5 hover:text-[var(--text)]"
					title="Apply link"
					data-testid="format-link-apply"
				>
					<CornerDownLeft size={16} />
				</button>
				<div class="mx-0.5 h-4 w-px bg-[var(--border-subtle)]"></div>
				<button
					onmousedown={preventToolbarMouseFocus}
					type="button"
					onclick={openLink}
					disabled={!getAttrs('link').href}
					class="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]/5 hover:text-[var(--text)] disabled:opacity-30"
					title="Open link"
					data-testid="format-link-open"
				>
					<ExternalLink size={16} />
				</button>
				<button
					onmousedown={preventToolbarMouseFocus}
					type="button"
					onclick={removeLink}
					disabled={!isActive('link')}
					class="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]/5 hover:text-[var(--destructive)] disabled:opacity-30"
					title="Remove link"
					data-testid="format-link-remove"
				>
					<Trash2 size={16} />
				</button>
			</form>
		</div>
	{:else if openDropdown === 'table'}
		<div
			class="fixed z-50 mb-1 min-w-[190px] rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] py-1"
			style={getDropdownStyle(rect, 210)}
			data-dropdown="true"
		>
			<button
				onmousedown={preventToolbarMouseFocus}
				onclick={() => { editor?.chain().focus().insertTable({ rows: 3, cols: 3 }).run(); closeDropdowns(); }}
				class={dropdownItemClass()}
				data-testid="format-insert-table"
			>
				<Table2 size={iconSize} />
				<span>Insert table</span>
			</button>
			{#if isActive('table')}
				<div class="my-1 h-px bg-[var(--border-subtle)]"></div>
				<button
					onmousedown={preventToolbarMouseFocus}
					onclick={() => { editor?.chain().focus().addRowAfter().run(); closeDropdowns(); }}
					class={dropdownItemClass()}
					data-testid="format-add-row"
				>
					<BetweenHorizontalEnd size={iconSize} />
					<span>Add row</span>
				</button>
				<button
					onmousedown={preventToolbarMouseFocus}
					onclick={() => { editor?.chain().focus().addColumnAfter().run(); closeDropdowns(); }}
					class={dropdownItemClass()}
					data-testid="format-add-column"
				>
					<BetweenVerticalEnd size={iconSize} />
					<span>Add column</span>
				</button>
				<div class="my-1 h-px bg-[var(--border-subtle)]"></div>
				<button
					onmousedown={preventToolbarMouseFocus}
					onclick={() => { editor?.chain().focus().deleteRow().run(); closeDropdowns(); }}
					class={dropdownItemClass()}
					data-testid="format-delete-row"
				>
					<Minus size={iconSize} />
					<span>Delete row</span>
				</button>
				<button
					onmousedown={preventToolbarMouseFocus}
					onclick={() => { editor?.chain().focus().deleteColumn().run(); closeDropdowns(); }}
					class={dropdownItemClass()}
					data-testid="format-delete-column"
				>
					<Minus size={iconSize} />
					<span>Delete column</span>
				</button>
				<button
					onmousedown={preventToolbarMouseFocus}
					onclick={() => { editor?.chain().focus().deleteTable().run(); closeDropdowns(); }}
					class={`${dropdownItemClass()} text-[var(--destructive)]`}
					data-testid="format-delete-table"
				>
					<RemoveFormatting size={iconSize} />
					<span>Delete table</span>
				</button>
			{/if}
		</div>
	{:else if openDropdown === 'align'}
		<div
			class="fixed z-50 mb-1 min-w-[160px] rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] py-1"
			style={getDropdownStyle(rect, 180)}
			data-dropdown="true"
		>
			<button
				onmousedown={preventToolbarMouseFocus}
				onclick={() => { editor?.chain().focus().setTextAlign('left').run(); closeDropdowns(); }}
				class={dropdownItemClass(isActive({ textAlign: 'left' }))}
				data-testid="format-align-left"
			>
				<AlignLeft size={iconSize} />
				<span>Left</span>
			</button>
			<button
				onmousedown={preventToolbarMouseFocus}
				onclick={() => { editor?.chain().focus().setTextAlign('center').run(); closeDropdowns(); }}
				class={dropdownItemClass(isActive({ textAlign: 'center' }))}
				data-testid="format-align-center"
			>
				<AlignCenter size={iconSize} />
				<span>Center</span>
			</button>
			<button
				onmousedown={preventToolbarMouseFocus}
				onclick={() => { editor?.chain().focus().setTextAlign('right').run(); closeDropdowns(); }}
				class={dropdownItemClass(isActive({ textAlign: 'right' }))}
				data-testid="format-align-right"
			>
				<AlignRight size={iconSize} />
				<span>Right</span>
			</button>
			<button
				onmousedown={preventToolbarMouseFocus}
				onclick={() => { editor?.chain().focus().setTextAlign('justify').run(); closeDropdowns(); }}
				class={dropdownItemClass(isActive({ textAlign: 'justify' }))}
				data-testid="format-align-justify"
			>
				<AlignJustify size={iconSize} />
				<span>Justify</span>
			</button>
		</div>
	{/if}
{/if}

<style>
	[data-testid="formatting-toolbar"]::-webkit-scrollbar {
		display: none;
	}
</style>
