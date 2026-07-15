PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_roles` text DEFAULT '[]' NOT NULL,
	`target_areas` text DEFAULT '[]' NOT NULL,
	`seniority` text DEFAULT '[]' NOT NULL,
	`search_location` text DEFAULT '["Brasil"]' NOT NULL,
	`allowed_modalities` text DEFAULT '["remoto","híbrido"]' NOT NULL,
	`hybrid_cities` text DEFAULT '[]' NOT NULL,
	`skill_matrix` text DEFAULT '{}' NOT NULL,
	`languages` text DEFAULT '{}' NOT NULL,
	`negative_keywords` text DEFAULT '[]' NOT NULL,
	`resume_file_path` text,
	`ai_application_context` text DEFAULT '' NOT NULL,
	`min_score` integer DEFAULT 75 NOT NULL,
	`daily_limit` integer DEFAULT 10 NOT NULL,
	`ai_reason` text,
	`ai_metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_profiles`("id", "name", "target_roles", "target_areas", "seniority", "search_location", "allowed_modalities", "hybrid_cities", "skill_matrix", "languages", "negative_keywords", "resume_file_path", "ai_application_context", "min_score", "daily_limit", "ai_reason", "ai_metadata", "created_at", "updated_at") SELECT "id", "name", "target_roles", "target_areas", "seniority", "search_location", "allowed_modalities", "hybrid_cities", "skill_matrix", "languages", "negative_keywords", "resume_file_path", "ai_application_context", "min_score", "daily_limit", "ai_reason", "ai_metadata", "created_at", "updated_at" FROM `profiles`;--> statement-breakpoint
DROP TABLE `profiles`;--> statement-breakpoint
ALTER TABLE `__new_profiles` RENAME TO `profiles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_name_unique` ON `profiles` (`name`);