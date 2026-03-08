<script lang="ts">
	import { currentFilter, loadNotes, allTags, selectedTag } from '$lib/stores/notes.js';
	import { StickyNote, Archive, Trash2, Tag } from 'lucide-svelte';
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

		<div class="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
			<ul class="space-y-1">
				<li>
					<a
						href="/settings"
						class="flex w-full items-center gap-3 rounded-full px-6 py-3 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
						Settings
					</a>
				</li>
			</ul>
		</div>

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
	{#if appVersion}
		<div class="absolute bottom-0 left-0 w-full border-t border-[var(--border-subtle)] px-6 py-3 text-right text-xs text-[var(--text-muted)]">
			v{appVersion}
		</div>
	{/if}
</aside>
