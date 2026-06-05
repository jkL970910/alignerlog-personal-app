import { z } from "zod";

import { calculatePlanProgress } from "@/lib/treatment-plan";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { advanceActiveTreatmentTray } from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

const advanceSchema = z.object({
  confirmedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
    const parsed = advanceSchema.parse(await request.json());
    const result = await advanceActiveTreatmentTray(userId, parsed.confirmedDate);
    const progress = calculatePlanProgress({
      status: result.series.status,
      currentTrayNumber: result.series.currentTrayNumber,
      totalTrays: result.series.totalTrays,
      overallTotalTrays: result.series.overallTotalTrays,
      overallTreatmentDays: result.series.overallTreatmentDays,
      trayIntervalDays: result.series.trayIntervalDays,
      currentTrayStartDate: result.series.currentTrayStartDate,
      nextChangeDate: result.series.nextChangeDate,
      trays: result.trays,
      timeZone
    });

    return apiJson({ ...result, progress });
  } catch (error) {
    return apiError(error);
  }
}
