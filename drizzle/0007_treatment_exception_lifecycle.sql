ALTER TABLE "treatment_exception_events"
  ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "treatment_exception_events"
  ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "treatment_exception_events"
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treatment_exception_events_user_series_status_idx"
  ON "treatment_exception_events" USING btree ("user_id", "series_id", "status");
