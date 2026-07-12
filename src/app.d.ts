/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/vanillajs" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				id: number;
				email: string;
				displayName: string;
				role: 'admin' | 'user';
			} | null;
		}
		// interface PageData {}
		interface PageState {
			noteEditorOpen?: boolean;
		}
		// interface Platform {}
	}
}

export {};
