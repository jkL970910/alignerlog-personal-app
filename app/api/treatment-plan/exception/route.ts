import { z } from "zod";

import { calculatePlanProgress } from "@/lib/treatment-plan";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { applyTreatmentException } from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

const exceptionSchema = z.object({
  eventType: z.enum([
    "extend_current_tray",
    "poor_fit",
    "lost_or_broken",
    "waiting_refinement",
    "waiting_retainer"
  ]),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  extensionDays: z.number().int().positive().max(30).optional(),
  note: z.string().max(1000).optional()
});

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
    const parsed = exceptionSchema.parse(await request.json());
    const result = await applyTreatmentException({ userId, ...parsed });
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
