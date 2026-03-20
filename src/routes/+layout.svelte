<script lang="ts">
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';
	import { browser } from '$app/environment';
	import { getPreferences } from '$lib/stores/preferences.svelte.js';
	import { applyTheme } from '$lib/utils/theme.svelte.js';

	let { children } = $props();
	let mediaQuery: MediaQueryList | undefined;
	let systemListener: ((e: MediaQueryListEvent) => void) | undefined;

	const prefs = $derived(getPreferences());

	onMount(async () => {
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onRegistered(r: ServiceWorkerRegistration | undefined) {
					console.log('SW Registered:', r);
				},
				onRegisterError(error: Error) {
					console.log('SW registration error', error);
				}
			});
		}
	});

	$effect(() => {
		if (!browser) return;
		const theme = prefs.theme ?? 'system';
		applyTheme(theme);

		// Listen for system preference changes when in system mode
		if (systemListener && mediaQuery) {
			mediaQuery.removeEventListener('change', systemListener);
		}
		if (theme === 'system') {
			mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			systemListener = () => applyTheme('system');
			mediaQuery.addEventListener('change', systemListener);
		}
	});

	onDestroy(() => {
		if (systemListener && mediaQuery) {
			mediaQuery.removeEventListener('change', systemListener);
		}
	});

	const webManifest = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');
</script>

<svelte:head>
	{@html webManifest}
</svelte:head>

{@render children()}
