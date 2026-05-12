CREATE TYPE "public"."eval_run_status" AS ENUM('queued', 'running', 'passed', 'failed', 'error');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eval_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"suite_id" text NOT NULL,
	"status" "eval_run_status" DEFAULT 'queued' NOT NULL,
	"started_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"pass_rate" double precision,
	"cases_run" integer,
	"error" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_suite_id_eval_suites_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."eval_suites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eval_runs_suite_id_created_at_idx" ON "eval_runs" USING btree ("suite_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eval_runs_pending_idx" ON "eval_runs" USING btree ("created_at");