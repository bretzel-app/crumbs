import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import istanbul from 'vite-plugin-istanbul';
import { defineConfig, type Plugin } from 'vite';

/**
 * The e2e suite drives `vite preview` and its API helpers reuse keep-alive
 * sockets. Node's http server drops an idle keep-alive socket after 5s by
 * default, and a request that lands on a socket the server is closing at that
 * instant fails client-side with "socket hang up" (seen on main CI in
 * public-sharing.spec). Keeping the server's idle timeout well above any
 * client's means the client always closes first, so the race cannot happen.
 */
function previewKeepAlive(): Plugin {
	return {
		name: 'crumbs:preview-keep-alive',
		configurePreviewServer({ httpServer }) {
			// HTTP/2 servers have no keep-alive timeout; preview is HTTP/1 here.
			if ('keepAliveTimeout' in httpServer) {
				httpServer.keepAliveTimeout = 65_000;
				// Node requires headersTimeout to exceed keepAliveTimeout.
				httpServer.headersTimeout = 66_000;
			}
		}
	};
}

export default defineConfig({
	build: {
		chunkSizeWarningLimit: 850
	},
	plugins: [
		previewKeepAlive(),
		tailwindcss(),
		sveltekit(),
		...(process.env.VITE_COVERAGE === 'true'
			? [
					istanbul({
						include: 'src/**/*',
						exclude: ['node_modules', 'tests/', '**/*.test.ts'],
						extension: ['.ts', '.svelte'],
						requireEnv: true,
						forceBuildInstrument: true
					})
				]
			: []),
		SvelteKitPWA({
			scope: '/',
			buildBase: '/',
			registerType: 'autoUpdate',
			manifest: {
				name: 'Crumbs by Bretzel',
				short_name: 'Crumbs',
				description: 'A self-hostable, offline-first note-taking app by Bretzel',
				start_url: '/',
				display: 'standalone',
				background_color: '#f0e6d3',
				theme_color: '#C8860A',
				icons: [
					{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
				]
			},
			workbox: {
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
				navigateFallback: null,
				runtimeCaching: [
					{
						urlPattern: ({ request }) => request.mode === 'navigate',
						handler: 'NetworkFirst',
						options: {
							cacheName: 'pages-cache',
							networkTimeoutSeconds: 3,
							expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }
						}
					},
					{
						urlPattern: ({ request, url }) =>
							request.method === 'GET' &&
							/\/api\/notes\/.*\/attachments\?attachmentId=/.test(url.href),
						handler: 'CacheFirst',
						options: {
							cacheName: 'attachment-cache',
							expiration: { maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 }
						}
					},
					{
						urlPattern: ({ request, url }) =>
							request.method === 'GET' && /\/api\//.test(url.pathname),
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							expiration: { maxEntries: 50, maxAgeSeconds: 300 }
						}
					},
					{
						urlPattern: /^https?:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }
						}
					}
				]
			}
		})
	]
});
