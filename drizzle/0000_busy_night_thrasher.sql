CREATE TABLE `workspace_entries` (
	`owner` text NOT NULL,
	`path` text NOT NULL,
	`kind` text NOT NULL,
	`data` text,
	`object_key` text,
	`size` integer NOT NULL,
	`modified` integer NOT NULL,
	`revision` text NOT NULL,
	PRIMARY KEY(`owner`, `path`)
);
