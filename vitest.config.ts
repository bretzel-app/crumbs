import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, 'src/lib'),
			'$app/environment': path.resolve(__dirname, 'src/lib/__mocks__/app-environment.ts')
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
		setupFiles: ['src/lib/__mocks__/svelte-runes.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov', 'json-summary'],
			reportsDirectory: './coverage/unit',
			include: ['src/lib/**/*.ts'],
			exclude: ['src/lib/**/*.test.ts', 'src/lib/types/**']
		}
	}
});
