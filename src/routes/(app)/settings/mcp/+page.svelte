<script lang="ts">
	import { Key, Copy, Trash2, Plus, Check } from 'lucide-svelte';

	interface ApiKey {
		id: string;
		name: string;
		keyPrefix: string;
		createdAt: string;
		lastUsedAt: string | null;
	}

	// API Keys state
	let keys = $state<ApiKey[]>([]);
	let newKeyName = $state('');
	let createdKey = $state<string | null>(null);
	let keyLoading = $state(false);
	let keyErrorMsg = $state('');
	let copiedKey = $state(false);
	let copiedJson = $state(false);
	let copiedPrompt = $state(false);
	let deleteConfirmId = $state<string | null>(null);

	let baseUrl = $derived(typeof window !== 'undefined' ? window.location.origin : 'https://your-crumbs-instance');
	let activeApiKey = $derived(createdKey ?? 'YOUR_API_KEY');

	let mcpJsonConfig = $derived(`{
  "mcpServers": {
    "crumbs": {
      "type": "streamable-http",
      "url": "${baseUrl}/api/mcp",
      "headers": {
        "Authorization": "Bearer ${activeApiKey}"
      }
    }
  }
}`);

	let llmInstallPrompt = $derived(`Install the Crumbs MCP server with the following configuration:

- Type: Streamable HTTP
- URL: ${baseUrl}/api/mcp
- Authentication: Bearer token in the Authorization header
- API Key: ${activeApiKey}

Add this to your MCP client settings (e.g. Claude Code's .claude/settings.json or Claude Desktop's config):

${mcpJsonConfig}`);

	function formatDateShort(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	async function loadKeys() {
		const res = await fetch('/api/settings/api-keys');
		if (res.ok) keys = await res.json();
	}

	async function createKey(e: Event) {
		e.preventDefault();
		if (!newKeyName.trim()) return;

		keyLoading = true;
		keyErrorMsg = '';
		createdKey = null;

		try {
			const res = await fetch('/api/settings/api-keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newKeyName.trim() })
			});

			if (res.ok) {
				const data = await res.json();
				createdKey = data.key;
				newKeyName = '';
				await loadKeys();
			} else {
				const data = await res.json();
				keyErrorMsg = data.error || 'Failed to create key';
			}
		} catch {
			keyErrorMsg = 'Connection error';
		} finally {
			keyLoading = false;
		}
	}

	async function deleteKey(id: string) {
		try {
			const res = await fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
			if (res.ok) {
				deleteConfirmId = null;
				await loadKeys();
			}
		} catch {
			keyErrorMsg = 'Failed to delete key';
		}
	}

	async function copyToClipboard(text: string, target: 'key' | 'json' | 'prompt') {
		await navigator.clipboard.writeText(text);
		if (target === 'key') { copiedKey = true; setTimeout(() => (copiedKey = false), 2000); }
		if (target === 'json') { copiedJson = true; setTimeout(() => (copiedJson = false), 2000); }
		if (target === 'prompt') { copiedPrompt = true; setTimeout(() => (copiedPrompt = false), 2000); }
	}

	$effect(() => {
		loadKeys();
	});
</script>

