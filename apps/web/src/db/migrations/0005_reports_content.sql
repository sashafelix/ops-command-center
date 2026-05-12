ALTER TABLE "ad_hoc_reports" ADD COLUMN "kind" text DEFAULT 'audit-events' NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_hoc_reports" ADD COLUMN "format" text DEFAULT 'JSONL' NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_hoc_reports" ADD COLUMN "content" text DEFAULT '' NOT NULL;