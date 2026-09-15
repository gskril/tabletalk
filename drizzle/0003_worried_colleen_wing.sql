CREATE TABLE `passport_syncs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'syncing' NOT NULL,
	`synced_at` integer,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`lease_token` text DEFAULT '' NOT NULL,
	`complete` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
