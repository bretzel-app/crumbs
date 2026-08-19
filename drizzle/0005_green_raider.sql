ALTER TABLE `users` ADD `password_login_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `users` SET `password_login_enabled` = 1 WHERE `auth_provider` = 'password';