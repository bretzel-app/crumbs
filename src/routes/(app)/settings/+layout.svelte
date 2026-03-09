<script lang="ts">
	import { page } from '$app/state';
	import { User, Cpu, ShieldCheck } from 'lucide-svelte';

	let { data, children } = $props();
	let pathname = $derived(page.url.pathname);
</script>

<svelte:head>
	<title>Settings - Crumbs</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8">
	<h1 class="mb-6 text-2xl font-bold text-[var(--text)]">Settings</h1>

	<div class="flex flex-col gap-6 md:flex-row">
		<!-- Sidebar nav -->
		<nav class="w-full shrink-0 md:w-48">
			<ul class="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
				<li>
					<a
						href="/settings"
						class="flex items-center gap-2 rounded-sm px-3 py-2 text-sm whitespace-nowrap transition-colors {pathname === '/settings' ? 'bg-[var(--primary)]/15 text-[var(--primary)] font-medium' : 'text-[var(--text)] hover:bg-[var(--bg-base)]'}"
					>
						<User size={16} />
						Profile
					</a>
				</li>
				<li>
					<a
						href="/settings/mcp"
						class="flex items-center gap-2 rounded-sm px-3 py-2 text-sm whitespace-nowrap transition-colors {pathname === '/settings/mcp' ? 'bg-[var(--primary)]/15 text-[var(--primary)] font-medium' : 'text-[var(--text)] hover:bg-[var(--bg-base)]'}"
					>
						<Cpu size={16} />
						MCP Server
					</a>
				</li>
				{#if data.user?.role === 'admin'}
					<li>
						<a
							href="/settings/users"
							class="flex items-center gap-2 rounded-sm px-3 py-2 text-sm whitespace-nowrap transition-colors {pathname === '/settings/users' ? 'bg-[var(--primary)]/15 text-[var(--primary)] font-medium' : 'text-[var(--text)] hover:bg-[var(--bg-base)]'}"
						>
							<ShieldCheck size={16} />
							Users
						</a>
					</li>
				{/if}
			</ul>
		</nav>

		<!-- Content area -->
		<div class="min-w-0 flex-1">
			{@render children()}
		</div>
	</div>
</div>
