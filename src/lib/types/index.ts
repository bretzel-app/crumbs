export interface Note {
	id: string;
	title: string;
	content: string;
	color: NoteColor;
	pinned: boolean;
	archived: boolean;
	trashed: boolean;
	trashedAt: Date | null;
	checklistMode: boolean;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
	version: number;
	tags?: string[];
	attachments?: Attachment[];
	collaborators?: Collaborator[];
	isOwner?: boolean;
	isShared?: boolean;
}

export interface Collaborator {
	userId: number;
	displayName: string;
	email: string;
	addedAt: Date;
}

export interface NoteCreate {
	title?: string;
	content?: string;
	color?: NoteColor;
	pinned?: boolean;
	checklistMode?: boolean;
}

export interface NoteUpdate {
	title?: string;
	content?: string;
	color?: NoteColor;
	pinned?: boolean;
	archived?: boolean;
	trashed?: boolean;
	checklistMode?: boolean;
	sortOrder?: number;
}

export interface Attachment {
	id: string;
	noteId: string;
	filename: string;
	mimeType: string;
	size: number;
	path: string;
	thumbnailPath?: string | null;
	featured: boolean;
	createdAt: Date;
}

export interface Tag {
	id: number;
	name: string;
}

export interface User {
	id: number;
	email: string;
	displayName: string;
	role: 'admin' | 'user';
	authProvider: string;
	providerId: string | null;
	createdAt: Date;
}

export interface SyncChange {
	noteId: string;
	operation: 'create' | 'update' | 'delete';
	timestamp: Date;
	clientId: string;
	data?: Partial<Note>;
}

export type NoteColor =
	| 'default'
	| 'coral'
	| 'peach'
	| 'sand'
	| 'mint'
	| 'sage'
	| 'fog'
	| 'storm'
	| 'dusk'
	| 'blossom'
	| 'clay'
	| 'chalk';

export type NoteFilter = 'all' | 'archived' | 'trashed';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';
