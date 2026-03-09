<script lang="ts">
	import PasswordStrengthMeter from '$lib/components/PasswordStrengthMeter.svelte';

	type SessionInfo = {
		id: string;
		createdAt: string | null;
		userAgent: string | null;
		ip: string | null;
		lastUsedAt: string | null;
		expiresAt: string;
		isCurrent: boolean;
	};

	let { data } = $props();

	// Profile state
	let displayName = $state(data.user?.displayName || '');
	let email = $state(data.user?.email || '');
	let profileMsg = $state('');
	let profileError = $state(false);

	// Password state
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmNewPassword = $state('');
	let passwordMsg = $state('');
	let passwordError = $state(false);

	// Sessions state
	let activeSessions = $state<SessionInfo[]>([]);
	let sessionsLoaded = $state(false);

	async function loadSessions() {
		try {
			const res = await fetch('/api/auth/sessions');
			if (res.ok) activeSessions = await res.json();
			sessionsLoaded = true;
		} catch {
			// ignore
		}
	}

	async function revokeSession(sessionId: string) {
		try {
			await fetch('/api/auth/sessions', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId })
			});
			activeSessions = activeSessions.filter((s) => s.id !== sessionId);
		} catch {
			// ignore
		}
	}

	async function revokeAllOtherSessions() {
		try {
			await fetch('/api/auth/sessions', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ all: true })
			});
			activeSessions = activeSessions.filter((s) => s.isCurrent);
		} catch {
			// ignore
		}
	}

	function formatAgent(ua: string | null): string {
		if (!ua) return 'Unknown';
		if (ua.includes('Firefox')) return 'Firefox';
		if (ua.includes('Edg/')) return 'Edge';
		if (ua.includes('Chrome')) return 'Chrome';
		if (ua.includes('Safari')) return 'Safari';
		return ua.slice(0, 40);
	}

	function formatDate(d: string | null): string {
		if (!d) return 'Unknown';
		return new Date(d).toLocaleString();
	}

	async function saveProfile() {
		profileMsg = '';
		try {
			const res = await fetch('/api/auth/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ displayName, email })
			});
			if (res.ok) {
				profileMsg = 'Profile updated';
				profileError = false;
			} else {
				const d = await res.json();
				profileMsg = d.message || 'Failed to update';
				profileError = true;
			}
		} catch {
			profileMsg = 'Connection error';
			profileError = true;
		}
	}

	async function changePassword() {
		passwordMsg = '';
		if (newPassword.length < 8) {
			passwordMsg = 'Password must be at least 8 characters';
			passwordError = true;
			return;
		}
		if (newPassword !== confirmNewPassword) {
			passwordMsg = 'Passwords do not match';
			passwordError = true;
			return;
		}
		try {
			const res = await fetch('/api/auth/password', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword })
			});
			if (res.ok) {
				passwordMsg = 'Password changed';
				passwordError = false;
				currentPassword = '';
				newPassword = '';
				confirmNewPassword = '';
			} else {
				const d = await res.json();
				passwordMsg = d.message || 'Failed to change password';
				passwordError = true;
			}
		} catch {
			passwordMsg = 'Connection error';
			passwordError = true;
		}
	}

	$effect(() => {
		loadSessions();
	});
</script>

<!-- Profile -->
<section class="mb-6 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
	<h2 class="mb-4 text-lg font-semibold text-[var(--text)]">Profile</h2>

	{#if profileMsg}
		<div class="mb-4 rounded-sm border p-3 text-sm {profileError ? 'border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-text)]' : 'border-[var(--success-bg)] bg-[var(--success-bg)] text-[var(--success-text)]'}">
			{profileMsg}
		</div>
	{/if}

	<div class="space-y-4">
		<div>
			<label for="display-name" class="mb-1 block text-sm font-medium text-[var(--text)]">Display Name</label>
			<input
				id="display-name"
				type="text"
				bind:value={displayName}
				class="w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
			/>
		</div>
		<div>
			<label for="email" class="mb-1 block text-sm font-medium text-[var(--text)]">Email</label>
			<input
				id="email"
				type="email"
				bind:value={email}
				class="w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
			/>
		</div>
		<button
			onclick={saveProfile}
			class="rounded-sm bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)]"
		>
			Save profile
		</button>
	</div>
</section>

<!-- Change Password -->
<section class="mb-6 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
	<h2 class="mb-4 text-lg font-semibold text-[var(--text)]">Change Password</h2>

	{#if passwordMsg}
		<div class="mb-4 rounded-sm border p-3 text-sm {passwordError ? 'border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-text)]' : 'border-[var(--success-bg)] bg-[var(--success-bg)] text-[var(--success-text)]'}">
			{passwordMsg}
		</div>
	{/if}

	<div class="space-y-4">
		<input
			type="password"
			bind:value={currentPassword}
			placeholder="Current password"
			class="w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
		/>
		<input
			type="password"
			bind:value={newPassword}
			placeholder="New password (min 8 characters)"
			class="w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
		/>
		<PasswordStrengthMeter password={newPassword} />
		<input
			type="password"
			bind:value={confirmNewPassword}
			placeholder="Confirm new password"
			class="w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
		/>
		<button
			onclick={changePassword}
			class="rounded-sm bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)]"
		>
			Change password
		</button>
	</div>
</section>

<!-- Active Sessions -->
<section class="rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-lg font-semibold text-[var(--text)]">Active Sessions</h2>
		{#if activeSessions.length > 1}
			<button
				onclick={revokeAllOtherSessions}
				class="text-xs text-[var(--destructive)] hover:underline"
			>
				Log out everywhere else
			</button>
		{/if}
	</div>

	{#if !sessionsLoaded}
		<p class="text-sm text-[var(--text-muted)]">Loading sessions...</p>
	{:else if activeSessions.length === 0}
		<p class="text-sm text-[var(--text-muted)]">No active sessions</p>
	{:else}
		<div class="space-y-3">
			{#each activeSessions as session (session.id)}
				<div class="flex items-center justify-between rounded-sm border border-[var(--border-subtle)] p-3">
					<div>
						<p class="text-sm font-medium text-[var(--text)]">
							{formatAgent(session.userAgent)}
							{#if session.isCurrent}
								<span class="ml-2 rounded-sm bg-[var(--success-bg)] px-2 py-0.5 text-xs text-[var(--success-text)]">current</span>
							{/if}
						</p>
						<p class="text-xs text-[var(--text-muted)]">
							{session.ip || 'Unknown IP'} · Last active {formatDate(session.lastUsedAt)}
						</p>
					</div>
					{#if !session.isCurrent}
						<button
							onclick={() => revokeSession(session.id)}
							class="rounded-sm px-3 py-1 text-xs text-[var(--destructive)] hover:bg-[var(--error-bg)]"
						>
							Revoke
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</section>
