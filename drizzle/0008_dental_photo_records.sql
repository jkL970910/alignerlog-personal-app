CREATE TABLE IF NOT EXISTS "dental_photo_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "date" varchar(10) NOT NULL,
  "stage_name" varchar(80) DEFAULT '' NOT NULL,
  "tray_number" integer,
  "view_type" varchar(40) NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "image_data_url" text NOT NULL,
  "image_mime_type" varchar(40) NOT NULL,
  "image_size_bytes" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dental_photo_records_user_date_idx"
  ON "dental_photo_records" USING btree ("user_id", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dental_photo_records_user_created_idx"
  ON "dental_photo_records" USING btree ("user_id", "created_at");
