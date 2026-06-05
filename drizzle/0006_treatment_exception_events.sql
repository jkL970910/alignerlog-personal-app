CREATE TABLE IF NOT EXISTS "treatment_exception_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "series_id" uuid NOT NULL,
  "tray_number" integer,
  "event_type" varchar(40) NOT NULL,
  "event_date" varchar(10) NOT NULL,
  "extension_days" integer,
  "note" text DEFAULT '' NOT NULL,
  "schedule_adjusted" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treatment_exception_events_user_series_date_idx"
  ON "treatment_exception_events" USING btree ("user_id", "series_id", "event_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treatment_exception_events_user_created_idx"
  ON "treatment_exception_events" USING btree ("user_id", "created_at");
