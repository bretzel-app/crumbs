<script lang="ts">
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let loading = $state(false);

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
			} else {
				const data = await res.json();
				errorMsg = data.message || 'Invalid email or password';
			}
		} catch {
			errorMsg = 'Connection error';
		} finally {
			loading = false;
		}
	}
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
</div>
