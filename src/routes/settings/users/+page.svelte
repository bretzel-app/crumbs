<script lang="ts">
	import type { User } from '$lib/types/index.js';
	import PasswordStrengthMeter from '$lib/components/PasswordStrengthMeter.svelte';

	let { data } = $props();
	let users = $state<User[]>(data.users);

	// Create user form
	let newEmail = $state('');
	let newDisplayName = $state('');
	let newPassword = $state('');
	let newRole = $state<'admin' | 'user'>('user');
	let createMsg = $state('');
	let createError = $state(false);

	async function createUser() {
		createMsg = '';
		if (!newEmail || !newPassword) {
			createMsg = 'Email and password are required';
			createError = true;
			return;
		}
		if (newPassword.length < 8) {
			createMsg = 'Password must be at least 8 characters';
			createError = true;
			return;
		}
		try {
			const res = await fetch('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: newEmail,
					displayName: newDisplayName || newEmail.split('@')[0],
					password: newPassword,
					role: newRole
				})
			});
			if (res.ok) {
				const user = await res.json();
				users = [...users, user];
				newEmail = '';
				newDisplayName = '';
				newPassword = '';
				newRole = 'user';
				createMsg = 'User created';
				createError = false;
			} else {
				const d = await res.json();
				createMsg = d.message || 'Failed to create user';
				createError = true;
			}
		} catch {
			createMsg = 'Connection error';
			createError = true;
		}
	}

	async function deleteUser(userId: number) {
		if (!confirm('Are you sure you want to delete this user and all their data?')) return;
		try {
			const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
			if (res.ok) {
				users = users.filter((u) => u.id !== userId);
			}
		} catch {
			// ignore
		}
	}

	async function toggleRole(user: User) {
		const newRoleValue = user.role === 'admin' ? 'user' : 'admin';
		try {
			const res = await fetch(`/api/admin/users/${user.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: newRoleValue })
			});
			if (res.ok) {
				users = users.map((u) => (u.id === user.id ? { ...u, role: newRoleValue } : u));
			}
		} catch {
			// ignore
		}
	}
</script>

<svelte:head>
	<title>User Management - KeepNotes</title>
</svelte:head>

<div class="mx-auto max-w-2xl py-8">
	<div class="mb-8 flex items-center gap-4">
		<a href="/settings" class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">← Settings</a>
		<h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">User Management</h1>
	</div>

	<!-- Create User -->
	<section class="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h2 class="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">Create User</h2>

		{#if createMsg}
			<div class="mb-4 rounded p-3 text-sm {createError ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'}">
				{createMsg}
			</div>
		{/if}

		<div class="space-y-3">
			<input
				type="email"
				bind:value={newEmail}
				placeholder="Email"
				class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
			/>
			<input
				type="text"
				bind:value={newDisplayName}
				placeholder="Display name (optional)"
				class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
			/>
			<input
				type="password"
				bind:value={newPassword}
				placeholder="Password (min 8 characters)"
				class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
			/>
			<PasswordStrengthMeter password={newPassword} />
			<select
				bind:value={newRole}
				class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
			>
				<option value="user">User</option>
				<option value="admin">Admin</option>
			</select>
			<button
				onclick={createUser}
				class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
			>
				Create user
			</button>
		</div>
	</section>

	<!-- User List -->
	<section class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h2 class="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">Users ({users.length})</h2>

		<div class="space-y-3">
			{#each users as user (user.id)}
				<div class="flex items-center justify-between rounded-lg border border-gray-100 p-4 dark:border-gray-700">
					<div>
						<p class="font-medium text-gray-800 dark:text-gray-100">
							{user.displayName || user.email}
							{#if user.role === 'admin'}
								<span class="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">admin</span>
							{/if}
						</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
					</div>
					<div class="flex items-center gap-2">
						<button
							onclick={() => toggleRole(user)}
							class="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
							title={user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
						>
							{user.role === 'admin' ? 'Make user' : 'Make admin'}
						</button>
						{#if user.id !== data.user?.id}
							<button
								onclick={() => deleteUser(user.id)}
								class="rounded px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
							>
								Delete
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>