<!-- API Keys -->
<section class="mb-6 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
	<div class="mb-4 flex items-center gap-2">
		<Key size={16} class="text-[var(--primary)]" />
		<h2 class="text-lg font-semibold text-[var(--text)]">API Keys</h2>
	</div>
	<p class="mb-4 text-xs text-[var(--text-muted)]">
		API keys allow external tools (like Claude Code) to access your notes via the MCP protocol.
	</p>

	<!-- Create Key Form -->
	<form onsubmit={createKey} class="mb-6 flex gap-2">
		<input
			type="text"
			bind:value={newKeyName}
			placeholder="Key name (e.g. Claude Code)"
			class="flex-1 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
			data-testid="api-key-name-input"
		/>
		<button
			type="submit"
			disabled={keyLoading || !newKeyName.trim()}
			class="flex items-center gap-1 rounded-sm bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
			data-testid="create-api-key-btn"
		>
			<Plus size={14} />
			Create
		</button>
	</form>

	{#if keyErrorMsg}
		<div class="mb-4 rounded-sm border border-[var(--error-border)] bg-[var(--error-bg)] p-3 text-sm text-[var(--error-text)]">
			{keyErrorMsg}
		</div>
	{/if}

	<!-- Newly Created Key (show once) -->
	{#if createdKey}
		<div class="mb-4 rounded-sm border border-[var(--success-border,#a3b18a)] bg-[var(--success-bg,#f0f4e8)] p-4" data-testid="created-key-display">
			<p class="mb-2 text-xs font-semibold text-[var(--success-text,#3a5a40)]">
				Key created! Copy it now — it won't be shown again.
			</p>
			<div class="flex items-center gap-2">
				<code class="flex-1 overflow-x-auto rounded-sm bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text)]" data-testid="created-key-value">
					{createdKey}
				</code>
				<button
					onclick={() => copyToClipboard(createdKey!, 'key')}
					class="flex items-center gap-1 rounded-sm border border-[var(--border-subtle)] px-3 py-2 text-xs transition-colors hover:border-[var(--primary)]"
					data-testid="copy-key-btn"
				>
					{#if copiedKey}
						<Check size={14} class="text-[var(--success-text,#3a5a40)]" />
					{:else}
						<Copy size={14} />
					{/if}
				</button>
			</div>
		</div>
	{/if}

	<!-- Key List -->
	{#if keys.length === 0}
		<p class="py-4 text-center text-xs text-[var(--text-muted)]">No API keys yet.</p>
	{:else}
		<div class="space-y-2" data-testid="api-keys-list">
			{#each keys as key (key.id)}
				<div class="flex items-center justify-between rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3" data-testid="api-key-item">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-[var(--text)]" data-testid="api-key-name">{key.name}</span>
							<code class="text-xs text-[var(--text-muted)]">{key.keyPrefix}...</code>
						</div>
						<div class="mt-1 text-xs text-[var(--text-muted)]">
							Created {formatDateShort(key.createdAt)}
							{#if key.lastUsedAt}
								· Last used {formatDateShort(key.lastUsedAt)}
							{/if}
						</div>
					</div>
					<div class="ml-4">
						{#if deleteConfirmId === key.id}
							<div class="flex items-center gap-1">
								<button
									onclick={() => deleteKey(key.id)}
									class="rounded-sm bg-[var(--destructive)] px-3 py-1 text-xs text-white transition-colors hover:opacity-80"
									data-testid="confirm-delete-btn"
								>
									Delete
								</button>
								<button
									onclick={() => (deleteConfirmId = null)}
									class="rounded-sm border border-[var(--border-subtle)] px-3 py-1 text-xs transition-colors hover:border-[var(--primary)]"
								>
									Cancel
								</button>
							</div>
						{:else}
							<button
								onclick={() => (deleteConfirmId = key.id)}
								class="rounded-sm p-2 text-[var(--text-muted)] transition-colors hover:text-[var(--destructive)]"
								data-testid="delete-api-key-btn"
								title="Revoke key"
							>
								<Trash2 size={14} />
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<!-- MCP Config Help -->
<section class="rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
	<h2 class="mb-4 text-lg font-semibold text-[var(--text)]">Client Configuration</h2>
	<p class="mb-3 text-xs text-[var(--text-muted)]">
		Add this to your MCP client config (e.g. Claude Code settings):
	</p>
	<div class="relative">
		<pre class="overflow-x-auto rounded-sm bg-[var(--bg-base)] p-3 pr-10 text-xs text-[var(--text)]">{mcpJsonConfig}</pre>
		<button
			onclick={() => copyToClipboard(mcpJsonConfig, 'json')}
			class="absolute right-2 top-2 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]"
			title="Copy JSON config"
		>
			{#if copiedJson}
				<Check size={12} class="text-[var(--success-text,#3a5a40)]" />
			{:else}
				<Copy size={12} />
			{/if}
		</button>
	</div>
	{#if createdKey}
		<p class="mt-1 text-xs text-[var(--success-text,#3a5a40)]">
			Config updated with your new API key.
		</p>
	{/if}

	<!-- LLM Installation Prompt -->
	<div class="mt-6 border-t border-[var(--border-subtle)] pt-4">
		<h3 class="mb-2 text-sm font-semibold text-[var(--text)]">LLM Installation Prompt</h3>
		<p class="mb-3 text-xs text-[var(--text-muted)]">
			Copy this prompt and paste it into your LLM to set up the MCP connection:
		</p>
		<div class="relative">
			<pre class="overflow-x-auto rounded-sm bg-[var(--bg-base)] p-3 pr-10 text-xs text-[var(--text)] whitespace-pre-wrap">{llmInstallPrompt}</pre>
			<button
				onclick={() => copyToClipboard(llmInstallPrompt, 'prompt')}
				class="absolute right-2 top-2 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--text)]"
				title="Copy LLM prompt"
			>
				{#if copiedPrompt}
					<Check size={12} class="text-[var(--success-text,#3a5a40)]" />
				{:else}
					<Copy size={12} />
				{/if}
			</button>
		</div>
		{#if createdKey}
			<p class="mt-1 text-xs text-[var(--success-text,#3a5a40)]">
				Prompt updated with your new API key.
			</p>
		{/if}
	</div>
</section>
