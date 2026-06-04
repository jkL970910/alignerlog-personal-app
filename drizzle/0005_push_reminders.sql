CREATE TYPE "push_subscription_status" AS ENUM (
  'active',
  'disabled',
  'expired'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "status" "push_subscription_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_idx"
  ON "push_subscriptions" USING btree ("endpoint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_status_idx"
  ON "push_subscriptions" USING btree ("user_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminder_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "kind" varchar(40) NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "status" varchar(20) DEFAULT 'scheduled' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reminder_jobs_session_kind_idx"
  ON "reminder_jobs" USING btree ("session_id", "kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminder_jobs_due_status_idx"
  ON "reminder_jobs" USING btree ("status", "due_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminder_jobs_user_status_idx"
  ON "reminder_jobs" USING btree ("user_id", "status");
