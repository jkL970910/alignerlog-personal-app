import { requireCurrentUserId } from "@/server/auth";
import { apiError } from "@/server/http";
import {
  getOrCreateReminderSettings,
  getOrCreateTreatmentPlan,
  getOrCreateWearState,
  listAllSessions
} from "@/server/repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const payload = {
      exportedAt: new Date().toISOString(),
      treatmentPlan: await getOrCreateTreatmentPlan(userId),
      wearState: await getOrCreateWearState(userId),
      reminderSettings: await getOrCreateReminderSettings(userId),
      offTraySessions: await listAllSessions(userId)
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=alignerlog-export.json"
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
