CREATE TABLE `bookmarks` (
	`user_id` text NOT NULL,
	`venue_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `venue_id`),
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`user_id` text NOT NULL,
	`target_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `target_id`),
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`user_id` text NOT NULL,
	`review_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `review_id`),
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `list_items` (
	`list_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`list_id`, `venue_id`),
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`color` text DEFAULT '#f5ce4f' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`hash` text PRIMARY KEY NOT NULL,
	`verifier` text NOT NULL,
	`expires_at` integer NOT NULL,
	`return_to` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#ed563d' NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`external_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_external` ON `profiles` (`external_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`rating` real NOT NULL,
	`body` text NOT NULL,
	`dish` text DEFAULT '' NOT NULL,
	`visited_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_user_venue` ON `reviews` (`user_id`,`venue_id`);--> statement-breakpoint
CREATE INDEX `reviews_venue` ON `reviews` (`venue_id`);--> statement-breakpoint
CREATE INDEX `reviews_created` ON `reviews` (`created_at`);--> statement-breakpoint
CREATE TABLE `saved_lists` (
	`user_id` text NOT NULL,
	`list_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `list_id`),
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text,
	`token_expires_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cuisine` text NOT NULL,
	`neighborhood` text NOT NULL,
	`address` text NOT NULL,
	`price` integer NOT NULL,
	`lat` real,
	`lng` real,
	`image` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`source` text DEFAULT 'demo' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`user_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`visited_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `venue_id`),
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
