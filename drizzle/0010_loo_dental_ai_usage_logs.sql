CREATE TABLE IF NOT EXISTS "loo_dental_ai_usage_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "question_length" integer NOT NULL,
  "status" varchar(20) DEFAULT 'ok' NOT NULL,
  "failure_kind" varchar(80),
  "error_message" text,
  "latency_ms" integer,
  "model" varchar(80) DEFAULT 'gpt-5.5' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loo_dental_ai_usage_logs_user_created_idx"
  ON "loo_dental_ai_usage_logs" USING btree ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loo_dental_ai_usage_logs_status_created_idx"
  ON "loo_dental_ai_usage_logs" USING btree ("status", "created_at");
