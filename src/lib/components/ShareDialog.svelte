<script lang="ts">
	import type { Collaborator } from '$lib/types/index.js';
	import X from 'lucide-svelte/icons/x';
	import UserMinus from 'lucide-svelte/icons/user-minus';
	import Search from 'lucide-svelte/icons/search';
	import { showToast } from '$lib/stores/toast.js';

	interface UserResult {
		id: number;
		displayName: string;
		email: string;
	}

	interface Props {
		noteId: string;
		collaborators: Collaborator[];
		ownerName: string;
		onClose: () => void;
		onUpdate: (collaborators: Collaborator[]) => void;
	}

	const { noteId, collaborators, ownerName, onClose, onUpdate }: Props = $props();

	let searchQuery = $state('');
	let searchResults = $state<UserResult[]>([]);
	let isSearching = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;

	function handleSearch(query: string) {
		clearTimeout(searchTimeout);
		if (!query.trim()) {
			searchResults = [];
			return;
		}
		searchTimeout = setTimeout(async () => {
			isSearching = true;
			try {
				const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
				if (res.ok) {
					const users: UserResult[] = await res.json();
					// Filter out existing collaborators
					const collabIds = new Set(collaborators.map((c) => c.userId));
					searchResults = users.filter((u) => !collabIds.has(u.id));
				}
			} catch {
				// Search failed silently
			} finally {
				isSearching = false;
			}
		}, 300);
	}

	$effect(() => {
		handleSearch(searchQuery);
	});

	async function addCollaborator(user: UserResult) {
		try {
			const res = await fetch(`/api/notes/${noteId}/collaborators`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: user.id })
			});
			if (res.ok) {
				const updated: Collaborator[] = await res.json();
				onUpdate(updated);
				searchQuery = '';
				searchResults = [];
				showToast(`Shared with ${user.displayName || user.email}`, 'success');
			} else {
				const err = await res.json().catch(() => ({ message: 'Failed to share' }));
				showToast(err.message || 'Failed to share', 'error');
			}
		} catch {
			showToast('Failed to share note', 'error');
		}
	}

	async function removeCollaborator(userId: number) {
		try {
			const res = await fetch(`/api/notes/${noteId}/collaborators?userId=${userId}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				const updated = collaborators.filter((c) => c.userId !== userId);
				onUpdate(updated);
			}
		} catch {
			showToast('Failed to remove collaborator', 'error');
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-20 pb-10 animate-[fade-in_150ms_ease-out]"
	onclick={onClose}
	onkeydown={handleKeydown}
	data-testid="share-dialog-overlay"
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="mx-4 w-full max-w-sm rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)] animate-[pop-in_150ms_ease-out]"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		data-testid="share-dialog"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
			<h2 class="text-sm font-semibold text-[var(--text)]">Share note</h2>
			<button
				onclick={onClose}
				class="rounded-sm p-1 hover:bg-[var(--border)]/10"
				title="Close"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<!-- Search input -->
		<div class="relative px-4 pt-3">
			<div class="relative">
				<Search class="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
				<input
					type="text"
					placeholder="Search users..."
					bind:value={searchQuery}
					class="w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] py-2 pl-8 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
					data-testid="share-search-input"
				/>
			</div>

			<!-- Search results dropdown -->
			{#if searchResults.length > 0}
				<ul class="absolute left-4 right-4 z-10 mt-1 max-h-40 overflow-y-auto rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]" data-testid="share-search-results">
					{#each searchResults as user}
						<li>
							<button
								type="button"
								class="w-full px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--primary)]/10"
								onclick={() => addCollaborator(user)}
								data-testid="share-user-result"
							>
								<span class="font-medium">{user.displayName || 'User'}</span>
								{#if user.email}
									<span class="ml-1 text-[var(--text-muted)]">{user.email}</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Current collaborators -->
		<div class="px-4 py-3">
			<p class="mb-2 text-xs font-semibold text-[var(--text-muted)]">People with access</p>
			<ul class="space-y-1">
				<!-- Owner -->
				<li class="flex items-center justify-between rounded-sm px-2 py-1.5">
					<span class="text-sm text-[var(--text)]">
						{ownerName}
						<span class="text-xs text-[var(--text-muted)]">(Owner)</span>
					</span>
				</li>
				<!-- Collaborators -->
				{#each collaborators as collab}
					<li class="flex items-center justify-between rounded-sm px-2 py-1.5 hover:bg-[var(--border)]/10" data-testid="share-collaborator">
						<span class="text-sm text-[var(--text)]">
							{collab.displayName || collab.email}
						</span>
						<button
							onclick={() => removeCollaborator(collab.userId)}
							class="rounded-sm p-1 text-[var(--text-muted)] hover:text-[var(--destructive)]"
							title="Remove"
							data-testid="remove-collaborator-btn"
						>
							<UserMinus class="h-4 w-4" />
						</button>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</div>
