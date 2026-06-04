import { apiError, apiJson } from "@/server/http";
import { calculatePlanProgress } from "@/lib/treatment-plan";
import { requireCurrentUserId } from "@/server/auth";
import {
  getActiveTreatmentSeries,
  getOrCreateReminderSettings,
  getOrCreateTreatmentPlan,
  listPlannedTraysForSeries,
  updateReminderSettings,
  updateTreatmentPlan
} from "@/server/repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const activeSeries = await getActiveTreatmentSeries(userId);
    const plannedTrays = activeSeries ? await listPlannedTraysForSeries(userId, activeSeries.id) : [];
    const planProgress = activeSeries ? calculatePlanProgress({
      status: activeSeries.status,
      currentTrayNumber: activeSeries.currentTrayNumber,
      totalTrays: activeSeries.totalTrays,
      overallTotalTrays: activeSeries.overallTotalTrays,
      overallTreatmentDays: activeSeries.overallTreatmentDays,
      trayIntervalDays: activeSeries.trayIntervalDays,
      currentTrayStartDate: activeSeries.currentTrayStartDate,
      nextChangeDate: activeSeries.nextChangeDate,
      trays: plannedTrays
    }) : null;

    return apiJson({
      treatmentPlan: await getOrCreateTreatmentPlan(userId),
      reminderSettings: await getOrCreateReminderSettings(userId),
      activeSeries,
      planProgress
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
    const activeSeries = await getActiveTreatmentSeries(userId);
    const plannedTrays = activeSeries ? await listPlannedTraysForSeries(userId, activeSeries.id) : [];
    const planProgress = activeSeries ? calculatePlanProgress({
      status: activeSeries.status,
      currentTrayNumber: activeSeries.currentTrayNumber,
      totalTrays: activeSeries.totalTrays,
      overallTotalTrays: activeSeries.overallTotalTrays,
      overallTreatmentDays: activeSeries.overallTreatmentDays,
      trayIntervalDays: activeSeries.trayIntervalDays,
      currentTrayStartDate: activeSeries.currentTrayStartDate,
      nextChangeDate: activeSeries.nextChangeDate,
      trays: plannedTrays
    }) : null;

    return apiJson({ treatmentPlan, reminderSettings, activeSeries, planProgress });
  } catch (error) {
    return apiError(error);
  }
}
