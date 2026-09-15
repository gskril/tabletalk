ALTER TABLE `sessions` ADD `refresh_token` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `refresh_lease` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `refresh_lease_until` integer DEFAULT 0 NOT NULL;