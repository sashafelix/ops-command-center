CREATE TYPE "public"."agent_status" AS ENUM('active', 'paused', 'drained');--> statement-breakpoint
CREATE TYPE "public"."approval_decision" AS ENUM('approve', 'deny', 'edit', 'expire');--> statement-breakpoint
CREATE TYPE "public"."bundle_status" AS ENUM('ready', 'stale', 'building');--> statement-breakpoint
CREATE TYPE "public"."deploy_channel" AS ENUM('stable', 'canary', 'shadow');--> statement-breakpoint
CREATE TYPE "public"."deploy_status" AS ENUM('rolled-out', 'rolling', 'rolled-back');--> statement-breakpoint
CREATE TYPE "public"."deploy_target_kind" AS ENUM('service', 'agent');--> statement-breakpoint
CREATE TYPE "public"."eval_status" AS ENUM('ok', 'warn', 'bad');--> statement-breakpoint
CREATE TYPE "public"."evidence_status" AS ENUM('pending', 'verified', 'tampered');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('investigating', 'monitoring', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."investigation_status" AS ENUM('open', 'triage', 'closed');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('Owner', 'Admin', 'SRE', 'Analyst', 'Viewer');--> statement-breakpoint
CREATE TYPE "public"."notification_level" AS ENUM('info', 'warn', 'bad');--> statement-breakpoint
CREATE TYPE "public"."policy_mode" AS ENUM('always-ask', 'ask-once', 'auto-approve', 'ask-if-unsigned');--> statement-breakpoint
CREATE TYPE "public"."report_format" AS ENUM('PDF', 'CSV', 'JSONL');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'sre', 'analyst', 'viewer', 'agent');--> statement-breakpoint
CREATE TYPE "public"."session_outcome" AS ENUM('in-progress', 'success', 'aborted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('ok', 'warn', 'bad', 'idle');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'med', 'high');--> statement-breakpoint
CREATE TYPE "public"."status_tone" AS ENUM('ok', 'warn', 'bad', 'info', 'violet');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_hoc_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"by" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"size" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"channel" "deploy_channel" NOT NULL,
	"status" "agent_status" NOT NULL,
	"model" text NOT NULL,
	"owner" text NOT NULL,
	"trust_score" double precision NOT NULL,
	"runs_24h" integer DEFAULT 0 NOT NULL,
	"cost_24h" double precision DEFAULT 0 NOT NULL,
	"p95_s" double precision DEFAULT 0 NOT NULL,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rate_per_min" integer DEFAULT 0 NOT NULL,
	"budget" double precision DEFAULT 0 NOT NULL,
	"signing_key_fp" text NOT NULL,
	"signed" boolean DEFAULT false NOT NULL,
	"drift" double precision DEFAULT 0 NOT NULL,
	"spark" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"severity" "severity" NOT NULL,
	"policy_id" text NOT NULL,
	"command" text NOT NULL,
	"justification" text NOT NULL,
	"blast_radius" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"auto_deny_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"decision" "approval_decision",
	"approver_user_id" text,
	"edited_command" text,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"seq" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id" text NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"role" "role" NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"ip" text NOT NULL,
	"ua" text NOT NULL,
	"hash" text NOT NULL,
	"prev_hash" text NOT NULL,
	"anchored_at" timestamp with time zone,
	CONSTRAINT "audit_events_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budget_breaches" (
	"id" text PRIMARY KEY NOT NULL,
	"team" text NOT NULL,
	"cap" text NOT NULL,
	"amount" text NOT NULL,
	"when" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budget_meta" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"spend_24h" double precision DEFAULT 0 NOT NULL,
	"cap_day" double precision DEFAULT 0 NOT NULL,
	"spend_mtd" double precision DEFAULT 0 NOT NULL,
	"cap_month" double precision DEFAULT 0 NOT NULL,
	"forecast" double precision DEFAULT 0 NOT NULL,
	"breaches_30d" integer DEFAULT 0 NOT NULL,
	"mtd_daily" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cap_line" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budgets" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"label" text NOT NULL,
	"daily_cap" double precision NOT NULL,
	"cap_mtd" double precision NOT NULL,
	"spend_24h" double precision DEFAULT 0 NOT NULL,
	"mtd_actual" double precision DEFAULT 0 NOT NULL,
	"forecast_eom" double precision DEFAULT 0 NOT NULL,
	"agents" integer DEFAULT 0 NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL,
	"trend" text DEFAULT '0%' NOT NULL,
	"spark" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "status_tone" NOT NULL,
	CONSTRAINT "budgets_team_id_unique" UNIQUE("team_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compliance_bundles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"framework" text NOT NULL,
	"status" "bundle_status" NOT NULL,
	"last_built" text NOT NULL,
	"range" text NOT NULL,
	"content_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"status" text NOT NULL,
	"detail" text NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_sync" text NOT NULL,
	"health" "status_tone" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deploys" (
	"id" text PRIMARY KEY NOT NULL,
	"target_kind" "deploy_target_kind" NOT NULL,
	"service_or_agent_id" text NOT NULL,
	"version" text NOT NULL,
	"from_version" text,
	"channel" "deploy_channel" NOT NULL,
	"who" text NOT NULL,
	"when" timestamp with time zone DEFAULT now() NOT NULL,
	"eval_delta" text DEFAULT '0.0%' NOT NULL,
	"cost_delta" text DEFAULT '0.0%' NOT NULL,
	"rollback_candidate" boolean DEFAULT false NOT NULL,
	"status" "deploy_status" DEFAULT 'rolled-out' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eval_ab" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"a_label" text NOT NULL,
	"a_wins" integer DEFAULT 0 NOT NULL,
	"a_score" double precision DEFAULT 0 NOT NULL,
	"b_label" text NOT NULL,
	"b_wins" integer DEFAULT 0 NOT NULL,
	"b_score" double precision DEFAULT 0 NOT NULL,
	"trials" text NOT NULL,
	"significance" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eval_regressions" (
	"id" text PRIMARY KEY NOT NULL,
	"suite_id" text NOT NULL,
	"case" text NOT NULL,
	"model" text NOT NULL,
	"first_fail" timestamp with time zone NOT NULL,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"owner" text NOT NULL,
	"commit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eval_suites" (
	"id" text PRIMARY KEY NOT NULL,
	"cases" integer NOT NULL,
	"pass_rate" double precision NOT NULL,
	"baseline_pass_rate" double precision NOT NULL,
	"delta" double precision DEFAULT 0 NOT NULL,
	"flake_rate" double precision DEFAULT 0 NOT NULL,
	"model" text NOT NULL,
	"status" "eval_status" NOT NULL,
	"trend" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_ran_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evidence_events" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"kind" text NOT NULL,
	"hash" text NOT NULL,
	"signed" boolean DEFAULT false NOT NULL,
	"signed_by" text,
	"signed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"severity" "severity" NOT NULL,
	"service_id" text,
	"title" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ack_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"acked_by" text,
	"postmortem_url" text,
	"status" "incident_status" NOT NULL,
	"assignee" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investigations" (
	"id" text PRIMARY KEY NOT NULL,
	"severity" "severity" NOT NULL,
	"title" text NOT NULL,
	"session_id" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence_status" "evidence_status" NOT NULL,
	"status" "investigation_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kv_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "members" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" NOT NULL,
	"mfa" boolean DEFAULT false NOT NULL,
	"last_seen" timestamp with time zone,
	CONSTRAINT "members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"level" "notification_level" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"target_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policies" (
	"id" text PRIMARY KEY NOT NULL,
	"surface" text NOT NULL,
	"mode" "policy_mode" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"owner_user_id" text NOT NULL,
	"name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prefs" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"retention" text DEFAULT '90 days' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"density" text DEFAULT 'compact' NOT NULL,
	"auto_refresh" boolean DEFAULT true NOT NULL,
	"ambient_audio" boolean DEFAULT false NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"language" text DEFAULT 'en-US' NOT NULL,
	"experimental" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reauth_markers" (
	"email" varchar(320) PRIMARY KEY NOT NULL,
	"fresh_until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" "status_tone" NOT NULL,
	"nodes" text NOT NULL,
	"az" integer NOT NULL,
	"cost_per_hour" text NOT NULL,
	"traffic_pct" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "runtime" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"paused_at" timestamp with time zone,
	"paused_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cadence" text NOT NULL,
	"next_run" text NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"format" "report_format" NOT NULL,
	"last_run" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_load" (
	"service_id" text NOT NULL,
	"minute" integer NOT NULL,
	"cpu_pct" double precision NOT NULL,
	CONSTRAINT "service_load_service_id_minute_pk" PRIMARY KEY("service_id","minute")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "services" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"stack" text NOT NULL,
	"region" text NOT NULL,
	"replicas" text NOT NULL,
	"cpu_pct" double precision DEFAULT 0 NOT NULL,
	"mem_pct" double precision DEFAULT 0 NOT NULL,
	"rps" double precision DEFAULT 0 NOT NULL,
	"error_pct" double precision DEFAULT 0 NOT NULL,
	"p95_ms" integer DEFAULT 0 NOT NULL,
	"status" "status_tone" NOT NULL,
	"reason" text,
	"version" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_version" text NOT NULL,
	"model" text NOT NULL,
	"repo" text NOT NULL,
	"branch" text,
	"goal" text NOT NULL,
	"operator" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"runtime_s" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"tool_calls" integer DEFAULT 0 NOT NULL,
	"trust_score" double precision DEFAULT 1 NOT NULL,
	"status" "session_status" NOT NULL,
	"outcome" "session_outcome" NOT NULL,
	"current_step_id" text,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signing_keys" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"agent" text NOT NULL,
	"algo" text NOT NULL,
	"sigs_24h" integer DEFAULT 0 NOT NULL,
	"last_used" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "slos" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text,
	"name" text NOT NULL,
	"target" text NOT NULL,
	"actual" text NOT NULL,
	"burn_rate" text NOT NULL,
	"state" "status_tone" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "status_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"state" "incident_status" NOT NULL,
	"started_at" text NOT NULL,
	"updates" integer DEFAULT 0 NOT NULL,
	"is_public" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "status_page_meta" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"url" text NOT NULL,
	"published" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "status_signals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state" "status_tone" NOT NULL,
	"uptime" text,
	"last_incident" text,
	"is_public" boolean NOT NULL,
	"uptime90" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "threat_buckets" (
	"category" text NOT NULL,
	"hour" integer NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "threat_buckets_category_hour_pk" PRIMARY KEY("category","hour")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scope" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"t_offset_ms" integer NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"note" text,
	"signed" boolean DEFAULT false NOT NULL,
	"sig_key_id" text,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "status_tone" NOT NULL,
	"delivery_stats" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"workspace_name" text NOT NULL,
	"org_id" text NOT NULL,
	"created_at" text NOT NULL,
	"tier" text NOT NULL,
	"version" text DEFAULT '0.0.0' NOT NULL,
	"build_id" text DEFAULT 'dev' NOT NULL,
	"commit" text DEFAULT 'HEAD' NOT NULL,
	"built_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eval_regressions" ADD CONSTRAINT "eval_regressions_suite_id_eval_suites_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."eval_suites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidence_events" ADD CONSTRAINT "evidence_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incidents" ADD CONSTRAINT "incidents_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investigations" ADD CONSTRAINT "investigations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_load" ADD CONSTRAINT "service_load_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slos" ADD CONSTRAINT "slos_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_session_idx" ON "approvals" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_pending_idx" ON "approvals" USING btree ("decided_at") WHERE "approvals"."decided_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_actor_idx" ON "audit_events" USING btree ("actor");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_action_idx" ON "audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_ts_idx" ON "audit_events" USING btree ("ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_session_idx" ON "evidence_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_read_idx" ON "notifications" USING btree ("read","ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_started_at_idx" ON "sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_status_idx" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_calls_session_idx" ON "tool_calls" USING btree ("session_id","t_offset_ms");