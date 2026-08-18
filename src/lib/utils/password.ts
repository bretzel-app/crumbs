import { customAlphabet } from 'nanoid';

// The excluded characters — 0 O o 1 l I — are visually ambiguous, so a generated
// password survives being read aloud or retyped from a screenshot.
const LOWERCASE = 'abcdefghijkmnpqrstuvwxyz'; // no l, no o
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, no O
const DIGITS = '23456789'; // no 0, no 1
const SYMBOLS = '!@#$%^&*';

/**
 * Pinned at exactly 64 characters. 64 is a power of two, so nanoid's masking
 * takes its exactly-uniform fast path (256 % 64 === 0) and no character is
 * favoured over another. At 64 symbols a 20-character password carries 120 bits
 * of entropy — 119.79 once conditioned on the class-completeness retry below.
 * Do not change the size without understanding both consequences.
 */
export const PASSWORD_ALPHABET = LOWERCASE + UPPERCASE + DIGITS + SYMBOLS;

const GROUPS = [LOWERCASE, UPPERCASE, DIGITS, SYMBOLS];

/** The server rejects anything shorter. */
const MIN_LENGTH = 8;

/**
 * Per-attempt failure is 13.5% at the default length of 20 and 61.9% at the
 * minimum of 8, so exhausting the cap has probability ~1e-87 and ~1e-21
 * respectively — unreachable in practice. The bound exists so a future charset
 * edit cannot turn the retry into an infinite loop.
 */
const MAX_ATTEMPTS = 100;

const randomString = customAlphabet(PASSWORD_ALPHABET);

function containsAnyOf(password: string, group: string): boolean {
	return [...password].some((char) => group.includes(char));
}

/**
 * Generates a random password containing at least one lowercase letter, one
 * uppercase letter, one digit and one symbol.
 *
 * A password missing a group is discarded whole and regenerated, which keeps the
 * result uniform over exactly the set of valid passwords. Forcing characters
 * into chosen positions and shuffling would need its own unbiased index source.
 */
export function generatePassword(length = 20): string {
	if (length < MIN_LENGTH) {
		throw new Error(`Password length must be at least ${MIN_LENGTH}, got ${length}`);
	}

	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const password = randomString(length);
		if (GROUPS.every((group) => containsAnyOf(password, group))) return password;
	}

	throw new Error(
		`Failed to generate a password with all character groups after ${MAX_ATTEMPTS} attempts`
	);
}
