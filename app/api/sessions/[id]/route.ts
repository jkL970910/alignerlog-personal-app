import { z } from "zod";

import { localDateTimeToUtc } from "@/lib/dates";
import type { OffTrayReason } from "@/lib/types";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { deleteManualOffTraySession, updateManualOffTraySession } from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

const updateSchema = z.object({
  startLocal: z.string(),
  endLocal: z.string(),
  reason: z.enum(["meal", "drink", "brushing", "other"]).optional()
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
    const { id } = await context.params;
    const parsed = updateSchema.parse(await request.json());
    const session = await updateManualOffTraySession({
      userId,
      sessionId: id,
      startAt: localDateTimeToUtc(parsed.startLocal, timeZone),
      endAt: localDateTimeToUtc(parsed.endLocal, timeZone),
      reason: parsed.reason as OffTrayReason | undefined
    });

    return apiJson({ session });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const userId = await requireCurrentUserId();
    const { id } = await context.params;
    const session = await deleteManualOffTraySession(userId, id);

    return apiJson({ session });
  } catch (error) {
    return apiError(error);
  }
}
