CREATE TABLE `catalog_cache` (
	`environment` text PRIMARY KEY NOT NULL,
	`location_ids` text DEFAULT '[]' NOT NULL,
	`synced_at` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`lease_token` text DEFAULT '' NOT NULL
);
