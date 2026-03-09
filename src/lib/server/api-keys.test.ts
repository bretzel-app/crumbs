import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { generateApiKey, validateApiKey, listApiKeys, deleteApiKey } from './api-keys.js';
import { users } from './db/schema.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './db/schema.js';

describe('API Keys', () => {
	let db: BetterSQLite3Database<typeof schema>;
	let userId: number;

	beforeEach(() => {
		({ db } = createTestDb());
		// Create a test user
		db.insert(users)
			.values({ email: 'test@example.com', displayName: 'Test', createdAt: new Date() })
			.run();
		userId = 1;
	});

	describe('generateApiKey', () => {
		it('returns key with crumbs_ prefix', () => {
			const result = generateApiKey('Test Key', userId, db);
			expect(result.key).toMatch(/^crumbs_[a-f0-9]{64}$/);
			expect(result.name).toBe('Test Key');
			expect(result.id).toBeTruthy();
			expect(result.keyPrefix).toBe(result.key.slice(0, 12));
		});

		it('generates unique keys each time', () => {
			const key1 = generateApiKey('Key 1', userId, db);
			const key2 = generateApiKey('Key 2', userId, db);
			expect(key1.key).not.toBe(key2.key);
			expect(key1.id).not.toBe(key2.id);
		});
	});

	describe('validateApiKey', () => {
		it('returns valid with userId for a valid key', () => {
			const { key } = generateApiKey('Test Key', userId, db);
			const result = validateApiKey(key, db);
			expect(result.valid).toBe(true);
			expect(result.userId).toBe(userId);
		});

		it('returns invalid for an invalid key', () => {
			const result = validateApiKey('crumbs_invalid', db);
			expect(result.valid).toBe(false);
			expect(result.userId).toBeNull();
		});

		it('returns invalid for empty string', () => {
			expect(validateApiKey('', db).valid).toBe(false);
		});

		it('returns invalid for key without prefix', () => {
			expect(validateApiKey('no_prefix_here', db).valid).toBe(false);
		});

		it('updates lastUsedAt on validation', () => {
			const { key, id } = generateApiKey('Test Key', userId, db);
			const before = listApiKeys(userId, db).find((k) => k.id === id);
			expect(before?.lastUsedAt).toBeNull();

			validateApiKey(key, db);

			const after = listApiKeys(userId, db).find((k) => k.id === id);
			expect(after?.lastUsedAt).toBeInstanceOf(Date);
		});
	});

	describe('listApiKeys', () => {
		it('returns empty array when no keys exist', () => {
			expect(listApiKeys(userId, db)).toEqual([]);
		});

		it('returns keys without hash', () => {
			generateApiKey('Key 1', userId, db);
			generateApiKey('Key 2', userId, db);

			const keys = listApiKeys(userId, db);
			expect(keys).toHaveLength(2);
			expect(keys[0]).toHaveProperty('name');
			expect(keys[0]).toHaveProperty('keyPrefix');
			expect(keys[0]).toHaveProperty('createdAt');
			expect(keys[0]).not.toHaveProperty('keyHash');
		});

		it('only returns keys for the specified user', () => {
			db.insert(users)
				.values({ email: 'other@example.com', displayName: 'Other', createdAt: new Date() })
				.run();
			const otherUserId = 2;

			generateApiKey('My Key', userId, db);
			generateApiKey('Other Key', otherUserId, db);

			expect(listApiKeys(userId, db)).toHaveLength(1);
			expect(listApiKeys(otherUserId, db)).toHaveLength(1);
		});
	});

	describe('deleteApiKey', () => {
		it('deletes an existing key and returns true', () => {
			const { id, key } = generateApiKey('Test Key', userId, db);
			expect(deleteApiKey(id, userId, db)).toBe(true);
			expect(validateApiKey(key, db).valid).toBe(false);
			expect(listApiKeys(userId, db)).toHaveLength(0);
		});

		it('returns false for non-existent key', () => {
			expect(deleteApiKey('nonexistent', userId, db)).toBe(false);
		});

		it('cannot delete another user\'s key', () => {
			db.insert(users)
				.values({ email: 'other@example.com', displayName: 'Other', createdAt: new Date() })
				.run();
			const otherUserId = 2;

			const { id } = generateApiKey('Other Key', otherUserId, db);
			expect(deleteApiKey(id, userId, db)).toBe(false);
		});
	});
});
