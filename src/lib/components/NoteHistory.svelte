<script lang="ts">
	import type { NoteVersionSummary, NoteVersion } from '$lib/types/index.js';
	import X from 'lucide-svelte/icons/x';
	import RotateCcw from 'lucide-svelte/icons/rotate-ccw';
	import Clock from 'lucide-svelte/icons/clock';
	import { showToast } from '$lib/stores/toast.js';

	interface Props {
		noteId: string;
		onClose: () => void;
		onRestored: () => void;
	}

	const { noteId, onClose, onRestored }: Props = $props();

	let versions = $state<NoteVersionSummary[]>([]);
	let selectedVersion = $state<NoteVersion | null>(null);
	let isLoading = $state(true);
	let isLoadingVersion = $state(false);
	let isRestoring = $state(false);
	let showConfirm = $state(false);

	$effect(() => {
		void loadVersions();
	});

	async function loadVersions() {
		isLoading = true;
		try {
			const res = await fetch(`/api/notes/${noteId}/versions`);
			if (res.ok) {
				versions = await res.json();
			}
		} catch {
			// failed silently
		} finally {
			isLoading = false;
		}
	}

	async function selectVersion(versionId: string) {
		isLoadingVersion = true;
		selectedVersion = null;
		try {
			const res = await fetch(`/api/notes/${noteId}/versions/${versionId}`);
			if (res.ok) {
				selectedVersion = await res.json();
			}
		} catch {
			// failed silently
		} finally {
			isLoadingVersion = false;
		}
	}

	async function restoreVersion() {
		if (!selectedVersion) return;
		isRestoring = true;
		try {
			const res = await fetch(
				`/api/notes/${noteId}/versions/${selectedVersion.id}/restore`,
				{ method: 'POST' }
			);
			if (res.ok) {
				showToast('Version restored successfully', 'success');
				onRestored();
				onClose();
			} else {
				showToast('Failed to restore version', 'error');
			}
		} catch {
			showToast('Failed to restore version', 'error');
		} finally {
			isRestoring = false;
			showConfirm = false;
		}
	}

	function formatDate(date: Date | string): string {
		const d = new Date(date);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
		if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
		if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-20 pb-10"
	onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
	onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
	data-testid="history-overlay"
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="mx-4 flex w-full max-w-2xl flex-col overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--card-shadow)]"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		data-testid="history-panel"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
			<div class="flex items-center gap-2">
				<Clock class="h-4 w-4 text-[var(--text-muted)]" />
				<h2 class="text-sm font-semibold text-[var(--text)]">Version History</h2>
			</div>
			<button
				onclick={onClose}
				class="rounded-sm p-1 hover:bg-[var(--border)]/10"
				title="Close history"
				data-testid="close-history-btn"
			>
				<X class="h-4 w-4 text-[var(--text-muted)]" />
			</button>
		</div>

		<div class="flex min-h-0 flex-1">
			<!-- Version list -->
			<div class="w-56 flex-none border-r border-[var(--border-subtle)] overflow-y-auto max-h-[60vh]">
				{#if isLoading}
					<div class="flex items-center justify-center py-8 text-sm text-[var(--text-muted)]">
						Loading…
					</div>
				{:else if versions.length === 0}
					<div class="flex items-center justify-center py-8 text-sm text-[var(--text-muted)]">
						No history yet
					</div>
				{:else}
					<ul class="divide-y divide-[var(--border-subtle)]">
						{#each versions as v (v.id)}
							<li>
								<button
									class="w-full px-3 py-3 text-left hover:bg-[var(--border)]/10 transition-colors {selectedVersion?.id === v.id ? 'bg-[var(--primary)]/10 border-l-2 border-[var(--primary)]' : ''}"
									onclick={() => selectVersion(v.id)}
									data-testid="version-item"
								>
									<div class="flex items-center justify-between gap-1">
										<span class="text-xs font-semibold text-[var(--primary)]">v{v.version}</span>
									</div>
									<div class="mt-0.5 text-xs text-[var(--text-muted)]">{formatDate(v.createdAt)}</div>
									{#if v.title}
										<div class="mt-1 truncate text-xs font-medium text-[var(--text)]">{v.title}</div>
									{/if}
									{#if v.contentPreview}
										<div class="mt-0.5 line-clamp-2 text-xs text-[var(--text-muted)]">{v.contentPreview}</div>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- Version preview -->
			<div class="flex min-w-0 flex-1 flex-col">
				{#if isLoadingVersion}
					<div class="flex items-center justify-center py-8 text-sm text-[var(--text-muted)]">
						Loading…
					</div>
				{:else if selectedVersion}
					<div class="flex flex-1 flex-col overflow-y-auto max-h-[60vh]">
						<div class="flex-1 overflow-y-auto px-4 py-3">
							{#if selectedVersion.title}
								<h3 class="mb-2 text-base font-semibold text-[var(--text)]">{selectedVersion.title}</h3>
							{/if}
							<pre class="whitespace-pre-wrap text-sm text-[var(--text)] font-[inherit]">{selectedVersion.content || '(empty)'}</pre>
						</div>

						<!-- Restore footer -->
						<div class="border-t border-[var(--border-subtle)] px-4 py-3">
							{#if showConfirm}
								<div class="flex flex-col gap-2">
									<p class="text-xs text-[var(--text-muted)]">
										This will replace the current note. The current version will be saved as a snapshot.
									</p>
									<div class="flex gap-2">
										<button
											onclick={restoreVersion}
											disabled={isRestoring}
											class="flex items-center gap-1.5 rounded-sm border border-[var(--destructive)] bg-[var(--destructive)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
											data-testid="confirm-restore-btn"
										>
											<RotateCcw class="h-3.5 w-3.5" />
											{isRestoring ? 'Restoring…' : 'Confirm Restore'}
										</button>
										<button
											onclick={() => (showConfirm = false)}
											class="rounded-sm border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--border)]/10"
										>
											Cancel
										</button>
									</div>
								</div>
							{:else}
								<button
									onclick={() => (showConfirm = true)}
									class="flex items-center gap-1.5 rounded-sm border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
									data-testid="restore-btn"
								>
									<RotateCcw class="h-3.5 w-3.5" />
									Restore this version
								</button>
							{/if}
						</div>
					</div>
				{:else}
					<div class="flex items-center justify-center py-8 text-sm text-[var(--text-muted)]">
						Select a version to preview
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
