CREATE TYPE "wear_action" AS ENUM (
  'start',
  'end'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wear_action_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "action" "wear_action" NOT NULL,
  "changed" boolean NOT NULL,
  "session_id" uuid,
  "resulting_is_wearing" boolean NOT NULL,
  "request_id" varchar(128),
  "source" varchar(80),
  "user_agent" text,
  "referer" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wear_action_logs_user_created_idx"
  ON "wear_action_logs" USING btree ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wear_action_logs_session_idx"
  ON "wear_action_logs" USING btree ("session_id");
