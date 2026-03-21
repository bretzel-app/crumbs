/**
 * Polyfill Svelte 5 runes for Vitest.
 * The Svelte compiler transforms these in .svelte and .svelte.ts files,
 * but Vitest doesn't run the Svelte compiler, so we provide plain-JS stubs.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

(globalThis as any).$state = <T>(initial: T): T => initial;
(globalThis as any).$derived = <T>(value: T): T => value;
(globalThis as any).$effect = (_fn: () => void): void => {};
(globalThis as any).$props = (): any => ({});
