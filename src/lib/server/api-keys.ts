import { db } from './db/index.js';
import { apiKeys, users } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './db/schema.js';

type Db = BetterSQLite3Database<typeof schema>;

const PREFIX = 'crumbs_';

function hashKey(key: string): string {
	return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(
	name: string,
	userId: number,
	database: Db = db
): { id: string; key: string; name: string; keyPrefix: string } {
	const id = uuidv4();
	const raw = randomBytes(32).toString('hex');
	const key = `${PREFIX}${raw}`;
	const keyHash = hashKey(key);
	const keyPrefix = key.slice(0, 12);

	database
		.insert(apiKeys)
		.values({
			id,
			userId,
			name,
			keyHash,
			keyPrefix,
			createdAt: new Date()
		})
		.run();

	return { id, key, name, keyPrefix };
}

export function validateApiKey(
	key: string,
	database: Db = db
): { valid: boolean; userId: number | null } {
	if (!key || !key.startsWith(PREFIX)) return { valid: false, userId: null };

	const keyHash = hashKey(key);
	const row = database.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).get();
	if (!row) return { valid: false, userId: null };

	database
		.update(apiKeys)
		.set({ lastUsedAt: new Date() })
		.where(eq(apiKeys.id, row.id))
		.run();

	return { valid: true, userId: row.userId };
}

export function getUserForApiKey(
	userId: number,
	database: Db = db
): App.Locals['user'] | null {
	const user = database
		.select({
			id: users.id,
			email: users.email,
			displayName: users.displayName,
			role: users.role
		})
		.from(users)
		.where(eq(users.id, userId))
		.get();

	return user ? (user as App.Locals['user']) : null;
}

export function listApiKeys(userId: number, database: Db = db) {
	return database
		.select({
			id: apiKeys.id,
			name: apiKeys.name,
			keyPrefix: apiKeys.keyPrefix,
			createdAt: apiKeys.createdAt,
			lastUsedAt: apiKeys.lastUsedAt
		})
		.from(apiKeys)
		.where(eq(apiKeys.userId, userId))
		.all();
}

export function deleteApiKey(id: string, userId: number, database: Db = db): boolean {
	const existing = database
		.select()
		.from(apiKeys)
		.where(eq(apiKeys.id, id))
		.get();

	if (!existing || existing.userId !== userId) return false;

	const result = database.delete(apiKeys).where(eq(apiKeys.id, id)).run();
	return result.changes > 0;
}
