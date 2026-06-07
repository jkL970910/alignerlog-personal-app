import { apiError, apiJson } from "@/server/http";
import { calculatePlanProgress, getAppointmentExtensionSuggestion } from "@/lib/treatment-plan";
import { requireCurrentUserId } from "@/server/auth";
import {
  getActiveTreatmentSeries,
  getOrCreateReminderSettings,
  getOrCreateTreatmentPlan,
  listTreatmentExceptionEvents,
  listPlannedTraysForSeries,
  updateReminderSettings,
  updateTreatmentPlan
} from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
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
      trays: plannedTrays,
      timeZone
    }) : null;
    const appointmentExtensionSuggestion = activeSeries ? getAppointmentExtensionSuggestion({
      currentTrayNumber: activeSeries.currentTrayNumber,
      totalTrays: activeSeries.totalTrays,
      appointmentDate: activeSeries.appointmentDate,
      trays: plannedTrays
    }) : null;

    const exceptionEvents = activeSeries ? await listTreatmentExceptionEvents(userId, activeSeries.id) : [];

    return apiJson({
      treatmentPlan: await getOrCreateTreatmentPlan(userId),
      reminderSettings: await getOrCreateReminderSettings(userId),
      activeSeries,
      planProgress,
      appointmentExtensionSuggestion,
      exceptionEvents
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
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
      trays: plannedTrays,
      timeZone
    }) : null;
    const appointmentExtensionSuggestion = activeSeries ? getAppointmentExtensionSuggestion({
      currentTrayNumber: activeSeries.currentTrayNumber,
      totalTrays: activeSeries.totalTrays,
      appointmentDate: activeSeries.appointmentDate,
      trays: plannedTrays
    }) : null;

    const exceptionEvents = activeSeries ? await listTreatmentExceptionEvents(userId, activeSeries.id) : [];

    return apiJson({ treatmentPlan, reminderSettings, activeSeries, planProgress, appointmentExtensionSuggestion, exceptionEvents });
  } catch (error) {
    return apiError(error);
  }
}
