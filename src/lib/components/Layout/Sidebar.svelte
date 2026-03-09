<script lang="ts">
	import { currentFilter, loadNotes, allTags, selectedTag } from '$lib/stores/notes.js';
	import { StickyNote, Archive, Trash2, Tag, Settings } from 'lucide-svelte';
	import type { NoteFilter } from '$lib/types/index.js';

	interface Props {
		open: boolean;
		onClose?: () => void;
		appVersion?: string;
	}

	let { open, onClose, appVersion }: Props = $props();

	function closeMobile() {
		if (window.matchMedia('(max-width: 1023px)').matches) {
			onClose?.();
		}
	}

	function setFilter(filter: NoteFilter) {
		selectedTag.set(null);
		loadNotes(filter);
		closeMobile();
	}

	function selectTag(tag: string | null) {
		selectedTag.set(tag);
		loadNotes('all');
		closeMobile();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 top-16 z-10 bg-black/30 lg:hidden"
		onclick={onClose}
		onkeydown={(e) => { if (e.key === 'Escape') onClose?.(); }}
	></div>
{/if}

<aside
	class="fixed left-0 top-16 z-20 h-[calc(100vh-4rem)] w-64 transform border-r border-[var(--border)] bg-[var(--bg-surface)] transition-transform duration-200 {open ? 'translate-x-0' : '-translate-x-full'}"
>
	<nav class="p-2">
		<ul class="space-y-1">
			<li>
				<button
					onclick={() => setFilter('all')}
					class="flex w-full items-center gap-3 rounded-sm px-6 py-3 text-left text-sm transition-colors {$currentFilter === 'all' && !$selectedTag ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'text-[var(--text)] hover:bg-[var(--bg-base)]'}"
				>
					<StickyNote size={20} />
					Crumbs
				</button>
			</li>
			<li>
				<button
					onclick={() => setFilter('archived')}
					class="flex w-full items-center gap-3 rounded-sm px-6 py-3 text-left text-sm transition-colors {$currentFilter === 'archived' ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'text-[var(--text)] hover:bg-[var(--bg-base)]'}"
				>
					<Archive size={20} />
					Archive
				</button>
			</li>
			<li>
				<button
					onclick={() => setFilter('trashed')}
					class="flex w-full items-center gap-3 rounded-sm px-6 py-3 text-left text-sm transition-colors {$currentFilter === 'trashed' ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'text-[var(--text)] hover:bg-[var(--bg-base)]'}"
				>
					<Trash2 size={20} />
					Trash
				</button>
			</li>
		</ul>

		{#if $allTags.length > 0}
			<div class="mt-6 border-t border-[var(--border-subtle)] pt-4">
				<h3 class="px-6 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tags</h3>
				<ul class="mt-2 space-y-1">
					{#each $allTags as tag}
						<li>
							<button
								onclick={() => selectTag($selectedTag === tag ? null : tag)}
								class="flex w-full items-center gap-3 rounded-sm px-6 py-2 text-left text-sm transition-colors {$selectedTag === tag ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'text-[var(--text)] hover:bg-[var(--bg-base)]'}"
							>
								<Tag size={16} />
								#{tag}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</nav>
	<div class="absolute bottom-0 left-0 w-full border-t border-[var(--border-subtle)]">
		<a
			href="/settings"
			class="flex w-full items-center gap-3 px-6 py-3 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--primary)]"
			onclick={closeMobile}
			data-testid="settings-link"
		>
			<Settings size={16} />
			Settings
		</a>
		{#if appVersion}
			<div class="border-t border-[var(--border-subtle)] px-6 py-2 text-right text-xs text-[var(--text-muted)]">
				v{appVersion}
			</div>
		{/if}
	</div>
</aside>
