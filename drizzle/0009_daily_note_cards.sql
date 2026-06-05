DROP INDEX IF EXISTS "daily_notes_user_date_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_notes_user_date_idx"
  ON "daily_notes" USING btree ("user_id", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_notes_user_created_idx"
  ON "daily_notes" USING btree ("user_id", "created_at");
