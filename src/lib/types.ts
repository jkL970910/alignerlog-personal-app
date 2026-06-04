export type WearStatus = "wearing" | "out";

export type OffTrayReason = "meal" | "drink" | "brushing" | "other";

export type ReminderStatus = "none" | "scheduled" | "sent" | "cancelled";

export type TreatmentPlan = {
  id: string;
  userId: string;
  startDate: string;
  currentTrayNumber: number;
  totalTrays: number | null;
  daysPerTray: number;
  dailyGoalMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type WearState = {
  id: string;
  userId: string;
  isWearing: boolean;
  currentOffSessionId: string | null;
  lastChangedAt: string;
  updatedAt: string;
};

export type OffTraySession = {
  id: string;
  userId: string;
  startAt: string;
  endAt: string | null;
  reason: OffTrayReason | null;
  reminderAt: string | null;
  reminderStatus: ReminderStatus;
  createdAt: string;
  updatedAt: string;
};

export type DailyNote = {
  id: string;
  userId: string;
  date: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type ReminderSettings = {
  id: string;
  userId: string;
  enableMealReminder: boolean;
  mealReminderMinutes: number;
  enableBedtimeReminder: boolean;
  bedtimeReminderTime: string;
  enableTrayChangeReminder: boolean;
  updatedAt: string;
};

export type DailySummary = {
  date: string;
  offMinutes: number;
  wearMinutes: number;
  goalMinutes: number;
  trayNumber: number | null;
  sessionCount: number;
  longestOffSessionMinutes: number;
  goalMet: boolean;
};

export type AppSnapshot = {
  wearState: WearState;
  treatmentPlan: TreatmentPlan;
  reminderSettings: ReminderSettings;
  activeSession: OffTraySession | null;
  todaySummary: DailySummary;
};
