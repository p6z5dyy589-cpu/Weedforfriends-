CREATE TABLE `kiosk_sessions` (
	`token_hash` char(64) NOT NULL,
	`user_id` int NOT NULL,
	`active_company_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	CONSTRAINT `kiosk_sessions_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `kiosk_user_companies` (
	`user_id` int NOT NULL,
	`company_id` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `kiosk_user_companies_user_id_company_id_pk` PRIMARY KEY(`user_id`,`company_id`)
);
--> statement-breakpoint
CREATE TABLE `kiosk_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`login_name` varchar(64) NOT NULL,
	`display_name` varchar(128) NOT NULL,
	`role` enum('employee','coordinator') NOT NULL DEFAULT 'employee',
	`active` boolean NOT NULL DEFAULT true,
	`pin_hash` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `kiosk_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `kiosk_users_login_name_uq` UNIQUE(`login_name`)
);
--> statement-breakpoint
CREATE INDEX `kiosk_sessions_user_idx` ON `kiosk_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `kiosk_user_companies_company_idx` ON `kiosk_user_companies` (`company_id`);