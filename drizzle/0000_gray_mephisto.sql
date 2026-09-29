CREATE TABLE `study_records` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`event` text NOT NULL,
	`updated` integer NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
