CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`first_seen` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_email` ON `customers` (`email`);--> statement-breakpoint
CREATE INDEX `customers_phone` ON `customers` (`phone`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `passes` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`token` text NOT NULL,
	`code` text NOT NULL,
	`stamps` integer DEFAULT 0 NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`visits_used` integer DEFAULT 0 NOT NULL,
	`rewards_earned` integer DEFAULT 0 NOT NULL,
	`rewards_redeemed` integer DEFAULT 0 NOT NULL,
	`valid_until` text,
	`status` text DEFAULT 'active' NOT NULL,
	`visit_count` integer DEFAULT 0 NOT NULL,
	`last_visit_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passes_token` ON `passes` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `passes_code` ON `passes` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `passes_program_customer` ON `passes` (`program_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `passes_customer` ON `passes` (`customer_id`);--> statement-breakpoint
CREATE TABLE `programs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`reward_text` text DEFAULT '' NOT NULL,
	`stamp_goal` integer,
	`points_per_visit` integer,
	`points_per_amount` integer,
	`rewards` text DEFAULT '[]' NOT NULL,
	`visit_limit` integer,
	`valid_days` integer,
	`expires_at` text,
	`bg_color` text NOT NULL,
	`text_color` text NOT NULL,
	`logo_key` text,
	`strip_key` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `programs_slug` ON `programs` (`slug`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`pass_id` text NOT NULL,
	`program_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`location_id` text,
	`staff_user_id` text NOT NULL,
	`staff_email` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`earned` integer DEFAULT 0 NOT NULL,
	`redeemed` integer DEFAULT 0 NOT NULL,
	`note` text,
	`undone_at` text,
	`undone_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visits_pass` ON `visits` (`pass_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `visits_created` ON `visits` (`created_at`);