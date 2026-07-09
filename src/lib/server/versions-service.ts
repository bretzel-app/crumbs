import type { Db } from './db/index.js';
import { noteVersions, notes } from './db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { NoteVersion, NoteVersionSummary, NoteColor } from '$lib/types/index.js';

const MAX_VERSIONS_PER_NOTE = 50;
const CONTENT_PREVIEW_LENGTH = 80;

type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type SnapshotDb = Db | Transaction;

/**
 * Create a snapshot of a note's current state.
 * Only called when content actually changed. Prunes snapshots beyond MAX_VERSIONS_PER_NOTE.
 */
export function createSnapshot(
db: SnapshotDb,
noteId: string,
snapshot: {
version: number;
title: string;
content: string;
checklistMode: boolean;
color: string;
}
): void {
const now = new Date();

db.insert(noteVersions)
.values({
id: uuidv4(),
noteId,
version: snapshot.version,
title: snapshot.title,
content: snapshot.content,
checklistMode: snapshot.checklistMode,
color: snapshot.color,
createdAt: now
})
.onConflictDoNothing()
.run();

// Prune: keep only the most recent MAX_VERSIONS_PER_NOTE snapshots
const allVersions = db
.select({ id: noteVersions.id })
.from(noteVersions)
.where(eq(noteVersions.noteId, noteId))
.orderBy(desc(noteVersions.version))
.all();

if (allVersions.length > MAX_VERSIONS_PER_NOTE) {
const toDelete = allVersions.slice(MAX_VERSIONS_PER_NOTE).map((v) => v.id);
for (const id of toDelete) {
db.delete(noteVersions).where(eq(noteVersions.id, id)).run();
}
}
}

/**
 * List version summaries for a note, newest first.
 */
export function listVersions(db: Db, noteId: string): NoteVersionSummary[] {
const rows = db
.select()
.from(noteVersions)
.where(eq(noteVersions.noteId, noteId))
.orderBy(desc(noteVersions.version))
.all();

return rows.map((row) => ({
id: row.id,
noteId: row.noteId,
version: row.version,
title: row.title,
contentPreview: row.content.slice(0, CONTENT_PREVIEW_LENGTH),
createdAt: row.createdAt
}));
}

/**
 * Get the full content of a specific version.
 */
export function getVersion(db: Db, noteId: string, versionId: string): NoteVersion | null {
const row = db
.select()
.from(noteVersions)
.where(and(eq(noteVersions.id, versionId), eq(noteVersions.noteId, noteId)))
.get();

if (!row) return null;

return {
id: row.id,
noteId: row.noteId,
version: row.version,
title: row.title,
content: row.content,
checklistMode: row.checklistMode,
color: row.color as NoteColor,
createdAt: row.createdAt
};
}

/**
 * Snapshot the current state of a note (used before a restore).
 */
export function snapshotCurrentNote(db: Db, noteId: string): boolean {
const currentNote = db.select().from(notes).where(eq(notes.id, noteId)).get();
if (!currentNote) return false;

createSnapshot(db, noteId, {
version: currentNote.version,
title: currentNote.title,
content: currentNote.content,
checklistMode: currentNote.checklistMode,
color: currentNote.color
});

return true;
}
