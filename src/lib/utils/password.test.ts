import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { generatePassword, PASSWORD_ALPHABET } from './password.js';

const LOWERCASE = /[abcdefghijkmnpqrstuvwxyz]/;
const UPPERCASE = /[ABCDEFGHJKLMNPQRSTUVWXYZ]/;
const DIGIT = /[23456789]/;
const SYMBOL = /[!@#$%^&*]/;

/** Visually ambiguous characters the charset deliberately excludes. */
const AMBIGUOUS = ['0', 'O', 'o', '1', 'l', 'I'];

describe('PASSWORD_ALPHABET', () => {
	it('is exactly 64 distinct characters', () => {
		// 256 % 64 === 0, which is what keeps nanoid's masking exactly uniform.
		// A charset edit that breaks this silently biases every password.
		expect(PASSWORD_ALPHABET).toHaveLength(64);
		expect(new Set(PASSWORD_ALPHABET).size).toBe(64);
	});

	it('excludes every visually ambiguous character', () => {
		for (const char of AMBIGUOUS) {
			expect(PASSWORD_ALPHABET.includes(char), char).toBe(false);
		}
	});
});

describe('generatePassword', () => {
	it('returns a 20-character password by default', () => {
		expect(generatePassword()).toHaveLength(20);
	});

	it('honours an explicit length', () => {
		expect(generatePassword(8)).toHaveLength(8);
		expect(generatePassword(32)).toHaveLength(32);
		expect(generatePassword(64)).toHaveLength(64);
	});

	it('always includes at least one character from each of the four groups', () => {
		// Not a statistical bet: the function only ever returns a class-complete
		// password or throws, so every sample must pass.
		for (let i = 0; i < 20; i++) {
			const password = generatePassword();
			expect(password, `sample ${i}`).toMatch(LOWERCASE);
			expect(password, `sample ${i}`).toMatch(UPPERCASE);
			expect(password, `sample ${i}`).toMatch(DIGIT);
			expect(password, `sample ${i}`).toMatch(SYMBOL);
		}
	});

	it('never emits a visually ambiguous character', () => {
		// 0 O o 1 l I survive neither being read aloud nor retyped.
		for (let i = 0; i < 20; i++) {
			const password = generatePassword();
			for (const char of AMBIGUOUS) {
				expect(password.includes(char), `sample ${i} contains ${char}`).toBe(false);
			}
		}
	});

	it('draws only from the pinned 64-character charset', () => {
		const charset = /^[abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*]+$/;
		for (let i = 0; i < 20; i++) {
			expect(generatePassword(), `sample ${i}`).toMatch(charset);
		}
	});

	it('produces a different password on each call', () => {
		const passwords = new Set(Array.from({ length: 20 }, () => generatePassword()));
		expect(passwords.size).toBe(20);
	});

	it('throws below the 8-character server minimum', () => {
		expect(() => generatePassword(7)).toThrow(/8/);
		expect(() => generatePassword(0)).toThrow(/8/);
		expect(() => generatePassword(-1)).toThrow(/8/);
	});

	it('does not use Math.random anywhere in the module', () => {
		// Randomness must come from nanoid's CSPRNG, not Math.random.
		const source = readFileSync(new URL('./password.ts', import.meta.url), 'utf8');
		expect(source).not.toContain('Math.random');
	});
});
