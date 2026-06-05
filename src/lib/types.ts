export type WearStatus = "wearing" | "out";

export type OffTrayReason = "meal" | "drink" | "brushing" | "other";

export type WearAction = "start" | "end";

export type ReminderStatus = "none" | "scheduled" | "sent" | "cancelled";

export type PushSubscriptionStatus = "active" | "disabled" | "expired";

export type ReminderJobStatus = "scheduled" | "sent" | "cancelled" | "failed";

export type UserAccount = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

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

export type WearActionLog = {
  id: string;
  userId: string;
  action: WearAction;
  changed: boolean;
  sessionId: string | null;
  resultingIsWearing: boolean;
  requestId: string | null;
  source: string | null;
  userAgent: string | null;
  referer: string | null;
  createdAt: string;
};

export type PushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  status: PushSubscriptionStatus;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
};

export type ReminderJob = {
  id: string;
  userId: string;
  sessionId: string;
  kind: string;
  dueAt: string;
  status: ReminderJobStatus;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
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
  hasData: boolean;
};

export type AppSnapshot = {
  wearState: WearState;
  treatmentPlan: TreatmentPlan;
  reminderSettings: ReminderSettings;
  activeSession: OffTraySession | null;
  todaySummary: DailySummary;
  planProgress?: PlanProgress | null;
  activeException?: TreatmentExceptionEvent | null;
  recentExceptions?: TreatmentExceptionEvent[];
};

export type CalendarDay = {
  date: string;
  summary: DailySummary;
  note: DailyNote | null;
  trayEvents: CalendarTrayEvent[];
  hasData: boolean;
  status: "no_data" | "goal_met" | "close" | "below_goal";
};

export type CalendarTrayEvent = {
  trayNumber: number;
  kind: "start" | "end";
  label: string;
};

export type TreatmentStatus = "not_started" | "active" | "holding" | "waiting_refinement" | "retainer";

export type TreatmentSeriesType = "active" | "refinement" | "holding" | "retainer";

export type PlannedTrayStatus = "completed" | "current" | "upcoming" | "extended" | "paused" | "skipped_by_clinician";

export type PlannedTraySource = "imported" | "generated" | "adjusted";

export type TreatmentExceptionType =
  | "late_change"
  | "tray_extension"
  | "extend_current_tray"
  | "poor_fit"
  | "lost_tray"
  | "broken_tray"
  | "lost_or_broken"
  | "waiting_refinement"
  | "waiting_rescan"
  | "waiting_retainer";

export type TreatmentExceptionStatus = "active" | "resolved" | "cancelled";

export type TreatmentSeries = {
  id: string;
  userId: string;
  name: string;
  status: TreatmentStatus;
  seriesType: TreatmentSeriesType;
  startDate: string;
  currentTrayNumber: number;
  totalTrays: number | null;
  overallTotalTrays: number | null;
  overallTreatmentDays: number | null;
  trayIntervalDays: number;
  dailyGoalMinutes: number;
  currentTrayStartDate: string;
  nextChangeDate: string | null;
  appointmentDate: string | null;
  clinicianNotes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlannedTray = {
  id: string;
  userId: string;
  seriesId: string;
  trayNumber: number;
  plannedStartDate: string;
  plannedEndDate: string;
  status: PlannedTrayStatus;
  source: PlannedTraySource;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type PlannedTrayDraft = Omit<PlannedTray, "id" | "userId" | "seriesId" | "createdAt" | "updatedAt">;

export type TreatmentExceptionEvent = {
  id: string;
  userId: string;
  seriesId: string;
  trayNumber: number | null;
  eventType: TreatmentExceptionType;
  eventDate: string;
  extensionDays: number | null;
  note: string;
  scheduleAdjusted: boolean;
  status: TreatmentExceptionStatus;
  resolvedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TreatmentPlanImportInput = {
  status: TreatmentStatus;
  seriesType: TreatmentSeriesType;
  name: string;
  startDate?: string;
  currentTrayNumber: number;
  totalTrays: number;
  overallTotalTrays?: number;
  overallTreatmentDays?: number;
  trayIntervalDays: number;
  dailyGoalMinutes: number;
  currentTrayStartDate?: string;
  nextChangeDate?: string;
  appointmentDate?: string;
  clinicianNotes?: string;
};

export type TreatmentPlanImportPreview = {
  series: Omit<TreatmentSeries, "id" | "userId" | "createdAt" | "updatedAt">;
  trays: PlannedTrayDraft[];
  progress: PlanProgress;
  safetyNote: string;
};

export type PlanProgress = {
  status: TreatmentStatus;
  currentTrayNumber: number;
  totalTrays: number | null;
  overallTotalTrays: number | null;
  overallTreatmentDays: number | null;
  currentTrayDay: number | null;
  trayIntervalDays: number;
  daysUntilNextChange: number | null;
  traysRemaining: number | null;
  nextChangeDate: string | null;
  estimatedSeriesEndDate: string | null;
  label: "on_track" | "not_started" | "paused" | "holding" | "retainer";
};
