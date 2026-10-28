CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`subject` text,
	`grade` text,
	`semester` text,
	`description` text,
	`file_name` text NOT NULL,
	`stored_file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_stored_file_name_unique` ON `documents` (`stored_file_name`);
--> statement-breakpoint
CREATE INDEX `documents_user_category_idx` ON `documents` (`user_id`, `category`);
