CREATE TYPE "treatment_status" AS ENUM (
  'not_started',
  'active',
  'holding',
  'waiting_refinement',
  'retainer'
);
--> statement-breakpoint
CREATE TYPE "treatment_series_type" AS ENUM (
  'active',
  'refinement',
  'holding',
  'retainer'
);
--> statement-breakpoint
CREATE TYPE "planned_tray_status" AS ENUM (
  'completed',
  'current',
  'upcoming',
  'extended',
  'paused',
  'skipped_by_clinician'
);
--> statement-breakpoint
CREATE TYPE "planned_tray_source" AS ENUM (
  'imported',
  'generated',
  'adjusted'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "treatment_series" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" varchar(80) DEFAULT '第一阶段' NOT NULL,
  "status" "treatment_status" DEFAULT 'active' NOT NULL,
  "series_type" "treatment_series_type" DEFAULT 'active' NOT NULL,
  "start_date" varchar(10) NOT NULL,
  "current_tray_number" integer NOT NULL,
  "total_trays" integer,
  "tray_interval_days" integer DEFAULT 7 NOT NULL,
  "daily_goal_minutes" integer DEFAULT 1320 NOT NULL,
  "current_tray_start_date" varchar(10) NOT NULL,
  "next_change_date" varchar(10),
  "appointment_date" varchar(10),
  "clinician_notes" text DEFAULT '' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treatment_series_user_active_idx"
  ON "treatment_series" USING btree ("user_id", "is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treatment_series_user_created_idx"
  ON "treatment_series" USING btree ("user_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "planned_trays" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "series_id" uuid NOT NULL,
  "tray_number" integer NOT NULL,
  "planned_start_date" varchar(10) NOT NULL,
  "planned_end_date" varchar(10) NOT NULL,
  "status" "planned_tray_status" DEFAULT 'upcoming' NOT NULL,
  "source" "planned_tray_source" DEFAULT 'generated' NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "planned_trays_user_series_tray_idx"
  ON "planned_trays" USING btree ("user_id", "series_id", "tray_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "planned_trays_user_date_idx"
  ON "planned_trays" USING btree ("user_id", "planned_start_date", "planned_end_date");
