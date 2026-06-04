ALTER TABLE "treatment_series"
  ADD COLUMN IF NOT EXISTS "overall_total_trays" integer;
--> statement-breakpoint
ALTER TABLE "treatment_series"
  ADD COLUMN IF NOT EXISTS "overall_treatment_days" integer;
