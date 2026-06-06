import type { DailyNote, DentalPhotoRecord, LooDentalAiUsageLog, LooDentalMinisterChatMessage, LooDentalMinisterChatSession, OffTraySession, PlannedTray, PushSubscriptionRecord, ReminderJob, ReminderSettings, TreatmentExceptionEvent, TreatmentPlan, TreatmentSeries, UserAccount, WearActionLog, WearState } from "@/lib/types";

import type { dailyNotes, dentalPhotoRecords, looDentalAiUsageLogs, looDentalMinisterChatMessages, looDentalMinisterChatSessions, offTraySessions, plannedTrays, pushSubscriptions, reminderJobs, reminderSettings, treatmentExceptionEvents, treatmentPlans, treatmentSeries, users, wearActionLogs, wearStates } from "@/lib/db/schema";

type UserRow = typeof users.$inferSelect;
type TreatmentPlanRow = typeof treatmentPlans.$inferSelect;
type WearStateRow = typeof wearStates.$inferSelect;
type OffTraySessionRow = typeof offTraySessions.$inferSelect;
type DailyNoteRow = typeof dailyNotes.$inferSelect;
type ReminderSettingsRow = typeof reminderSettings.$inferSelect;
type TreatmentSeriesRow = typeof treatmentSeries.$inferSelect;
type PlannedTrayRow = typeof plannedTrays.$inferSelect;
type WearActionLogRow = typeof wearActionLogs.$inferSelect;
type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
type ReminderJobRow = typeof reminderJobs.$inferSelect;
type TreatmentExceptionEventRow = typeof treatmentExceptionEvents.$inferSelect;
type DentalPhotoRecordRow = typeof dentalPhotoRecords.$inferSelect;
type LooDentalAiUsageLogRow = typeof looDentalAiUsageLogs.$inferSelect;
type LooDentalMinisterChatSessionRow = typeof looDentalMinisterChatSessions.$inferSelect;
type LooDentalMinisterChatMessageRow = typeof looDentalMinisterChatMessages.$inferSelect;

export function mapUser(row: UserRow): UserAccount {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapTreatmentPlan(row: TreatmentPlanRow): TreatmentPlan {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapWearState(row: WearStateRow): WearState {
  return {
    ...row,
    lastChangedAt: row.lastChangedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapOffTraySession(row: OffTraySessionRow): OffTraySession {
  return {
    ...row,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt?.toISOString() ?? null,
    reminderAt: row.reminderAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapDailyNote(row: DailyNoteRow): DailyNote {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapReminderSettings(row: ReminderSettingsRow): ReminderSettings {
  return {
    ...row,
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapTreatmentSeries(row: TreatmentSeriesRow): TreatmentSeries {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapPlannedTray(row: PlannedTrayRow): PlannedTray {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapWearActionLog(row: WearActionLogRow): WearActionLog {
  return {
    ...row,
    createdAt: row.createdAt.toISOString()
  };
}

export function mapPushSubscription(row: PushSubscriptionRow): PushSubscriptionRecord {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null
  };
}

export function mapReminderJob(row: ReminderJobRow): ReminderJob {
  return {
    ...row,
    status: row.status as ReminderJob["status"],
    dueAt: row.dueAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapTreatmentExceptionEvent(row: TreatmentExceptionEventRow): TreatmentExceptionEvent {
  return {
    ...row,
    eventType: row.eventType as TreatmentExceptionEvent["eventType"],
    status: row.status as TreatmentExceptionEvent["status"],
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapDentalPhotoRecord(row: DentalPhotoRecordRow): DentalPhotoRecord {
  return {
    ...row,
    viewType: row.viewType as DentalPhotoRecord["viewType"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapLooDentalAiUsageLog(row: LooDentalAiUsageLogRow): LooDentalAiUsageLog {
  return {
    ...row,
    status: row.status as LooDentalAiUsageLog["status"],
    createdAt: row.createdAt.toISOString()
  };
}

export function mapLooDentalMinisterChatSession(row: LooDentalMinisterChatSessionRow): LooDentalMinisterChatSession {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapLooDentalMinisterChatMessage(row: LooDentalMinisterChatMessageRow): LooDentalMinisterChatMessage {
  return {
    ...row,
    role: row.role as LooDentalMinisterChatMessage["role"],
    createdAt: row.createdAt.toISOString()
  };
}
