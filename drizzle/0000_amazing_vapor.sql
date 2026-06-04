CREATE TYPE "public"."off_tray_reason" AS ENUM('meal', 'drink', 'brushing', 'other');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('none', 'scheduled', 'sent', 'cancelled');--> statement-breakpoint
CREATE TABLE "daily_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" varchar(10) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "off_tray_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"reason" "off_tray_reason",
	"reminder_at" timestamp with time zone,
	"reminder_status" "reminder_status" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"enable_meal_reminder" boolean DEFAULT false NOT NULL,
	"meal_reminder_minutes" integer DEFAULT 45 NOT NULL,
	"enable_bedtime_reminder" boolean DEFAULT false NOT NULL,
	"bedtime_reminder_time" varchar(5) DEFAULT '22:30' NOT NULL,
	"enable_tray_change_reminder" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treatment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_date" varchar(10) NOT NULL,
	"current_tray_number" integer DEFAULT 1 NOT NULL,
	"total_trays" integer,
	"days_per_tray" integer DEFAULT 7 NOT NULL,
	"daily_goal_minutes" integer DEFAULT 1320 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wear_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"is_wearing" boolean DEFAULT true NOT NULL,
	"current_off_session_id" uuid,
	"last_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_notes_user_date_idx" ON "daily_notes" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "off_tray_sessions_user_start_idx" ON "off_tray_sessions" USING btree ("user_id","start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "off_tray_sessions_active_user_idx" ON "off_tray_sessions" USING btree ("user_id") WHERE "off_tray_sessions"."end_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_settings_user_id_idx" ON "reminder_settings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "treatment_plans_user_id_idx" ON "treatment_plans" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wear_states_user_id_idx" ON "wear_states" USING btree ("user_id");