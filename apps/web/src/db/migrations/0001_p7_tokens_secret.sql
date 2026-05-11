ALTER TABLE "tokens" ADD COLUMN "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "secret_hash" text;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "fingerprint" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_secret_hash_idx" ON "tokens" USING btree ("secret_hash");