import { z } from "zod";

import { buildTreatmentPlanImportPreview } from "@/lib/treatment-plan";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { getActiveTreatmentSeries, listTreatmentExceptionEvents, saveTreatmentPlanImport, updateActiveTreatmentSeries } from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

const importSchema = z.object({
  mode: z.enum(["preview", "confirm", "update", "reset"]).default("preview"),
  plan: z.object({
    status: z.enum(["not_started", "active", "holding", "waiting_refinement", "retainer"]),
    seriesType: z.enum(["active", "refinement", "holding", "retainer"]),
    name: z.string().min(1).max(80),
    startDate: z.string().optional(),
    currentTrayNumber: z.number().int().positive(),
    totalTrays: z.number().int().positive(),
    overallTotalTrays: z.number().int().positive().optional(),
    overallTreatmentDays: z.number().int().positive().optional(),
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
    const timeZone = getRequestTimeZone(request);
    const parsed = importSchema.parse(await request.json());
    const preview = buildTreatmentPlanImportPreview(parsed.plan, new Date(), timeZone);

    if (parsed.mode === "preview") {
      return apiJson(preview);
    }

    const activeSeries = await getActiveTreatmentSeries(userId);

    if (parsed.mode === "update") {
      const result = await updateActiveTreatmentSeries(userId, preview);
      return apiJson({
        ...result,
        exceptionEvents: await listTreatmentExceptionEvents(userId, result.series.id)
      });
    }

    if (parsed.mode === "confirm" && activeSeries) {
      throw new Error("已有牙套计划。请使用“修改当前计划”，或显式选择“重置计划”。");
    }

    return apiJson(await saveTreatmentPlanImport(userId, preview));
  } catch (error) {
    return apiError(error);
  }
}
