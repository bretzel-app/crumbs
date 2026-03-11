<script lang="ts">
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import { getPreferences, updatePreference } from '$lib/stores/preferences.svelte.js';
	import type { NoteColor } from '$lib/types/index.js';

	const prefs = $derived(getPreferences());
</script>

<div class="space-y-8">
	<h2 class="text-xl font-bold text-[var(--text)]">Preferences</h2>

	<!-- Default note mode -->
	<div class="space-y-2">
		<span class="block text-sm font-medium text-[var(--text)]">Default note mode</span>
		<div class="flex gap-1" role="group" aria-label="Default note mode">
			<button
				onclick={() => updatePreference('defaultNoteMode', 'richtext')}
				class="rounded-sm border px-4 py-2 text-sm transition-colors {prefs.defaultNoteMode === 'richtext' ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)] font-medium' : 'border-[var(--border-subtle)] text-[var(--text)] hover:border-[var(--primary)]'}"
				data-testid="pref-mode-richtext"
			>
				Rich text
			</button>
			<button
				onclick={() => updatePreference('defaultNoteMode', 'markdown')}
				class="rounded-sm border px-4 py-2 text-sm transition-colors {prefs.defaultNoteMode === 'markdown' ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)] font-medium' : 'border-[var(--border-subtle)] text-[var(--text)] hover:border-[var(--primary)]'}"
				data-testid="pref-mode-markdown"
			>
				Markdown
			</button>
		</div>
	</div>

	<!-- Default note color -->
	<div class="space-y-2">
		<span class="block text-sm font-medium text-[var(--text)]">Default note color</span>
		<ColorPicker
			selected={prefs.defaultNoteColor}
			onSelect={(color: NoteColor) => updatePreference('defaultNoteColor', color)}
		/>
	</div>

	<!-- Hide footer -->
	<div class="flex items-center gap-3">
		<input
			type="checkbox"
			id="hide-footer"
			checked={prefs.hideFooter}
			onchange={() => updatePreference('hideFooter', !prefs.hideFooter)}
			class="h-4 w-4 rounded-sm"
			data-testid="pref-hide-footer"
		/>
		<label for="hide-footer" class="text-sm text-[var(--text)]">Hide footer</label>
	</div>

	<!-- Sidebar default state -->
	<div class="flex items-center gap-3">
		<input
			type="checkbox"
			id="sidebar-default"
			checked={prefs.sidebarDefaultState === 'collapsed'}
			onchange={() => updatePreference('sidebarDefaultState', prefs.sidebarDefaultState === 'collapsed' ? 'open' : 'collapsed')}
			class="h-4 w-4 rounded-sm"
			data-testid="pref-sidebar-default"
		/>
		<label for="sidebar-default" class="text-sm text-[var(--text)]">Start with sidebar collapsed</label>
	</div>

	<!-- Email notifications -->
	<div class="space-y-3">
		<span class="block text-sm font-medium text-[var(--text)]">Email notifications</span>
		<div class="flex items-center gap-3">
			<input
				type="checkbox"
				id="notify-on-share"
				checked={prefs.notifyOnShare}
				onchange={() => updatePreference('notifyOnShare', !prefs.notifyOnShare)}
				class="h-4 w-4 rounded-sm"
				data-testid="pref-notify-on-share"
			/>
			<label for="notify-on-share" class="text-sm text-[var(--text)]">Email me when someone shares a note with me</label>
		</div>
		<div class="flex items-center gap-3">
			<input
				type="checkbox"
				id="notify-on-collab-removed"
				checked={prefs.notifyOnCollabRemoved}
				onchange={() => updatePreference('notifyOnCollabRemoved', !prefs.notifyOnCollabRemoved)}
				class="h-4 w-4 rounded-sm"
				data-testid="pref-notify-on-collab-removed"
			/>
			<label for="notify-on-collab-removed" class="text-sm text-[var(--text)]">Email me when I'm removed from a shared note</label>
		</div>
		<div class="flex items-center gap-3">
			<input
				type="checkbox"
				id="notify-on-note-deleted"
				checked={prefs.notifyOnNoteDeleted}
				onchange={() => updatePreference('notifyOnNoteDeleted', !prefs.notifyOnNoteDeleted)}
				class="h-4 w-4 rounded-sm"
				data-testid="pref-notify-on-note-deleted"
			/>
			<label for="notify-on-note-deleted" class="text-sm text-[var(--text)]">Email me when a shared note I have access to is deleted</label>
		</div>
	</div>
</div>
