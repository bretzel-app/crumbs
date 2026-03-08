<script lang="ts">
	import { goto } from '$app/navigation';
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

	let displayName = $state(data.user?.displayName || '');
	let email = $state(data.user?.email || '');
	let profileMsg = $state('');
	let profileError = $state(false);

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmNewPassword = $state('');
	let passwordMsg = $state('');
	let passwordError = $state(false);

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

	$effect(() => {
		loadSessions();
	});

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
</script>

<svelte:head>
	<title>Settings - KeepNotes</title>
</svelte:head>

<div class="mx-auto max-w-2xl py-8">
	<h1 class="mb-8 text-2xl font-bold text-gray-800 dark:text-gray-100">Settings</h1>

	<!-- Profile -->
	<section class="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h2 class="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">Profile</h2>

		{#if profileMsg}
			<div class="mb-4 rounded p-3 text-sm {profileError ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'}">
				{profileMsg}
			</div>
		{/if}

		<div class="space-y-4">
			<div>
				<label for="display-name" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Display Name</label>
				<input
					id="display-name"
					type="text"
					bind:value={displayName}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
				/>
			</div>
			<div>
				<label for="email" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
				/>
			</div>
			<button
				onclick={saveProfile}
				class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
			>
				Save profile
			</button>
		</div>
	</section>

	<!-- Change Password -->
	<section class="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h2 class="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">Change Password</h2>

		{#if passwordMsg}
			<div class="mb-4 rounded p-3 text-sm {passwordError ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'}">
				{passwordMsg}
			</div>
		{/if}

		<div class="space-y-4">
			<input
				type="password"
				bind:value={currentPassword}
				placeholder="Current password"
				class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
			/>
			<input
				type="password"
				bind:value={newPassword}
				placeholder="New password (min 8 characters)"
				class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
			/>
			<PasswordStrengthMeter password={newPassword} />
			<input
				type="password"
				bind:value={confirmNewPassword}
				placeholder="Confirm new password"
				class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
			/>
			<button
				onclick={changePassword}
				class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
			>
				Change password
			</button>
		</div>
	</section>

	<!-- Active Sessions -->
	<section class="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">Active Sessions</h2>
			{#if activeSessions.length > 1}
				<button
					onclick={revokeAllOtherSessions}
					class="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
				>
					Log out everywhere else
				</button>
			{/if}
		</div>

		{#if !sessionsLoaded}
			<p class="text-sm text-gray-500">Loading sessions...</p>
		{:else if activeSessions.length === 0}
			<p class="text-sm text-gray-500">No active sessions</p>
		{:else}
			<div class="space-y-3">
				{#each activeSessions as session (session.id)}
					<div class="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-700">
						<div>
							<p class="text-sm font-medium text-gray-800 dark:text-gray-100">
								{formatAgent(session.userAgent)}
								{#if session.isCurrent}
									<span class="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-200">current</span>
								{/if}
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								{session.ip || 'Unknown IP'} · Last active {formatDate(session.lastUsedAt)}
							</p>
						</div>
						{#if !session.isCurrent}
							<button
								onclick={() => revokeSession(session.id)}
								class="rounded px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
							>
								Revoke
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Admin: User Management Link -->
	{#if data.user?.role === 'admin'}
		<section class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
			<h2 class="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">Administration</h2>
			<a
				href="/settings/users"
				class="text-sm text-amber-600 hover:text-amber-700 hover:underline dark:text-amber-400"
			>
				Manage users →
			</a>
		</section>
	{/if}
</div>
