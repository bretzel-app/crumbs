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

<!-- Create User -->
	<section class="mb-6 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
		<h2 class="mb-4 text-lg font-semibold text-[var(--text)]">Create User</h2>

		{#if createMsg}
			<div class="mb-4 rounded-sm border p-3 text-sm {createError ? 'border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-text)]' : 'border-[var(--success-bg)] bg-[var(--success-bg)] text-[var(--success-text)]'}">
				{createMsg}
			</div>
		{/if}

		<div class="space-y-3">
			<input
				type="email"
				bind:value={newEmail}
				placeholder="Email"
				class="w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
			/>
			<input
				type="text"
				bind:value={newDisplayName}
				placeholder="Display name (optional)"
				class="w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
			/>
			<input
				type="password"
				bind:value={newPassword}
				placeholder="Password (min 8 characters)"
				class="w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
			/>
			<PasswordStrengthMeter password={newPassword} />
			<select
				bind:value={newRole}
				class="w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
			>
				<option value="user">User</option>
				<option value="admin">Admin</option>
			</select>
			<button
				onclick={createUser}
				class="rounded-sm bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)]"
			>
				Create user
			</button>
		</div>
	</section>

	<!-- User List -->
	<section class="rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
		<h2 class="mb-4 text-lg font-semibold text-[var(--text)]">Users ({users.length})</h2>

		<div class="space-y-3">
			{#each users as user (user.id)}
				<div class="flex items-center justify-between rounded-sm border border-[var(--border-subtle)] p-4">
					<div>
						<p class="font-medium text-[var(--text)]">
							{user.displayName || user.email}
							{#if user.role === 'admin'}
								<span class="ml-2 rounded-sm bg-[var(--primary)]/15 px-2 py-0.5 text-xs text-[var(--primary)]">admin</span>
							{/if}
						</p>
						<p class="text-sm text-[var(--text-muted)]">{user.email}</p>
					</div>
					<div class="flex items-center gap-2">
						<button
							onclick={() => toggleRole(user)}
							class="rounded-sm px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--border-subtle)]/50"
							title={user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
						>
							{user.role === 'admin' ? 'Make user' : 'Make admin'}
						</button>
						{#if user.id !== data.user?.id}
							<button
								onclick={() => deleteUser(user.id)}
								class="rounded-sm px-3 py-1 text-xs text-[var(--destructive)] hover:bg-[var(--error-bg)]"
							>
								Delete
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>
