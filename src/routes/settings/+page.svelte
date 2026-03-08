<script lang="ts">
	import { goto } from '$app/navigation';

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
