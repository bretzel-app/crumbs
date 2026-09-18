<script lang="ts">
	import { page } from '$app/stores';

	let appVersion = $derived($page.data.appVersion);
</script>

<svelte:head>
	<title>About - Crumbs</title>
</svelte:head>

<div class="space-y-8">
	<div class="flex items-center gap-3">
		<h2 class="text-xl font-bold text-[var(--text)]">About Crumbs</h2>
		<span
			class="rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]"
		>
			v{appVersion}
		</span>
	</div>

	<section
		class="space-y-2 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--card-shadow)]"
	>
		<h3 class="text-sm font-bold text-[var(--text)]">What is Crumbs?</h3>
		<p class="text-sm leading-relaxed text-[var(--text-muted)]">
			Crumbs is a self-hostable note-taking app. Like breadcrumbs left along a trail, Crumbs
			captures the small scattered thoughts, ideas, and notes you leave behind as you go — so you
			can always find your way back to them.
		</p>
	</section>

	<section
		class="space-y-2 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--card-shadow)]"
	>
		<h3 class="text-sm font-bold text-[var(--text)]">Bretzel App Universe</h3>
		<p class="text-sm leading-relaxed text-[var(--text-muted)]">
			Crumbs is part of the
			<a
				href="https://bretzel.app"
				target="_blank"
				rel="noopener noreferrer"
				class="text-[var(--primary)] underline hover:text-[var(--primary-hover)]">bretzel.app</a
			> universe.
		</p>
	</section>

	<section
		class="space-y-2 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--card-shadow)]"
	>
		<h3 class="text-sm font-bold text-[var(--text)]">Open Source</h3>
		<p class="text-sm leading-relaxed text-[var(--text-muted)]">
			Crumbs is licensed under the MIT License. Source code is available on
			<a
				href="https://github.com/bretzel-app/crumbs/"
				target="_blank"
				rel="noopener noreferrer"
				class="text-[var(--primary)] underline hover:text-[var(--primary-hover)]">GitHub</a
			>.
		</p>
	</section>

	<section
		class="space-y-2 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--card-shadow)]"
	>
		<h3 class="text-sm font-bold text-[var(--text)]">Feedback</h3>
		<p class="text-sm leading-relaxed text-[var(--text-muted)]">
			Feedback is welcome! Please open an issue on
			<a
				href="https://github.com/bretzel-app/crumbs/issues"
				target="_blank"
				rel="noopener noreferrer"
				class="text-[var(--primary)] underline hover:text-[var(--primary-hover)]">GitHub Issues</a
			>.
		</p>
	</section>

	<section
		class="space-y-2 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--card-shadow)]"
	>
		<h3 class="text-sm font-bold text-[var(--text)]">Tech Stack</h3>
		<p class="text-sm leading-relaxed text-[var(--text-muted)]">
			Built with SvelteKit, SQLite, and Drizzle ORM. Offline-first PWA with CRDT-based sync.
		</p>
	</section>
</div>
