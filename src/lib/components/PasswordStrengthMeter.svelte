<script lang="ts">
	import zxcvbn from 'zxcvbn';

	let { password = '' }: { password: string } = $props();

	const result = $derived(password.length > 0 ? zxcvbn(password) : null);

	const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
	const colors = [
		'bg-red-500',
		'bg-orange-500',
		'bg-yellow-500',
		'bg-lime-500',
		'bg-green-500'
	];
</script>

{#if result}
	<div class="mt-1 mb-2" data-testid="password-strength">
		<div class="flex gap-1">
			{#each { length: 4 } as _, i}
				<div
					class="h-1 flex-1 rounded-full transition-colors {i <= result.score
						? colors[result.score]
						: 'bg-gray-200 dark:bg-gray-600'}"
				></div>
			{/each}
		</div>
		<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
			{labels[result.score]}
			{#if result.feedback.warning}
				— {result.feedback.warning}
			{/if}
		</p>
	</div>
{/if}
