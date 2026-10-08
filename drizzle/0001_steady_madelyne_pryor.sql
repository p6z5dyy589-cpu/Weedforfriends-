CREATE TABLE `local_events` (
	`id` varchar(36) NOT NULL,
	`company_id` int NOT NULL,
	`subject` varchar(32) NOT NULL,
	`subject_id` varchar(64) NOT NULL,
	`type` varchar(64) NOT NULL,
	`actor_user_id` int NOT NULL,
	`request_id` varchar(64),
	`payload` longtext NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `local_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `local_records` (
	`id` varchar(64) NOT NULL,
	`company_id` int NOT NULL,
	`kind` varchar(32) NOT NULL,
	`version` int NOT NULL,
	`owner_user_id` int,
	`parent_id` varchar(64),
	`data` longtext NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `local_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `local_requests` (
	`company_id` int NOT NULL,
	`request_id` varchar(64) NOT NULL,
	`actor_user_id` int NOT NULL,
	`procedure` varchar(64) NOT NULL,
	`result` longtext,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `local_requests_company_id_request_id_pk` PRIMARY KEY(`company_id`,`request_id`)
);
--> statement-breakpoint
ALTER TABLE `kiosk_user_companies` ADD `roles` varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `local_events_subject_idx` ON `local_events` (`company_id`,`subject`,`subject_id`);--> statement-breakpoint
CREATE INDEX `local_records_company_kind_owner_idx` ON `local_records` (`company_id`,`kind`,`owner_user_id`);--> statement-breakpoint
CREATE INDEX `local_records_company_kind_parent_idx` ON `local_records` (`company_id`,`kind`,`parent_id`);