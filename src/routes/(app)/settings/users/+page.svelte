<script lang="ts">
	import type { User } from '$lib/types/index.js';
	import PasswordStrengthMeter from '$lib/components/PasswordStrengthMeter.svelte';
	import { canResetPassword, passwordResetBlockedReason } from '$lib/utils/auth-methods.js';
	import { generatePassword } from '$lib/utils/password.js';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let users = $state<User[]>(data.users);

	// Create user form
	let newEmail = $state('');
	let newDisplayName = $state('');
	let newPassword = $state('');
	let newRole = $state<'admin' | 'user'>('user');
	let oauthOnly = $state(false);
	let createMsg = $state('');
	let createError = $state(false);

	/**
	 * One row's password-reset state.
	 *
	 * The generated plaintext lives here and nowhere else — never localStorage,
	 * sessionStorage, IndexedDB, a sync payload or a log — so navigating away is
	 * enough to lose it. State is per row rather than shared because two rows'
	 * outcomes would otherwise overwrite each other, and a password destroyed that
	 * way is unrecoverable.
	 */
	type ResetState = {
		inFlight: boolean;
		/** Revealed plaintext. Set on success and on an unconfirmed outcome. */
		password: string | null;
		/** Row message. Always rendered *alongside* `password`, never instead of it. */
		message: string | null;
		copyStatus: string | null;
		/**
		 * Reason the server refused, kept even after the message is dismissed. This
		 * list snapshots `authProvider` at page load and never refetches, so a row can
		 * still look eligible after the account moved to OAuth; without this the
		 * control would stay available and invite the same failure forever.
		 */
		serverReason: string | null;
	};

	const IDLE_RESET: ResetState = {
		inFlight: false,
		password: null,
		message: null,
		copyStatus: null,
		serverReason: null
	};

	const SELF_RESET_REASON = 'Change your own password in Profile.';

	/**
	 * The request left the device but no answer came back, so the server may well
	 * have stored this password. Revealing it anyway is deliberate: it is the only
	 * copy that exists, and dropping it could leave the account holding a credential
	 * nobody knows.
	 */
	const UNCONFIRMED_MESSAGE =
		'Could not confirm the reset. This password may or may not have been applied. Keep it — if the user cannot sign in, reset again once you are back online.';

	/**
	 * Definite, not hedged: the service worker caches only `GET /api/*`, so a PATCH
	 * issued while offline never leaves the browser and nothing can have changed.
	 */
	const OFFLINE_MESSAGE = "You're offline — nothing was changed. Try again when reconnected.";

	let resets = $state<Record<number, ResetState>>({});
	let announcement = $state('');
	const resetButtons: Record<number, HTMLButtonElement | null> = {};

	function userLabel(user: User): string {
		return user.displayName || user.email;
	}

	/**
	 * Updates the live region's text. The region itself is rendered empty from the
	 * first paint and never inserted alongside its content — a region added to the
	 * DOM together with its text is not reliably announced, least of all by
	 * TalkBack.
	 */
	function announce(text: string) {
		announcement = text;
	}

	/** Why this row's password cannot be reset, or null when it can. */
	function resetBlockedReason(user: User): string | null {
		// Takes precedence over eligibility: an admin changes their own password in
		// the profile flow, which verifies the current one.
		if (user.id === data.user?.id) return SELF_RESET_REASON;

		const serverReason = resets[user.id]?.serverReason;
		if (serverReason) return serverReason;

		if (!canResetPassword(user)) {
			// auth-methods guarantees a non-empty reason whenever the check fails; the
			// ?? only satisfies the nullable return type, as on the API route.
			return passwordResetBlockedReason(user) ?? 'Password login is not available for this account.';
		}
		return null;
	}

	/**
	 * How one row's control presents itself. `unavailable` is expressed with
	 * `aria-disabled`, never the `disabled` attribute: a disabled button leaves the
	 * tab order, so a keyboard or screen-reader user loses the element they just
	 * activated, and a `title` tooltip explains nothing on a touch screen.
	 */
	function resetControl(user: User): {
		reason: string | null;
		inFlight: boolean;
		unavailable: boolean;
	} {
		const state = resets[user.id];
		const reason = resetBlockedReason(user);
		const inFlight = state?.inFlight === true;
		return {
			reason,
			inFlight,
			unavailable: reason !== null || inFlight || state?.password != null
		};
	}

	/** Merges a partial update into one row's state, leaving untouched fields alone. */
	function patchReset(userId: number, patch: Partial<ResetState>) {
		resets[userId] = { ...IDLE_RESET, ...resets[userId], ...patch };
	}

	function revealUnconfirmed(user: User, password: string) {
		patchReset(user.id, { inFlight: false, password, message: UNCONFIRMED_MESSAGE });
		announce(
			`Could not confirm the password reset for ${userLabel(user)}. The generated password is shown in their row — keep it.`
		);
	}

	async function resetUserPassword(user: User) {
		// The control stays focusable while unavailable, so activation is refused
		// here instead of by the browser.
		if (resetControl(user).unavailable) return;

		// Checked before the request, so the offline outcome is reported as the
		// certainty it is rather than as a lost response.
		if (navigator.onLine === false) {
			patchReset(user.id, { message: OFFLINE_MESSAGE, copyStatus: null });
			announce(`${userLabel(user)}: ${OFFLINE_MESSAGE}`);
			return;
		}

		const password = generatePassword();
		patchReset(user.id, { inFlight: true, message: null, copyStatus: null });

		try {
			const res = await fetch(`/api/admin/users/${user.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ newPassword: password })
			});

			if (res.ok) {
				patchReset(user.id, { inFlight: false, password, message: null });
				announce(
					`New password generated for ${userLabel(user)}. It is shown in their row — copy it now, it cannot be shown again.`
				);
				return;
			}

			if (res.status === 404) {
				users = users.filter((u) => u.id !== user.id);
				// No account, no credential: drop the row's plaintext with the row.
				delete resets[user.id];
				announce(
					`${userLabel(user)} no longer exists. The row was removed and no password was set.`
				);
				return;
			}

			const body = await res.json().catch(() => ({}));
			const message = typeof body.message === 'string' && body.message ? body.message : null;
			if (message !== null && res.status < 500) {
				// A refusal the server states outright: nothing was stored, so no
				// password is revealed and the reason sticks to the control.
				patchReset(user.id, { inFlight: false, message, serverReason: message });
				announce(`Password reset failed for ${userLabel(user)}. ${message}`);
				return;
			}

			// A status without a readable reason says nothing about what the server did.
			revealUnconfirmed(user, password);
		} catch {
			// The response was lost, not refused — see UNCONFIRMED_MESSAGE.
			revealUnconfirmed(user, password);
		}
	}

	async function copyPassword(user: User) {
		const password = resets[user.id]?.password;
		if (!password) return;
		try {
			// Absent outside a secure context, which a LAN-IP HTTP deployment is not,
			// so the failure below has to be a working fallback rather than a dead end.
			await navigator.clipboard.writeText(password);
			patchReset(user.id, { copyStatus: 'Copied to clipboard.' });
			announce(`Password for ${userLabel(user)} copied to clipboard.`);
		} catch {
			patchReset(user.id, {
				copyStatus: 'Could not copy automatically — select the password and copy it by hand.'
			});
			announce(
				`Could not copy the password for ${userLabel(user)}. Select it in their row and copy it by hand.`
			);
		}
	}

	function dismissReset(user: User) {
		const serverReason = resets[user.id]?.serverReason ?? null;
		// A server refusal explains the control's state, which outlives the message
		// being dismissed here.
		if (serverReason) resets[user.id] = { ...IDLE_RESET, serverReason };
		else delete resets[user.id];
		announce(`Password reset message for ${userLabel(user)} cleared.`);
		// Never drop the admin on <body>: give the row's control the focus back.
		resetButtons[user.id]?.focus();
	}

	async function createUser() {
		createMsg = '';
		if (!newEmail) {
			createMsg = 'Email is required';
			createError = true;
			return;
		}
		if (!oauthOnly && !newPassword) {
			createMsg = 'Password is required (or enable OAuth-only)';
			createError = true;
			return;
		}
		if (!oauthOnly && newPassword.length < 8) {
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
					password: oauthOnly ? undefined : newPassword,
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
				oauthOnly = false;
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
				delete resets[userId];
				createMsg = 'User deleted';
				createError = false;
			} else {
				const d = await res.json().catch(() => ({}));
				createMsg = d.message || 'Failed to delete user';
				createError = true;
			}
		} catch {
			createMsg = 'Connection error';
			createError = true;
		}
	}

	async function revokeSessions(user: User) {
		try {
			const res = await fetch(`/api/admin/users/${user.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ revokeSessions: true })
			});
			if (res.ok) {
				createMsg = `All sessions revoked for ${user.displayName || user.email}`;
				createError = false;
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
			<label class="flex items-center gap-2 text-sm text-[var(--text)]">
				<input type="checkbox" bind:checked={oauthOnly} />
				OAuth-only (no password)
			</label>
			{#if !oauthOnly}
				<input
					type="password"
					bind:value={newPassword}
					placeholder="Password (min 8 characters)"
					class="w-full rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
				/>
				<PasswordStrengthMeter password={newPassword} />
			{/if}
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

		<!-- Rendered empty on first paint; only its text is ever replaced, so both
		     reveals and per-row failures are announced from a region assistive tech
		     has already been watching. -->
		<p
			role="status"
			aria-live="polite"
			data-testid="reset-password-live"
			class="sr-only"
		>{announcement}</p>

		<div class="space-y-3">
			{#each users as user (user.id)}
				{@const reset = resets[user.id]}
				{@const control = resetControl(user)}
				<div
					class="flex flex-col gap-3 rounded-sm border border-[var(--border-subtle)] p-4"
					data-testid="user-row-{user.id}"
				>
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div class="min-w-0">
							<p class="truncate font-medium text-[var(--text)]">
								{user.displayName || user.email}
								{#if user.role === 'admin'}
									<span class="ml-2 rounded-sm bg-[var(--primary)]/15 px-2 py-0.5 text-xs text-[var(--primary)]">admin</span>
								{/if}
							</p>
							<p class="truncate text-sm text-[var(--text-muted)]">{user.email}</p>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<button
								onclick={() => toggleRole(user)}
								class="rounded-sm px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--border-subtle)]/50"
								title={user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
							>
								{user.role === 'admin' ? 'Make user' : 'Make admin'}
							</button>
							<!-- Offered on every row, the admin's own included: a control that
							     vanishes is the confusion this replaces. -->
							<button
								bind:this={resetButtons[user.id]}
								onclick={() => resetUserPassword(user)}
								data-testid="reset-password-btn-{user.id}"
								aria-disabled={control.unavailable}
								aria-describedby={control.reason ? `reset-password-reason-${user.id}` : undefined}
								class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border px-3 text-xs transition-colors duration-150 ease-out {control.unavailable
									? 'cursor-not-allowed border-dashed border-[var(--border-subtle)] text-[var(--text-muted)]'
									: 'border-[var(--border-subtle)] text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--hover-wash)]/10'}"
							>
								{control.inFlight ? 'Resetting…' : 'Reset password'}
							</button>
							{#if user.id !== data.user?.id}
								<button
									onclick={() => revokeSessions(user)}
									class="rounded-sm px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--border-subtle)]/50"
									title="Force logout"
								>
									Revoke
								</button>
								<button
									onclick={() => deleteUser(user.id)}
									data-testid="delete-user-btn-{user.id}"
									class="rounded-sm px-3 py-1 text-xs text-[var(--destructive)] hover:bg-[var(--error-bg)]"
								>
									Delete
								</button>
							{/if}
						</div>
					</div>

					{#if control.reason || reset?.message || reset?.password}
						<div class="flex flex-col gap-2">
							{#if control.reason}
								<!-- Visible text, not a tooltip: a title attribute is unreachable
								     by touch, and colour alone explains nothing. -->
								<p
									id="reset-password-reason-{user.id}"
									data-testid="reset-password-reason-{user.id}"
									class="text-xs text-[var(--text-muted)]"
								>{control.reason}</p>
							{/if}

							{#if reset?.message}
								<p
									data-testid="reset-password-error-{user.id}"
									class="rounded-sm border border-[var(--error-border)] bg-[var(--error-bg)] p-2 text-xs text-[var(--error-text)]"
								>{reset.message}</p>
							{/if}

							{#if reset?.password}
								<!-- Rendered independently of the message above, so a failure can
								     never replace a password that is already the account's only
								     credential. -->
								<div class="flex flex-col gap-2 rounded-sm border border-[var(--border)] bg-[var(--bg-base)] p-3 shadow-[var(--card-shadow)]">
									<p class="text-xs text-[var(--text-muted)]">
										New password for {userLabel(user)} — shown once, not stored anywhere.
									</p>
									<code
										data-testid="generated-password-{user.id}"
										class="block break-all select-all text-sm text-[var(--text)]"
									>{reset.password}</code>
								</div>
							{/if}

							{#if reset?.message || reset?.password}
								<!-- 44px targets with a wide gap: dismissing is irreversible, so a
								     mis-tap next to Copy would destroy a live credential. -->
								<div class="flex flex-wrap items-center gap-3">
									{#if reset?.password}
										<button
											onclick={() => copyPassword(user)}
											data-testid="copy-password-btn-{user.id}"
											class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-[var(--border-subtle)] px-3 text-xs text-[var(--text)] transition-colors duration-150 ease-out hover:border-[var(--primary)] hover:bg-[var(--hover-wash)]/10"
										>
											Copy
										</button>
									{/if}
									<button
										onclick={() => dismissReset(user)}
										data-testid="dismiss-password-btn-{user.id}"
										class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-[var(--destructive)] px-3 text-xs text-[var(--destructive)] transition-colors duration-150 ease-out hover:bg-[var(--error-bg)]"
									>
										Dismiss
									</button>
								</div>
							{/if}

							{#if reset?.copyStatus}
								<p
									data-testid="copy-status-{user.id}"
									class="text-xs text-[var(--text-muted)]"
								>{reset.copyStatus}</p>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</section>
