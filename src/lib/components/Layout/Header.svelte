<script lang="ts">
	import SearchBar from '../SearchBar.svelte';
	import SyncIndicator from '../SyncIndicator.svelte';
	import Menu from 'lucide-svelte/icons/menu';
	import Search from 'lucide-svelte/icons/search';

	interface Props {
		onMenuToggle: () => void;
		user: { id: number; email: string; displayName: string; role: 'admin' | 'user' } | null;
	}

	let { onMenuToggle, user }: Props = $props();
	let mobileSearchOpen = $state(false);
	let dropdownOpen = $state(false);

	function getInitial(user: Props['user']): string {
		if (!user) return '?';
		if (user.displayName) return user.displayName.charAt(0).toUpperCase();
		if (user.email) return user.email.charAt(0).toUpperCase();
		return '?';
	}

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/login';
	}
</script>

<svelte:window onclick={() => (dropdownOpen = false)} />

<header class="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4">
	{#if mobileSearchOpen}
		<!-- Mobile expanded search -->
		<div class="flex flex-1 items-center gap-2 lg:hidden">
			<SearchBar onClose={() => (mobileSearchOpen = false)} />
		</div>
	{:else}
		<button
			onclick={onMenuToggle}
			class="rounded-sm p-2 hover:bg-[var(--border)]/10"
			aria-label="Toggle sidebar"
		>
			<Menu class="h-6 w-6 text-[var(--text)]" />
		</button>

		<div class="flex items-center gap-2">
			<img src="/favicon.svg" alt="" class="h-8 w-8" />
			<h1 class="font-['Press_Start_2P'] text-lg text-[var(--primary)]">Crumbs</h1>
		</div>

		<!-- Desktop search bar -->
		<div class="mx-4 hidden flex-1 lg:block">
			<SearchBar />
		</div>

		<!-- Mobile search icon -->
		<button
			onclick={() => (mobileSearchOpen = true)}
			class="ml-auto rounded-sm p-2 hover:bg-[var(--border)]/10 lg:hidden"
			aria-label="Search"
		>
			<Search class="h-5 w-5 text-[var(--text)]" />
		</button>

		<div class="flex items-center gap-2">
			<SyncIndicator />

			{#if user}
				<div class="relative">
					<button
						onclick={(e) => { e.stopPropagation(); dropdownOpen = !dropdownOpen; }}
						class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-medium text-white hover:bg-[var(--primary-hover)]"
						aria-label="User menu"
						data-testid="user-menu-btn"
					>
						{getInitial(user)}
					</button>

					{#if dropdownOpen}
						<div class="absolute right-0 top-10 z-50 w-48 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1 shadow-[var(--card-shadow)]">
							<div class="border-b border-[var(--border-subtle)] px-4 py-2">
								<p class="text-sm font-medium text-[var(--text)]">{user.displayName || user.email}</p>
								<p class="text-xs text-[var(--text-muted)]">{user.email}</p>
							</div>
							<a
								href="/settings"
								class="block px-4 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg-base)]"
							>
								Settings
							</a>
							<button
								onclick={handleLogout}
								class="block w-full px-4 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--bg-base)]"
								data-testid="logout-btn"
							>
								Log out
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</header>
