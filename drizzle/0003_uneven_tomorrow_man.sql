CREATE TABLE `note_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`checklist_mode` integer DEFAULT false NOT NULL,
	`color` text DEFAULT 'default' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_versions_note_id_idx` ON `note_versions` (`note_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `note_versions_note_id_version_unique` ON `note_versions` (`note_id`,`version`);--> statement-breakpoint
CREATE TABLE `shared_notes` (
	`note_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shared_notes_token_unique` ON `shared_notes` (`token`);