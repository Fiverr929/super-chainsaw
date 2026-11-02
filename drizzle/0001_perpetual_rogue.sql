CREATE TABLE `workspace_account` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`iterations` integer NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "only_one_workspace_account" CHECK("workspace_account"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `workspace_login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
