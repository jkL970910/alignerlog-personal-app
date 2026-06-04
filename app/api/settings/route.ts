import { apiError, apiJson } from "@/server/http";
import { requireCurrentUserId } from "@/server/auth";
import {
  getOrCreateReminderSettings,
  getOrCreateTreatmentPlan,
  updateReminderSettings,
  updateTreatmentPlan
} from "@/server/repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireCurrentUserId();

    return apiJson({
      treatmentPlan: await getOrCreateTreatmentPlan(userId),
      reminderSettings: await getOrCreateReminderSettings(userId)
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json() as {
      treatmentPlan?: Parameters<typeof updateTreatmentPlan>[1];
      reminderSettings?: Parameters<typeof updateReminderSettings>[1];
    };
    const treatmentPlan = body.treatmentPlan
      ? await updateTreatmentPlan(userId, body.treatmentPlan)
      : await getOrCreateTreatmentPlan(userId);
    const reminderSettings = body.reminderSettings
      ? await updateReminderSettings(userId, body.reminderSettings)
      : await getOrCreateReminderSettings(userId);

    return apiJson({ treatmentPlan, reminderSettings });
  } catch (error) {
    return apiError(error);
  }
}
