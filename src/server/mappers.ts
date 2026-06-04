import type { DailyNote, OffTraySession, PlannedTray, ReminderSettings, TreatmentPlan, TreatmentSeries, UserAccount, WearState } from "@/lib/types";

import type { dailyNotes, offTraySessions, plannedTrays, reminderSettings, treatmentPlans, treatmentSeries, users, wearStates } from "@/lib/db/schema";

type UserRow = typeof users.$inferSelect;
type TreatmentPlanRow = typeof treatmentPlans.$inferSelect;
type WearStateRow = typeof wearStates.$inferSelect;
type OffTraySessionRow = typeof offTraySessions.$inferSelect;
type DailyNoteRow = typeof dailyNotes.$inferSelect;
type ReminderSettingsRow = typeof reminderSettings.$inferSelect;
type TreatmentSeriesRow = typeof treatmentSeries.$inferSelect;
type PlannedTrayRow = typeof plannedTrays.$inferSelect;

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
