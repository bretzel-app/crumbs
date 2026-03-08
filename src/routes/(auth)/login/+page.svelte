<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let loading = $state(false);

	// Check for OAuth error in URL
	const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
	if (urlParams?.get('error') === 'no_account') {
		errorMsg = 'No account found for this email. Ask your admin for an invite.';
	}

	async function handleLogin(e: Event) {
		e.preventDefault();
		errorMsg = '';
		loading = true;

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			if (res.ok) {
				goto('/');
			} else if (res.status === 429) {
				const d = await res.json();
				errorMsg = d.error || 'Too many attempts. Please try again later.';
			} else {
				const d = await res.json();
				errorMsg = d.message || 'Invalid email or password';
			}
		} catch {
			errorMsg = 'Connection error';
		} finally {
			loading = false;
		}
	}

	const providers = data.providers ?? [];
</script>

<svelte:head>
	<title>Login - Crumbs</title>
</svelte:head>

<div class="w-full max-w-sm rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-8 shadow-[var(--card-shadow)]">
	<div class="mb-6 text-center">
		<img src="/favicon.svg" alt="Crumbs" class="mx-auto h-12 w-12" />
		<h1 class="font-['Press_Start_2P'] text-xl text-[var(--primary)]">Crumbs</h1>
		<p class="mt-2 text-sm text-[var(--text-muted)]">Sign in to continue</p>
	</div>

	<form onsubmit={handleLogin}>
		{#if errorMsg}
			<div class="mb-4 rounded-sm border border-[var(--error-border)] bg-[var(--error-bg)] p-3 text-sm text-[var(--error-text)]" data-testid="error-message">
				{errorMsg}
			</div>
		{/if}

		<input
			type="email"
			bind:value={email}
			placeholder="Email"
			class="mb-3 w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
			data-testid="email-input"
			required
		/>

		<input
			type="password"
			bind:value={password}
			placeholder="Password"
			class="mb-4 w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
			data-testid="password-input"
			required
		/>

		<button
			type="submit"
			disabled={loading}
			class="w-full rounded-sm bg-[var(--primary)] py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
			data-testid="login-btn"
		>
			{loading ? 'Signing in...' : 'Sign in'}
		</button>
	</form>

	{#if providers.length > 0}
		<div class="my-6 flex items-center gap-3">
			<div class="h-px flex-1 bg-[var(--border-subtle)]"></div>
			<span class="text-xs text-[var(--text-muted)]">or continue with</span>
			<div class="h-px flex-1 bg-[var(--border-subtle)]"></div>
		</div>

		<div class="space-y-2">
			{#each providers as provider (provider.id)}
				<a
					href="/api/auth/oauth/{provider.id}"
					class="flex w-full items-center justify-center gap-2 rounded-sm border border-[var(--border-subtle)] px-4 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--bg-base)]"
					data-testid="oauth-{provider.id}-btn"
				>
					{#if provider.id === 'google'}
						<svg class="h-5 w-5" viewBox="0 0 24 24">
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
						</svg>
					{:else if provider.id === 'github'}
						<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
						</svg>
					{:else}
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
						</svg>
					{/if}
					{provider.name}
				</a>
			{/each}
		</div>
	{/if}
</div>
