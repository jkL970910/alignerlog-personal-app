import { z } from "zod";

import { buildTreatmentPlanImportPreview } from "@/lib/treatment-plan";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { saveTreatmentPlanImport } from "@/server/repository";

export const runtime = "nodejs";

const importSchema = z.object({
  mode: z.enum(["preview", "confirm"]).default("preview"),
  plan: z.object({
    status: z.enum(["not_started", "active", "holding", "waiting_refinement", "retainer"]),
    seriesType: z.enum(["active", "refinement", "holding", "retainer"]),
    name: z.string().min(1).max(80),
    startDate: z.string().optional(),
    currentTrayNumber: z.number().int().positive(),
    totalTrays: z.number().int().positive(),
    trayIntervalDays: z.number().int().positive().max(30),
    dailyGoalMinutes: z.number().int().min(60).max(1440),
    currentTrayStartDate: z.string().optional(),
    nextChangeDate: z.string().optional(),
    appointmentDate: z.string().optional(),
    clinicianNotes: z.string().max(1000).optional()
  })
});

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const parsed = importSchema.parse(await request.json());
    const preview = buildTreatmentPlanImportPreview(parsed.plan);

    if (parsed.mode === "preview") {
      return apiJson(preview);
    }

    return apiJson(await saveTreatmentPlanImport(userId, preview));
  } catch (error) {
    return apiError(error);
  }
}
