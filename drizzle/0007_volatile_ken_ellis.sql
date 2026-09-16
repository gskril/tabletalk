CREATE TABLE `visit_checkins` (
	`user_id` text NOT NULL,
	`checkin_id` text NOT NULL,
	`venue_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `checkin_id`),
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_visit_checkins_user_venue` ON `visit_checkins` (`user_id`,`venue_id`);