ALTER TABLE "connections" ADD COLUMN "last_test_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "last_test_detail" text;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "last_test_ok" boolean;